import 'webextension-polyfill'
import { Simulator } from '../simulation/simulator.js'
import { EthGetStorageAtParams, EthereumJsonRpcRequest, SendRawTransactionParams, SendTransactionParams, SupportedEthereumJsonRpcRequestMethods, WalletAddEthereumChain } from '../types/JsonRpc-types.js'
import { InpageScriptRequest, PopupMessage, RPCReply, Settings } from '../types/interceptor-messages.js'
import { RpcNetwork } from '../types/rpc.js'
import { WebsiteTabConnections } from '../types/user-interface-types.js'
import { SimulationState } from '../types/visualizer-types.js'
import { Website } from '../types/websiteAccessTypes.js'
import { serialize } from '../types/wire-types.js'
import { ERROR_INTERCEPTOR_DISABLED, METAMASK_ERROR_FAILED_TO_PARSE_REQUEST, METAMASK_ERROR_NOT_AUTHORIZED, METAMASK_ERROR_NOT_CONNECTED_TO_CHAIN } from '../utils/constants.js'
import { handleUnexpectedError, isFailedToFetchError, isNewBlockAbort } from '../utils/errors.js'
import { InterceptedRequest, WebsiteSocket } from '../utils/requests.js'
import { Semaphore } from '../utils/semaphore.js'
import { assertNever } from '../utils/typescript.js'
import { sendActiveAccountChangeToApprovedWebsitePorts, sendMessageToApprovedWebsitePorts, updateWebsiteApprovalAccesses, verifyAccess } from './accessManagement.js'
import { getActiveAddress, sendPopupMessageToOpenWindows } from './backgroundUtils.js'
import { replyToInterceptedRequest } from './messageSending.js'
import { getActiveAddressEntry } from './metadataUtils.js'
import { addOrModifyAddressBookEntry, allowOrPreventAddressAccessForWebsite, blockOrAllowExternalRequests, changeActiveAddress, changeAddOrModifyAddressWindowState, changeChainDialog, changeInterceptorAccess, changePage, confirmDialog, confirmRequestAccess, forceSetGasLimitForTransaction, getAddressBookData, interceptorAccessChangeAddressOrRefresh, openNewTab, openWebPage, popupChangeActiveRpc, refreshHomeData, refreshPopupConfirmTransactionMetadata, removeAddressBookEntry, removeTransactionOrSignedMessage, requestAccountsFromSigner, setNewRpcList } from './popupMessageHandlers.js'
import { connectedToSigner, ethAccountsReply, signerChainChanged, signerReply, walletSwitchEthereumChainReply } from './providerMessageHandlers.js'
import { getSettings } from './settings.js'
import { blockNumber, call, chainId, estimateGas, gasPrice, getAccounts, getBalance, getBlockByHash, getBlockByNumber, getTransactionByHash, getTransactionCount, getTransactionReceipt, handleIterceptorError, netVersion, personalSign, sendTransaction, web3ClientVersion } from './simulationModeHanders.js'
import { makeSureInterceptorIsNotSleeping } from './sleeping.js'
import { promoteRpcAsPrimary, setLatestUnexpectedError } from './storageVariables.js'
import { updateChainChangeViewWithPendingRequest } from './windows/changeChain.js'
import { updateConfirmTransactionView } from './windows/confirmTransaction.js'
import { askForSignerAccountsFromSignerIfNotAvailable, interceptorAccessMetadataRefresh, requestAccessFromUser, updateInterceptorAccessViewWithPendingRequests } from './windows/interceptorAccess.js'

let confirmTransactionAbortController = new AbortController()

async function handleRPCRequest(
	simulator: Simulator,
	simulationState: SimulationState | undefined,
	websiteTabConnections: WebsiteTabConnections,
	_: WebsiteSocket,
	website: Website,
	request: InterceptedRequest,
	settings: Settings,
	activeAddress: bigint | undefined,
): Promise<RPCReply> {
	console.log('handleRPCRequest received request:', request)
	const maybeParsedRequest = EthereumJsonRpcRequest.safeParse(request)
	const forwardToSigner = !request.usingInterceptorWithoutSigner
	const getForwardingMessage = (request: SendRawTransactionParams | SendTransactionParams | WalletAddEthereumChain | EthGetStorageAtParams) => {
		if (!forwardToSigner) throw new Error('Should not forward to signer')
		return { type: 'forwardToSigner' as const, ...request }
	}

	if (maybeParsedRequest.success === false) {
		// biome-ignore lint/suspicious/noConsoleLog: <Used for support debugging>
		console.log({ request })
		console.warn(maybeParsedRequest.fullError)
		const maybePartiallyParsedRequest = SupportedEthereumJsonRpcRequestMethods.safeParse(request)
		// the method is some method that we are not supporting, forward it to the wallet if signer is available
		if (maybePartiallyParsedRequest.success === false && forwardToSigner) return { type: 'forwardToSigner' as const, replyWithSignersReply: true, ...request }
		return {
			type: 'result' as const,
			method: request.method,
			error: {
				message: `Failed to parse RPC request: ${ JSON.stringify(serialize(InterceptedRequest, request)) }`,
				data: maybeParsedRequest.fullError === undefined ? 'Failed to parse RPC request' : maybeParsedRequest.fullError.toString(),
				code: METAMASK_ERROR_FAILED_TO_PARSE_REQUEST,
			}
		}
	}
	if (settings.activeRpcNetwork.httpsRpc === undefined && forwardToSigner) {
		// we are using network that is not supported by us
		return { type: 'forwardToSigner' as const, replyWithSignersReply: true, ...request }
	}
	const parsedRequest = maybeParsedRequest.value
	makeSureInterceptorIsNotSleeping(simulator.ethereum)
	switch (parsedRequest.method) {
		case 'eth_getBlockByHash': return await getBlockByHash(simulator.ethereum, simulationState, parsedRequest)
		case 'eth_getBlockByNumber': return await getBlockByNumber(simulator.ethereum, simulationState, parsedRequest)
		case 'eth_getBalance': return await getBalance(simulator.ethereum, simulationState, parsedRequest)
		case 'eth_estimateGas': return await estimateGas(simulator.ethereum, simulationState, parsedRequest)
		case 'eth_getTransactionByHash': return await getTransactionByHash(simulator.ethereum, simulationState, parsedRequest)
		case 'eth_getTransactionReceipt': return await getTransactionReceipt(simulator.ethereum, simulationState, parsedRequest)
		case 'eth_call': return await call(simulator.ethereum, simulationState, parsedRequest)
		case 'eth_blockNumber': return await blockNumber(simulator.ethereum, simulationState)
		case 'eth_chainId': return await chainId(simulator.ethereum)
		case 'net_version': return await netVersion(simulator.ethereum)
		case 'personal_sign':
		case 'eth_signTypedData':
		case 'eth_signTypedData_v1':
		case 'eth_signTypedData_v2':
		case 'eth_signTypedData_v3':
		case 'eth_signTypedData_v4': return await personalSign(simulator, activeAddress, simulator.ethereum, parsedRequest, request, website, websiteTabConnections)
		case 'eth_accounts': return await getAccounts(activeAddress)
		case 'eth_requestAccounts': return await getAccounts(activeAddress)
		case 'eth_gasPrice': return await gasPrice(simulator.ethereum)
		case 'eth_getTransactionCount': return await getTransactionCount(simulator.ethereum, simulationState, parsedRequest)
		case 'wallet_addEthereumChain': {
			if (forwardToSigner) return getForwardingMessage(parsedRequest)
			return { type: 'result' as const, method: parsedRequest.method, error: { code: 10000, message: 'wallet_addEthereumChain not implemented' } }
		}
		case 'eth_getStorageAt': {
			if (forwardToSigner) return getForwardingMessage(parsedRequest)
			return { type: 'result' as const, method: parsedRequest.method, error: { code: 10000, message: 'eth_getStorageAt not implemented' } }
		}
		case 'eth_sign': return { type: 'result' as const,method: parsedRequest.method, error: { code: 10000, message: 'eth_sign is deprecated' } }
		case 'eth_sendRawTransaction':
		case 'eth_sendTransaction': {
			if (forwardToSigner && settings.activeRpcNetwork.httpsRpc === undefined) return getForwardingMessage(parsedRequest)
			return await sendTransaction(simulator, activeAddress, parsedRequest, request, website, websiteTabConnections)
		}
		case 'web3_clientVersion': return await web3ClientVersion(simulator.ethereum)
		case 'InterceptorError': return await handleIterceptorError(parsedRequest)
		default: return { type: 'result' as const, method: parsedRequest.method, error: { code: 10000, message: 'Method not implemented' } }
	}
}

const changeActiveAddressAndChainAndResetSimulationSemaphore = new Semaphore(1)
export async function changeActiveAddressAndChainAndResetSimulation(
	simulator: Simulator,
	websiteTabConnections: WebsiteTabConnections,
	change: {
		activeAddress?: bigint,
		rpcNetwork?: RpcNetwork,
	},
) {
	const updatedSettings = await getSettings()
	sendPopupMessageToOpenWindows({ method: 'popup_settingsUpdated', data: updatedSettings })
	updateWebsiteApprovalAccesses(simulator, websiteTabConnections, updatedSettings)
	sendPopupMessageToOpenWindows({ method: 'popup_accounts_update' })
	await sendActiveAccountChangeToApprovedWebsitePorts(websiteTabConnections, updatedSettings)

	await changeActiveAddressAndChainAndResetSimulationSemaphore.execute(async () => {
		if (change.rpcNetwork !== undefined) {
			if (change.rpcNetwork.httpsRpc !== undefined) simulator.reset(change.rpcNetwork)
			sendMessageToApprovedWebsitePorts(websiteTabConnections, { method: 'chainChanged' as const, result: change.rpcNetwork.chainId })
			sendPopupMessageToOpenWindows({ method: 'popup_chain_update' })
		}

		// inform website about this only after we have updated simulation, as they often query the balance right after
		sendActiveAccountChangeToApprovedWebsitePorts(websiteTabConnections, await getSettings())
	})
}

export async function changeActiveRpc(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, rpcNetwork: RpcNetwork) {
	// allow switching RPC only if we are in simulation mode, or that chain id would not change
	if (rpcNetwork.chainId === (await getSettings()).activeRpcNetwork.chainId) return await changeActiveAddressAndChainAndResetSimulation(simulator, websiteTabConnections, { rpcNetwork })
	sendMessageToApprovedWebsitePorts(websiteTabConnections, { method: 'request_signer_to_wallet_switchEthereumChain', result: rpcNetwork.chainId })
	await sendPopupMessageToOpenWindows({ method: 'popup_settingsUpdated', data: await getSettings() })
	await promoteRpcAsPrimary(rpcNetwork)
}

function getProviderHandler(method: string) {
	switch (method) {
		case 'signer_reply': return { method: 'signer_reply' as const, func: signerReply }
		case 'eth_accounts_reply': return { method: 'eth_accounts_reply' as const, func: ethAccountsReply }
		case 'signer_chainChanged': return { method: 'signer_chainChanged' as const, func: signerChainChanged }
		case 'wallet_switchEthereumChain_reply': return { method: 'wallet_switchEthereumChain_reply' as const, func: walletSwitchEthereumChainReply }
		case 'connected_to_signer': return { method: 'connected_to_signer' as const, func: connectedToSigner }
		default: return { method: 'notProviderMethod' as const }
	}
}

export const handleInterceptedRequest = async (port: browser.runtime.Port | undefined, websiteOrigin: string, websitePromise: Promise<Website> | Website, simulator: Simulator, socket: WebsiteSocket, request: InterceptedRequest, websiteTabConnections: WebsiteTabConnections): Promise<unknown> => {
	const activeAddress = await getActiveAddress(await getSettings(), socket.tabId)
	const access = verifyAccess(websiteTabConnections, socket, request.method === 'eth_requestAccounts' || request.method === 'eth_call', websiteOrigin, activeAddress, await getSettings())
	if (access === 'interceptorDisabled') return replyToInterceptedRequest(websiteTabConnections, { type: 'result', ...request, ...ERROR_INTERCEPTOR_DISABLED })
	const providerHandler = getProviderHandler(request.method)
	const identifiedMethod = providerHandler.method
	if (identifiedMethod !== 'notProviderMethod') {
		if (port === undefined) return
		const providerHandlerReturn = await providerHandler.func(simulator, websiteTabConnections, port, request, access, activeAddress?.address)
		if (providerHandlerReturn.type === 'doNotReply') return
		const message: InpageScriptRequest = { uniqueRequestIdentifier: request.uniqueRequestIdentifier, ...providerHandlerReturn }
		return replyToInterceptedRequest(websiteTabConnections, message)
	}
	if (access === 'hasAccess' && activeAddress === undefined && request.method === 'eth_requestAccounts') {
		// user has granted access to the site, but not to this account and the application is requesting accounts
		const account = await askForSignerAccountsFromSignerIfNotAvailable(websiteTabConnections, socket)
		if (account.length === 0) return refuseAccess(websiteTabConnections, request)
		const result: unknown = await handleInterceptedRequest(port, websiteOrigin, websitePromise, simulator, socket, request, websiteTabConnections)
		return result
	}

	if (access === 'noAccess' || activeAddress === undefined) {
		switch (request.method) {
			case 'eth_accounts': return replyToInterceptedRequest(websiteTabConnections, { type: 'result', method: 'eth_accounts' as const, result: [], uniqueRequestIdentifier: request.uniqueRequestIdentifier })
			// if user has not given access, assume we are on chain 1
			case 'eth_chainId': return replyToInterceptedRequest(websiteTabConnections, { type: 'result', method: request.method, result: 1n, uniqueRequestIdentifier: request.uniqueRequestIdentifier })
			case 'net_version': return replyToInterceptedRequest(websiteTabConnections, { type: 'result', method: request.method, result: 1n, uniqueRequestIdentifier: request.uniqueRequestIdentifier })
			default: break
		}
	}

	console.log('handleInterceptedRequest received request:', {
		method: request.method,
		uniqueRequestIdentifier: request.uniqueRequestIdentifier
	})

	switch (access) {
		case 'askAccess': return await gateKeepRequestBehindAccessDialog(simulator, websiteTabConnections, socket, request, await websitePromise, activeAddress?.address, await getSettings())
		case 'noAccess': return refuseAccess(websiteTabConnections, request)
		case 'hasAccess': {
			if (activeAddress === undefined) return refuseAccess(websiteTabConnections, request)
			return await handleContentScriptMessage(simulator, websiteTabConnections, request, await websitePromise, activeAddress?.address)
		}
		default: assertNever(access)
	}
}

async function handleContentScriptMessage(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, request: InterceptedRequest, website: Website, activeAddress: bigint | undefined) {
	console.log('handleContentScriptMessage received request:', {
		method: request.method,
		uniqueRequestIdentifier: request.uniqueRequestIdentifier
	})
	try {
		const settings = await getSettings()
		const simulationState = undefined
		const resolved = await handleRPCRequest(simulator, simulationState, websiteTabConnections, request.uniqueRequestIdentifier.requestSocket, website, request, settings, activeAddress)
		return replyToInterceptedRequest(websiteTabConnections, { ...request, ...resolved })
	} catch (error) {
		if (error instanceof Error && isFailedToFetchError(error)) {
			return replyToInterceptedRequest(websiteTabConnections, { type: 'result', ...request, ...METAMASK_ERROR_NOT_CONNECTED_TO_CHAIN })
		}
		handleUnexpectedError(error)
		return replyToInterceptedRequest(websiteTabConnections, {
			type: 'result',
			...request,
			error: {
				code: 123456,
				message: 'Unknown error'
			},
		})
	}
}

export function refuseAccess(websiteTabConnections: WebsiteTabConnections, request: InterceptedRequest) {
	return replyToInterceptedRequest(websiteTabConnections, {
		type: 'result',
		...request,
		error: {
			code: METAMASK_ERROR_NOT_AUTHORIZED,
			message: 'The requested method and/or account has not been authorized by the user.'
		},
	})
}

async function gateKeepRequestBehindAccessDialog(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, socket: WebsiteSocket, request: InterceptedRequest, website: Website, currentActiveAddress: bigint | undefined, settings: Settings) {
	const activeAddress = currentActiveAddress !== undefined ? await getActiveAddressEntry(currentActiveAddress) : undefined
	return await requestAccessFromUser(simulator, websiteTabConnections, socket, website, request, activeAddress, settings, currentActiveAddress)
}

export async function popupMessageHandler(
	websiteTabConnections: WebsiteTabConnections,
	simulator: Simulator,
	request: unknown,
	settings: Settings
) {
	const maybeParsedRequest = PopupMessage.safeParse(request)
	if (maybeParsedRequest.success === false) {
		// biome-ignore lint/suspicious/noConsoleLog: <Used for support debugging>
		console.log({ request })
		console.warn(maybeParsedRequest.fullError)
		return {
			error: {
				message: maybeParsedRequest.fullError === undefined ? 'Unknown parsing error' : maybeParsedRequest.fullError.toString(),
				code: METAMASK_ERROR_FAILED_TO_PARSE_REQUEST,
			}
		}
	}
	const parsedRequest = maybeParsedRequest.value
	try {
		switch (parsedRequest.method) {
			case 'popup_confirmDialog': return await confirmDialog(simulator, websiteTabConnections, parsedRequest)
			case 'popup_changeActiveAddress': return await changeActiveAddress(simulator, websiteTabConnections, parsedRequest)
			case 'popup_changePage': return await changePage(parsedRequest)
			case 'popup_requestAccountsFromSigner': return await requestAccountsFromSigner(websiteTabConnections, parsedRequest)
			case 'popup_removeTransactionOrSignedMessage': return await removeTransactionOrSignedMessage(simulator, parsedRequest, settings)
			case 'popup_refreshConfirmTransactionMetadata': return refreshPopupConfirmTransactionMetadata(simulator.ethereum, confirmTransactionAbortController)
			case 'popup_interceptorAccess': return await confirmRequestAccess(simulator, websiteTabConnections, parsedRequest)
			case 'popup_changeInterceptorAccess': return await changeInterceptorAccess(simulator, websiteTabConnections, parsedRequest)
			case 'popup_changeActiveRpc': return await popupChangeActiveRpc(simulator, websiteTabConnections, parsedRequest)
			case 'popup_changeChainDialog': return await changeChainDialog(simulator, websiteTabConnections, parsedRequest)
			case 'popup_addOrModifyAddressBookEntry': return await addOrModifyAddressBookEntry(simulator, websiteTabConnections, parsedRequest)
			case 'popup_getAddressBookData': return await getAddressBookData(parsedRequest)
			case 'popup_removeAddressBookEntry': return await removeAddressBookEntry(simulator, websiteTabConnections, parsedRequest)
			case 'popup_openAddressBook': return await openNewTab('addressBook')
			case 'popup_changeChainReadyAndListening': return await updateChainChangeViewWithPendingRequest()
			case 'popup_interceptorAccessReadyAndListening': return await updateInterceptorAccessViewWithPendingRequests()
			case 'popup_confirmTransactionReadyAndListening': return await updateConfirmTransactionView(simulator.ethereum)
			case 'popup_refreshHomeData': return await refreshHomeData(simulator)
			case 'popup_refreshInterceptorAccessMetadata': return await interceptorAccessMetadataRefresh()
			case 'popup_interceptorAccessChangeAddress': return await interceptorAccessChangeAddressOrRefresh(websiteTabConnections, parsedRequest)
			case 'popup_interceptorAccessRefresh': return await interceptorAccessChangeAddressOrRefresh(websiteTabConnections, parsedRequest)
			case 'popup_set_rpc_list': return await setNewRpcList(simulator, parsedRequest, settings)
			case 'popup_changeAddOrModifyAddressWindowState': return await changeAddOrModifyAddressWindowState(simulator.ethereum, parsedRequest)
			case 'popup_openWebPage': return await openWebPage(parsedRequest)
			case 'popup_clearUnexpectedError': return await setLatestUnexpectedError(undefined)
			case 'popup_blockOrAllowExternalRequests': return await blockOrAllowExternalRequests(simulator, websiteTabConnections, parsedRequest)
			case 'popup_allowOrPreventAddressAccessForWebsite': return await allowOrPreventAddressAccessForWebsite(websiteTabConnections, parsedRequest)
			case 'popup_forceSetGasLimitForTransaction': return await forceSetGasLimitForTransaction(simulator, parsedRequest)
			default: return { type: 'result' as const, method: parsedRequest.method }
		}
	} catch(error: unknown) {
		if (error instanceof Error && (isNewBlockAbort(error) || isFailedToFetchError(error))) return
		throw error
	}
}
