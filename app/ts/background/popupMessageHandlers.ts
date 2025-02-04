import { EthereumClientService } from '../simulation/services/EthereumClientService.js'
import { Simulator, parseEvents, parseInputData } from '../simulation/simulator.js'
import { AddOrEditAddressBookEntry, AllowOrPreventAddressAccessForWebsite, BlockOrAllowExternalRequests, ChainChangeConfirmation, ChangeActiveAddress, ChangeActiveChain, ChangeAddOrModifyAddressWindowState, ChangeInterceptorAccess, ChangePage, ForceSetGasLimitForTransaction, GetAddressBookData, InterceptorAccess, InterceptorAccessChangeAddress, InterceptorAccessRefresh, OpenWebPage, RemoveAddressBookEntry, RemoveTransaction, RequestAccountsFromSigner, RetrieveWebsiteAccess, SetRpcList, Settings, TransactionConfirmation, UpdateConfirmTransactionDialog, UpdateConfirmTransactionDialogPendingTransactions, UpdateHomePage } from '../types/interceptor-messages.js'
import { WebsiteTabConnections } from '../types/user-interface-types.js'
import { CompleteVisualizedSimulation, ModifyAddressWindowState, PreSimulationTransaction, TransactionStack } from '../types/visualizer-types.js'
import { Website } from '../types/websiteAccessTypes.js'
import { EthereumAddress, serialize } from '../types/wire-types.js'
import { checkAndThrowRuntimeLastError, updateTabIfExists } from '../utils/requests.js'
import { assertNever, modifyObject } from '../utils/typescript.js'
import { sendMessageToApprovedWebsitePorts, updateWebsiteApprovalAccesses } from './accessManagement.js'
import { changeActiveAddressAndChainAndResetSimulation, changeActiveRpc } from './background.js'
import { sendPopupMessageToOpenWindows } from './backgroundUtils.js'
import { getMetadataForAddressBookData } from './medataSearch.js'
import { getActiveAddresses, getAddressBookEntriesForVisualiser, identifyAddress } from './metadataUtils.js'
import { getPage, getSettings, setPage, setUseSignersAddressAsActiveAddress, updateWebsiteAccess } from './settings.js'
import { makeSureInterceptorIsNotSleeping } from './sleeping.js'
import { getCurrentTabId, getIdsOfOpenedTabs, getLatestUnexpectedError, getPendingTransactionsAndMessages, getPrimaryRpcForChain, getRpcConnectionStatus, getRpcList, getSimulationResults, getTabState, saveCurrentTabId, setIdsOfOpenedTabs, setRpcList, updateTransactionStack, updateUserAddressBookEntries } from './storageVariables.js'
import { searchWebsiteAccess } from './websiteAccessSearch.js'
import { resolveChainChange } from './windows/changeChain.js'
import { resolvePendingTransactionOrMessage, setGasLimitForTransaction } from './windows/confirmTransaction.js'
import { getAddressMetadataForAccess, requestAddressChange, resolveInterceptorAccess } from './windows/interceptorAccess.js'
import { craftPersonalSignPopupMessage } from './windows/personalSign.js'

export async function confirmDialog(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, confirmation: TransactionConfirmation) {
	await resolvePendingTransactionOrMessage(simulator, websiteTabConnections, confirmation)
}

export async function confirmRequestAccess(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, confirmation: InterceptorAccess) {
	await resolveInterceptorAccess(simulator, websiteTabConnections, confirmation.data)
}

export async function getLastKnownCurrentTabId() {
	const tabIdPromise = getCurrentTabId()
	const tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true })
	const tabId = await tabIdPromise
	// skip restricted or insufficient permission tabs
	if (tabs[0]?.id === undefined || tabs[0]?.url === undefined) return tabId
	if (tabId !== tabs[0].id) saveCurrentTabId(tabs[0].id)
	return tabs[0].id
}

async function getSignerAccount() {
	const tabId = await getLastKnownCurrentTabId()
	const signerAccounts = tabId === undefined ? undefined : (await getTabState(tabId)).signerAccounts
	return signerAccounts !== undefined && signerAccounts.length > 0 ? signerAccounts[0] : undefined
}

export async function changeActiveAddress(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, addressChange: ChangeActiveAddress) {
	// if using signers address, set the active address to signers address if available, otherwise we don't know active address and set it to be undefined
	if (addressChange.data.activeAddress === 'signer') {
		const signerAccount = await getSignerAccount()
		await setUseSignersAddressAsActiveAddress(addressChange.data.activeAddress === 'signer', signerAccount)

		sendMessageToApprovedWebsitePorts(websiteTabConnections, { method: 'request_signer_to_eth_accounts', result: [] })
		sendMessageToApprovedWebsitePorts(websiteTabConnections, { method: 'request_signer_chainId', result: [] })

		await changeActiveAddressAndChainAndResetSimulation(simulator, websiteTabConnections, {
			activeAddress: signerAccount,
		})
	} else {
		await setUseSignersAddressAsActiveAddress(false)
		await changeActiveAddressAndChainAndResetSimulation(simulator, websiteTabConnections, {
			activeAddress: addressChange.data.activeAddress,
		})
	}
}

export async function removeAddressBookEntry(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, removeAddressBookEntry: RemoveAddressBookEntry) {
	await updateUserAddressBookEntries((previousContacts) => previousContacts.filter((contact) =>
		!(contact.address === removeAddressBookEntry.data.address
		&& (contact.chainId === removeAddressBookEntry.data.chainId || (contact.chainId === undefined && removeAddressBookEntry.data.chainId === 1n))))
	)
	if (removeAddressBookEntry.data.addressBookCategory === 'My Active Addresses') updateWebsiteApprovalAccesses(simulator, websiteTabConnections, await getSettings())
	return await sendPopupMessageToOpenWindows({ method: 'popup_addressBookEntriesChanged' })
}

export async function addOrModifyAddressBookEntry(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, entry: AddOrEditAddressBookEntry) {
	await updateUserAddressBookEntries((previousContacts) => {
		if (previousContacts.find((previous) => previous.address === entry.data.address && (previous.chainId || 1n) === (entry.data.chainId || 1n)) ) {
			return previousContacts.map((previous) => previous.address === entry.data.address && (previous.chainId || 1n) === (entry.data.chainId || 1n) ? entry.data : previous)
		}
		return previousContacts.concat([entry.data])
	})
	if (entry.data.useAsActiveAddress) updateWebsiteApprovalAccesses(simulator, websiteTabConnections, await getSettings())
	return await sendPopupMessageToOpenWindows({ method: 'popup_addressBookEntriesChanged' })
}

export async function changeInterceptorAccess(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, accessChange: ChangeInterceptorAccess) {
	await updateWebsiteAccess((previousAccess) => {
		const withEntriesRemoved = previousAccess.filter((acc) => accessChange.data.find((change) => change.newEntry.website.websiteOrigin === acc.website.websiteOrigin)?.removed !== true)
		return withEntriesRemoved.map((entry) => {
			const changeForEntry = accessChange.data.find((change) => change.newEntry.website.websiteOrigin === entry.website.websiteOrigin)
			if (changeForEntry === undefined) return entry
			return changeForEntry.newEntry
		})
	})

	updateWebsiteApprovalAccesses(simulator, websiteTabConnections, await getSettings())
	return await sendPopupMessageToOpenWindows({ method: 'popup_interceptor_access_changed' })
}

export const changePage = async (page: ChangePage) => await setPage(page.data)

export async function requestAccountsFromSigner(websiteTabConnections: WebsiteTabConnections, params: RequestAccountsFromSigner) {
	if (params.data) {
		sendMessageToApprovedWebsitePorts(websiteTabConnections, { method: 'request_signer_to_eth_requestAccounts', result: [] })
		sendMessageToApprovedWebsitePorts(websiteTabConnections, { method: 'request_signer_chainId', result: [] })
	}
}

export async function removeTransactionOrSignedMessage(_: Simulator, params: RemoveTransaction, __: Settings) {
	await updateTransactionStack((prevStack: TransactionStack) => {
		switch (params.data.type) {
			case 'Transaction': {
				const transactionIdentifier = params.data.transactionIdentifier
				const transactionToBeRemoved = prevStack.transactions.find((transaction) => transaction.transactionIdentifier === transactionIdentifier)
				if (transactionToBeRemoved === undefined) return prevStack

				const newTransactions: PreSimulationTransaction[] = []
				let transactionWasFound = false

				for (const transaction of prevStack.transactions) {
					if (transactionIdentifier === transaction.transactionIdentifier) {
						transactionWasFound = true
						continue
					}
					const shouldUpdateNonce = transactionWasFound && transaction.signedTransaction.from === transactionToBeRemoved.signedTransaction.from
					const newTransaction = modifyObject(transaction.signedTransaction, shouldUpdateNonce ? { nonce: transaction.signedTransaction.nonce - 1n } : {})
					newTransactions.push({
						signedTransaction: newTransaction,
						website: transaction.website,
						created: transaction.created,
						originalRequestParameters: transaction.originalRequestParameters,
						transactionIdentifier: transaction.transactionIdentifier,
					})
				}
				return { ...prevStack, transactions: newTransactions }
			}
			case 'SignedMessage': {
				const messageIdentifier = params.data.messageIdentifier
				const numberOfMessages = prevStack.signedMessages.length
				const newSignedMessages = prevStack.signedMessages.filter((message) => message.messageIdentifier !== messageIdentifier)
				if (numberOfMessages === newSignedMessages.length) return prevStack
				return { ...prevStack, messages: newSignedMessages }
			}
			default: assertNever(params.data)
		}
	})
}


export async function refreshPopupConfirmTransactionMetadata(ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined) {
	const currentBlockNumberPromise = ethereumClientService.getBlockNumber(requestAbortController)
	const promises = await getPendingTransactionsAndMessages()
	const visualizedSimulatorStatePromise = getSimulationResults()
	const first = promises[0]
	if (first === undefined) return
	switch (first.type) {
		case 'SignableMessage': {
			const visualizedPersonalSignRequestPromise = craftPersonalSignPopupMessage(ethereumClientService, requestAbortController, first.signedMessageTransaction, ethereumClientService.getRpcEntry())
			const message: UpdateConfirmTransactionDialog = {
				method: 'popup_update_confirm_transaction_dialog',
				data: {
					visualizedSimulatorState: await visualizedSimulatorStatePromise,
					currentBlockNumber: await currentBlockNumberPromise,
				}
			}
			const messagePendingTransactions: UpdateConfirmTransactionDialogPendingTransactions = {
				method: 'popup_update_confirm_transaction_dialog_pending_transactions' as const,
				data: {
					pendingTransactionAndSignableMessages: [{
						...first,
						visualizedPersonalSignRequest: await visualizedPersonalSignRequestPromise,
						transactionOrMessageCreationStatus: 'Simulated' as const
					}, ...promises.slice(1)],
					currentBlockNumber: await currentBlockNumberPromise,
				}
			}
			return await Promise.all([
				sendPopupMessageToOpenWindows(messagePendingTransactions),
				sendPopupMessageToOpenWindows(serialize(UpdateConfirmTransactionDialog, message))
			])
		}
		case 'Transaction': {
			if (first.transactionOrMessageCreationStatus !== 'Simulated' || first.simulationResults.statusCode === 'failed') return
			const oldEventsForEachTransaction = first.simulationResults.data.eventsForEachTransaction
			const oldSimulatedAndVisualizedTransactions = first.simulationResults.data.simulatedAndVisualizedTransactions
			const simulationState = first.simulationResults.data.simulationState

			const eventsForEachTransaction = await Promise.all(oldEventsForEachTransaction.map(async (transactionsEvents) => await parseEvents(transactionsEvents.map((event) => event), ethereumClientService, requestAbortController)))
			const parsedInputData = await Promise.all(oldSimulatedAndVisualizedTransactions.map((transaction) => parseInputData({ to: transaction.transaction.to?.address, input: transaction.transaction.input, value: transaction.transaction.value }, ethereumClientService, requestAbortController)))
			const allEvents = eventsForEachTransaction.flat()
			const addressBookEntriesPromise = getAddressBookEntriesForVisualiser(ethereumClientService, requestAbortController, allEvents, parsedInputData, simulationState)
			const addressBookEntries = await addressBookEntriesPromise
			const messagePendingTransactions: UpdateConfirmTransactionDialogPendingTransactions = {
				method: 'popup_update_confirm_transaction_dialog_pending_transactions' as const,
				data: {
					pendingTransactionAndSignableMessages: [
						modifyObject(first,
							{
								simulationResults: {
									statusCode: 'success',
									data: modifyObject(first.simulationResults.data, {
										addressBookEntries,
										eventsForEachTransaction,
									})
								}
							})
						, ...promises.slice(1)],
					currentBlockNumber: await currentBlockNumberPromise,
				}
			}
			const message: UpdateConfirmTransactionDialog = {
				method: 'popup_update_confirm_transaction_dialog' as const,
				data: {
					visualizedSimulatorState: await visualizedSimulatorStatePromise,
					currentBlockNumber: await currentBlockNumberPromise,
				}
			}
			return await Promise.all([
				sendPopupMessageToOpenWindows(messagePendingTransactions),
				sendPopupMessageToOpenWindows(serialize(UpdateConfirmTransactionDialog, message))
			])
		}
		default: assertNever(first)
	}
}

export async function popupChangeActiveRpc(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, params: ChangeActiveChain) {
	return await changeActiveRpc(simulator, websiteTabConnections, params.data)
}

export async function changeChainDialog(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, chainChange: ChainChangeConfirmation) {
	await resolveChainChange(simulator, websiteTabConnections, chainChange)
}

export async function getAddressBookData(parsed: GetAddressBookData) {
	const data = await getMetadataForAddressBookData(parsed.data)
	await sendPopupMessageToOpenWindows({
		method: 'popup_getAddressBookDataReply',
		data: {
			data: parsed.data,
			entries: data.entries,
			maxDataLength: data.maxDataLength,
		}
	})
}

export const openNewTab = async (tabName: 'settingsView' | 'addressBook' | 'websiteAccess') => {
	const openInNewTab = async () => {
		const tab = await browser.tabs.create({ url: `/html/${tabName}V3.html` })
		if (tab.id !== undefined) await setIdsOfOpenedTabs({ [tabName]: tab.id })
	}

	const tabId = (await getIdsOfOpenedTabs())[tabName]
	if (tabId === undefined) return await openInNewTab()
	const allTabs = await browser.tabs.query({})
	const addressBookTab = allTabs.find((tab) => tab.id === tabId)

	if (addressBookTab?.id === undefined) return await openInNewTab()
	const tab = await updateTabIfExists(addressBookTab.id, { active: true, highlighted: true })
	if (tab === undefined) await openInNewTab()
}

export async function requestNewHomeData(simulator: Simulator, _: AbortController | undefined) {
	await refreshHomeData(simulator)
}

export async function refreshHomeData(simulator: Simulator) {
	const settingsPromise = getSettings()
	const rpcConnectionStatusPromise = getRpcConnectionStatus()
	const rpcEntriesPromise = getRpcList()
	const activeAddressesPromise = getActiveAddresses()
	const latestUnexpectedError = getLatestUnexpectedError()

	const visualizedSimulatorStatePromise: Promise<CompleteVisualizedSimulation> = getSimulationResults()
	const tabId = await getLastKnownCurrentTabId()
	const tabState = tabId === undefined ? await getTabState(-1) : await getTabState(tabId)
	const settings = await settingsPromise
	if (settings.activeRpcNetwork.httpsRpc !== undefined) makeSureInterceptorIsNotSleeping(simulator.ethereum)
	const websiteOrigin = tabState.website?.websiteOrigin
	const interceptorDisabled = websiteOrigin === undefined ? false : settings.websiteAccess.find((entry) => entry.website.websiteOrigin === websiteOrigin && entry.interceptorDisabled === true) !== undefined
	const updatedPage: UpdateHomePage = {
		method: 'popup_UpdateHomePage' as const,
		data: {
			visualizedSimulatorState: await visualizedSimulatorStatePromise,
			activeAddresses: await activeAddressesPromise,
			websiteAccessAddressMetadata: await getAddressMetadataForAccess(settings.websiteAccess),
			tabState,
			activeSigningAddressInThisTab: tabState?.activeSigningAddress,
			currentBlockNumber: simulator.ethereum.getCachedBlock()?.number,
			settings: settings,
			rpcConnectionStatus: await rpcConnectionStatusPromise,
			tabId,
			rpcEntries: await rpcEntriesPromise,
			interceptorDisabled,
			latestUnexpectedError: await latestUnexpectedError,
		}
	}
	await sendPopupMessageToOpenWindows(serialize(UpdateHomePage, updatedPage))
}

export async function interceptorAccessChangeAddressOrRefresh(websiteTabConnections: WebsiteTabConnections, params: InterceptorAccessChangeAddress | InterceptorAccessRefresh) {
	await requestAddressChange(websiteTabConnections, params)
}

export async function setNewRpcList(simulator: Simulator, request: SetRpcList, settings: Settings) {
	await setRpcList(request.data)
	await sendPopupMessageToOpenWindows({ method: 'popup_update_rpc_list', data: request.data })
	const primary = await getPrimaryRpcForChain(settings.activeRpcNetwork.chainId)
	if (primary !== undefined) {
		// reset to primary on update
		simulator.reset(primary)
	}
}

export async function changeAddOrModifyAddressWindowState(ethereum: EthereumClientService, parsedRequest: ChangeAddOrModifyAddressWindowState) {
	const updatePage = async (newState: ModifyAddressWindowState) => {
		const currentPage = await getPage()
		if ((currentPage.page === 'AddNewAddress' || currentPage.page === 'ModifyAddress') && currentPage.state.windowStateId === parsedRequest.data.windowStateId) {
			await setPage({ page: currentPage.page, state: newState })
		}
	}
	await updatePage(parsedRequest.data.newState)

	const identifyAddressCandidate = async (addressCandidate: string | undefined) => {
		if (addressCandidate === undefined) return undefined
		const address = EthereumAddress.safeParse(addressCandidate.trim())
		if (address.success === false) return undefined
		return await identifyAddress(ethereum, undefined, address.value)
	}
	const identifyPromise = identifyAddressCandidate(parsedRequest.data.newState.incompleteAddressBookEntry.address)
	
	return await sendPopupMessageToOpenWindows({
		method: 'popup_addOrModifyAddressWindowStateInformation',
		data: { windowStateId: parsedRequest.data.windowStateId, errorState: { message: '', blockEditing: false }, identifiedAddress: await identifyPromise }
	})
}

export async function openWebPage(parsedRequest: OpenWebPage) {
	const allTabs = await browser.tabs.query({})
	const addressBookTab = allTabs.find((tab) => tab.id === parsedRequest.data.websiteSocket.tabId)
	if (addressBookTab === undefined) return await browser.tabs.create({ url: parsedRequest.data.url, active: true })
	try {
		browser.tabs.update(parsedRequest.data.websiteSocket.tabId, { url: parsedRequest.data.url, active: true })
		checkAndThrowRuntimeLastError()
	} catch (error) {
		console.warn('Failed to update tab with new webpage')
		// biome-ignore lint/suspicious/noConsoleLog: <used for support debugging>
		console.log({ error })
	}
	finally {
		return await browser.tabs.create({ url: parsedRequest.data.url, active: true })
	}
}

// reload all connected tabs of the same origin and the current webpage
async function reloadConnectedTabs(websiteTabConnections: WebsiteTabConnections) {
	const tabIdsToRefesh = Array.from(websiteTabConnections.entries()).map(([tabId]) => tabId)
	const currentTabId = await getLastKnownCurrentTabId()
	const withCurrentTabid = currentTabId === undefined ? tabIdsToRefesh : [...tabIdsToRefesh, currentTabId]
	for (const tabId of new Set(withCurrentTabid)) {
		try {
			await browser.tabs.reload(tabId)
			checkAndThrowRuntimeLastError()
		} catch (e) {
			console.warn('Failed to reload tab')
			console.warn(e)
		}
	}
}

export async function retrieveWebsiteAccess(parsedRequest: RetrieveWebsiteAccess) {
	const settings = await getSettings()
	const websiteAccess = searchWebsiteAccess(parsedRequest.data.query, settings.websiteAccess)
	const addressAccessMetadata = await getAddressMetadataForAccess(websiteAccess)

	await sendPopupMessageToOpenWindows({
		method: 'popup_retrieveWebsiteAccessReply',
		data: {
			websiteAccess,
			addressAccessMetadata
		}
	})
}

async function blockOrAllowWebsiteExternalRequests(websiteTabConnections: WebsiteTabConnections, website: Website, shouldBlock: boolean) {
	await updateWebsiteAccess((previousAccessList) => {
		return previousAccessList.map((access) => {
			if (access.website.websiteOrigin !== website.websiteOrigin) return access
			return modifyObject(access, { declarativeNetRequestBlockMode: shouldBlock ? 'block-all' : 'disabled' })
		})
	})

	await reloadConnectedTabs(websiteTabConnections)
}

export async function blockOrAllowExternalRequests(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, parsedRequest: BlockOrAllowExternalRequests) {
	await blockOrAllowWebsiteExternalRequests(websiteTabConnections, parsedRequest.data.website, parsedRequest.data.shouldBlock)
	updateWebsiteApprovalAccesses(simulator, websiteTabConnections, await getSettings())
	return await sendPopupMessageToOpenWindows({ method: 'popup_websiteAccess_changed' })
}

async function setAdressAccessForWebsite(websiteOrigin: string, address: EthereumAddress, allowAccess: boolean) {
	await updateWebsiteAccess((previousAccessList) => {
		return previousAccessList.map((access) => {
			if (access.website.websiteOrigin !== websiteOrigin || access.addressAccess === undefined) return access
			const addressAccessList = access.addressAccess.map(addressAccess => (addressAccess.address !== address) ? addressAccess : modifyObject(addressAccess, { access: allowAccess }))
			return modifyObject(access, { addressAccess: addressAccessList })
		})
	})
}

export async function allowOrPreventAddressAccessForWebsite(websiteTabConnections: WebsiteTabConnections, parsedRequest: AllowOrPreventAddressAccessForWebsite) {
	const { website, address, allowAccess } = parsedRequest.data
	await setAdressAccessForWebsite(website.websiteOrigin, address, allowAccess)
	await reloadConnectedTabs(websiteTabConnections)
	return await sendPopupMessageToOpenWindows({ method: 'popup_websiteAccess_changed' })
}

export async function forceSetGasLimitForTransaction(_: Simulator, parsedRequest: ForceSetGasLimitForTransaction) {
	await setGasLimitForTransaction(parsedRequest.data.transactionIdentifier, parsedRequest.data.gasLimit)
}
