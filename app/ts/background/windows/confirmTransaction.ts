import { ethers, keccak256, toUtf8Bytes } from 'ethers'
import * as funtypes from 'funtypes'
import { closePopupOrTabById, getPopupOrTabById, openPopupOrTab, tryFocusingTabOrWindow } from '../../components/ui-utils.js'
import { EthereumClientService } from '../../simulation/services/EthereumClientService.js'
import { Simulator } from '../../simulation/simulator.js'
import { PendingTransactionOrSignableMessage } from '../../types/accessRequest.js'
import { TransactionConfirmation, UpdateConfirmTransactionDialog, UpdateConfirmTransactionDialogPendingTransactions } from '../../types/interceptor-messages.js'
import { SignMessageParams } from '../../types/jsonRpc-signing-types.js'
import { SendRawTransactionParams, SendTransactionParams } from '../../types/JsonRpc-types.js'
import { WebsiteTabConnections } from '../../types/user-interface-types.js'
import { WebsiteCreatedEthereumUnsignedTransaction } from '../../types/visualizer-types.js'
import { PopupOrTabId, Website } from '../../types/websiteAccessTypes.js'
import { EthereumAddress, EthereumBytes32, EthereumQuantity, serialize } from '../../types/wire-types.js'
import { dataStringWith0xStart, stringToUint8Array } from '../../utils/bigint.js'
import { ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS, METAMASK_ERROR_USER_REJECTED_REQUEST } from '../../utils/constants.js'
import { handleUnexpectedError, printError } from '../../utils/errors.js'
import { InterceptedRequest, UniqueRequestIdentifier, doesUniqueRequestIdentifiersMatch, getUniqueRequestIdentifierString } from '../../utils/requests.js'
import { Semaphore } from '../../utils/semaphore.js'
import { modifyObject } from '../../utils/typescript.js'
import { sendPopupMessageToOpenWindows } from '../backgroundUtils.js'
import { replyToInterceptedRequest } from '../messageSending.js'
import { appendPendingTransactionOrMessage, clearPendingTransactions, getPendingTransactionsAndMessages, removePendingTransactionOrMessage, updatePendingTransactionOrMessage } from '../storageVariables.js'
import { craftPersonalSignPopupMessage } from './personalSign.js'

const pendingConfirmationSemaphore = new Semaphore(1)

export async function updateConfirmTransactionView(ethereumClientService: EthereumClientService) {
	const currentBlockNumberPromise = ethereumClientService.getBlockNumber(undefined)
	const pendingTransactionAndSignableMessages = await getPendingTransactionsAndMessages()
	if (pendingTransactionAndSignableMessages.length === 0) return false
	const message: UpdateConfirmTransactionDialog = {
		method: 'popup_update_confirm_transaction_dialog', data: {
			currentBlockNumber: await currentBlockNumberPromise,
			visualizedSimulatorState: undefined,
		}
	}
	const messagePendingTransactions: UpdateConfirmTransactionDialogPendingTransactions = {
		method: 'popup_update_confirm_transaction_dialog_pending_transactions' as const,
		data: {
			pendingTransactionAndSignableMessages,
			currentBlockNumber: await currentBlockNumberPromise,
		}
	}
	await Promise.all([
		sendPopupMessageToOpenWindows(messagePendingTransactions),
		sendPopupMessageToOpenWindows(serialize(UpdateConfirmTransactionDialog, message))
	])
	return true
}

export const isConfirmTransactionFocused = async () => {
	const pendingTransactions = await getPendingTransactionsAndMessages()
	if (pendingTransactions[0] === undefined) return false
	const popup = await getPopupOrTabById(pendingTransactions[0].popupOrTabId)
	if (popup === undefined) return false
	if (popup.type === 'popup') return popup.window.focused
	return popup.tab.active
}

const getPendingTransactionOrMessageByidentifier = async (uniqueRequestIdentifier: UniqueRequestIdentifier) => {
	console.log('getPendingTransactionOrMessageByidentifier received uniqueRequestIdentifier:', uniqueRequestIdentifier)
	console.log('getPendingTransactionsAndMessages:', await getPendingTransactionsAndMessages())
	return (await getPendingTransactionsAndMessages()).find((tx) => doesUniqueRequestIdentifiersMatch(tx.uniqueRequestIdentifier, uniqueRequestIdentifier))
}

export const setGasLimitForTransaction = async (transactionIdentifier: BigInt, gasLimit: bigint) => {
	const pendingTransaction = (await getPendingTransactionsAndMessages()).find((tx) => tx.type === 'Transaction' && tx.transactionIdentifier === transactionIdentifier)
	if (pendingTransaction === undefined) return
	await updatePendingTransactionOrMessage(pendingTransaction.uniqueRequestIdentifier, async (transaction) => {
		if (transaction.originalRequestParameters.method === 'eth_sendTransaction') {
			const originalRequestParameters = modifyObject(transaction.originalRequestParameters, { params: [modifyObject(transaction.originalRequestParameters.params[0], { gas: gasLimit })] })
			return modifyObject(transaction, { originalRequestParameters: originalRequestParameters })
		}
		return transaction
	})
}

export async function resolvePendingTransactionOrMessage(simulator: Simulator, websiteTabConnections: WebsiteTabConnections, confirmation: TransactionConfirmation) {

	const pendingTransactionOrMessage = await getPendingTransactionOrMessageByidentifier(confirmation.data.uniqueRequestIdentifier)
	if (pendingTransactionOrMessage === undefined) {
		console.log('No pending transaction found - returning')
		alert('No pending transaction found - returning')
		return // no need to resolve as it doesn't exist anymore
	}

	const reply = (message: { type: 'forwardToSigner' } | { type: 'result', error: { code: number, message: string } } | { type: 'result', result: unknown }) => {
		if (message.type === 'result' && !('error' in message)) {
			if (pendingTransactionOrMessage.originalRequestParameters.method === 'eth_sendRawTransaction' || pendingTransactionOrMessage.originalRequestParameters.method === 'eth_sendTransaction') {
				return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, ...message, result: EthereumBytes32.parse(message.result), uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
			}
			return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, ...message, result: funtypes.String.parse(message.result), uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
		}
		return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, ...message, uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
	}

	if (confirmation.data.action === 'accept') {
		await updatePendingTransactionOrMessage(confirmation.data.uniqueRequestIdentifier, async (transaction) => modifyObject(transaction, { approvalStatus: { status: 'WaitingForSigner' } }))
		await updateConfirmTransactionView(simulator.ethereum)
		return replyToInterceptedRequest(websiteTabConnections, { ...pendingTransactionOrMessage.originalRequestParameters, type: 'forwardToSigner', uniqueRequestIdentifier: confirmation.data.uniqueRequestIdentifier })
	}

	await removePendingTransactionOrMessage(confirmation.data.uniqueRequestIdentifier)
	if ((await getPendingTransactionsAndMessages()).length === 0) await tryFocusingTabOrWindow({ type: 'tab', id: pendingTransactionOrMessage.uniqueRequestIdentifier.requestSocket.tabId })
	if (!(await updateConfirmTransactionView(simulator.ethereum))) await closePopupOrTabById(pendingTransactionOrMessage.popupOrTabId)

	if (confirmation.data.action === 'noResponse') return reply(formRejectMessage(undefined))

	if (confirmation.data.action === 'signerIncluded') return reply({ type: 'result', result: confirmation.data.signerReply })
	return reply({ type: 'forwardToSigner' })
}

export const onCloseWindowOrTab = async (popupOrTabs: PopupOrTabId, simulator: Simulator, websiteTabConnections: WebsiteTabConnections) => { // check if user has closed the window on their own, if so, reject all signatures
	const transactions = await getPendingTransactionsAndMessages()
	const [firstTransaction] = transactions
	if (firstTransaction?.popupOrTabId.id !== popupOrTabs.id) return
	await resolveAllPendingTransactionsAndMessageAsNoResponse(transactions, simulator, websiteTabConnections)
}

const resolveAllPendingTransactionsAndMessageAsNoResponse = async (transactions: readonly PendingTransactionOrSignableMessage[], simulator: Simulator, websiteTabConnections: WebsiteTabConnections) => {
	for (const transaction of transactions) {
		try {
			await resolvePendingTransactionOrMessage(simulator, websiteTabConnections, { method: 'popup_confirmDialog', data: { uniqueRequestIdentifier: transaction.uniqueRequestIdentifier, action: 'noResponse' } })
		} catch (e) {
			printError(e)
		}
	}
	await clearPendingTransactions()
}

const formRejectMessage = (errorString: undefined | string) => {
	return {
		type: 'result' as const,
		error: {
			code: METAMASK_ERROR_USER_REJECTED_REQUEST,
			message: errorString === undefined ? 'Interceptor Tx Signature: User denied transaction signature.' : `Interceptor Tx Signature: User denied reverting transaction: ${errorString}.`
		}
	}
}

export const formSendRawTransaction = async (ethereumClientService: EthereumClientService, sendRawTransactionParams: SendRawTransactionParams, website: Website, created: Date, transactionIdentifier: EthereumQuantity): Promise<WebsiteCreatedEthereumUnsignedTransaction> => {
	const ethersTransaction = ethers.Transaction.from(dataStringWith0xStart(sendRawTransactionParams.params[0]))
	const transactionDetails = {
		from: EthereumAddress.parse(ethersTransaction.from),
		input: stringToUint8Array(ethersTransaction.data),
		...ethersTransaction.gasLimit === null ? { gas: ethersTransaction.gasLimit } : {},
		value: ethersTransaction.value,
		...ethersTransaction.to === null ? {} : { to: EthereumAddress.parse(ethersTransaction.to) },
		...ethersTransaction.gasPrice === null ? {} : { gasPrice: ethersTransaction.gasPrice },
		...ethersTransaction.maxPriorityFeePerGas === null ? {} : { maxPriorityFeePerGas: ethersTransaction.maxPriorityFeePerGas },
		...ethersTransaction.maxFeePerGas === null ? {} : { maxFeePerGas: ethersTransaction.maxFeePerGas },
	}

	if (transactionDetails.maxFeePerGas === undefined) throw new Error('No support for non-1559 transactions')

	const transaction = {
		type: '1559' as const,
		from: transactionDetails.from,
		chainId: ethereumClientService.getChainId(),
		nonce: BigInt(ethersTransaction.nonce),
		maxFeePerGas: transactionDetails.maxFeePerGas,
		maxPriorityFeePerGas: transactionDetails.maxPriorityFeePerGas ? transactionDetails.maxPriorityFeePerGas : 0n,
		to: transactionDetails.to === undefined ? null : transactionDetails.to,
		value: transactionDetails.value ? transactionDetails.value : 0n,
		input: transactionDetails.input,
		accessList: [],
		gas: ethersTransaction.gasLimit,
	}
	return {
		transaction,
		website,
		created,
		originalRequestParameters: sendRawTransactionParams,
		transactionIdentifier,
		success: true,
	}
}

const getPendingTransactionWindow = async (simulator: Simulator, websiteTabConnections: WebsiteTabConnections) => {
	const pendingTransactions = await getPendingTransactionsAndMessages()
	const [firstPendingTransaction] = pendingTransactions
	if (firstPendingTransaction !== undefined) {
		const alreadyOpenWindow = await getPopupOrTabById(firstPendingTransaction.popupOrTabId)
		if (alreadyOpenWindow) return alreadyOpenWindow
		await resolveAllPendingTransactionsAndMessageAsNoResponse(pendingTransactions, simulator, websiteTabConnections)
	}
	return await openPopupOrTab({ url: '/html/confirmTransactionV3.html', type: 'popup', height: 800, width: 600 })
}

export async function openConfirmTransactionDialogForMessage(
	simulator: Simulator,
	ethereumClientService: EthereumClientService,
	request: InterceptedRequest,
	transactionParams: SignMessageParams,
	activeAddress: bigint | undefined,
	website: Website,
	websiteTabConnections: WebsiteTabConnections,
) {
	if (activeAddress === undefined) return { type: 'result' as const, ...ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS }
	const uniqueRequestIdentifierString = getUniqueRequestIdentifierString(request.uniqueRequestIdentifier)
	const messageIdentifier = EthereumQuantity.parse(keccak256(toUtf8Bytes(uniqueRequestIdentifierString)))
	const created = new Date()
	const signedMessageTransaction = {
		website,
		created,
		originalRequestParameters: transactionParams,
		fakeSignedFor: activeAddress,
		request,
		messageIdentifier,
	}
	try {
		const visualizedPersonalSignRequest = await craftPersonalSignPopupMessage(ethereumClientService, undefined, signedMessageTransaction, ethereumClientService.getRpcEntry())
		await pendingConfirmationSemaphore.execute(async () => {
			const openedDialog = await getPendingTransactionWindow(simulator, websiteTabConnections)
			if (openedDialog === undefined) throw new Error('Failed to get pending transaction window!')

			const pendingMessage = {
				type: 'SignableMessage' as const,
				popupOrTabId: openedDialog,
				originalRequestParameters: transactionParams,
				uniqueRequestIdentifier: request.uniqueRequestIdentifier,
				activeAddress,
				created,
				transactionOrMessageCreationStatus: 'Crafting' as const,
				website,
				approvalStatus: { status: 'WaitingForUser' as const },
				signedMessageTransaction,
			}
			await appendPendingTransactionOrMessage(pendingMessage)
			await updateConfirmTransactionView(ethereumClientService)

			await updatePendingTransactionOrMessage(pendingMessage.uniqueRequestIdentifier, async (message) => {
				if (message.type !== 'SignableMessage') return message
				return modifyObject(message, { transactionOrMessageCreationStatus: 'Simulating' as const })
			})
			await updateConfirmTransactionView(ethereumClientService)

			await updatePendingTransactionOrMessage(pendingMessage.uniqueRequestIdentifier, async (message) => {
				if (message.type !== 'SignableMessage') return message
				return { ...message, visualizedPersonalSignRequest, transactionOrMessageCreationStatus: 'Simulated' as const }
			})
			await updateConfirmTransactionView(ethereumClientService)

			await tryFocusingTabOrWindow(openedDialog)
		})
	} catch (e) {
		await handleUnexpectedError(e)
	}
	const pendingTransactionData = await getPendingTransactionOrMessageByidentifier(request.uniqueRequestIdentifier)
	if (pendingTransactionData === undefined) return formRejectMessage(undefined)
	return { type: 'doNotReply' as const }
}

export async function openConfirmTransactionDialogForTransaction(
	simulator: Simulator,
	request: InterceptedRequest,
	transactionParams: SendTransactionParams | SendRawTransactionParams,
	activeAddress: bigint | undefined,
	website: Website,
	websiteTabConnections: WebsiteTabConnections,
) {
	const uniqueRequestIdentifierString = getUniqueRequestIdentifierString(request.uniqueRequestIdentifier)
	const transactionIdentifier = EthereumQuantity.parse(keccak256(toUtf8Bytes(uniqueRequestIdentifierString)))
	const created = new Date()

	if (activeAddress === undefined) return { type: 'result' as const, ...ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS }
	await pendingConfirmationSemaphore.execute(async () => {
		const openedDialog = await getPendingTransactionWindow(simulator, websiteTabConnections)
		if (openedDialog === undefined) throw new Error('Failed to get pending transaction window!')

		const pendingTransaction = {
			type: 'Transaction' as const,
			popupOrTabId: openedDialog,
			originalRequestParameters: transactionParams,
			uniqueRequestIdentifier: request.uniqueRequestIdentifier,
			activeAddress,
			created,
			transactionOrMessageCreationStatus: 'Crafting' as const,
			transactionIdentifier,
			website,
			approvalStatus: { status: 'WaitingForUser' as const }
		}
		await appendPendingTransactionOrMessage(pendingTransaction)
		await updateConfirmTransactionView(simulator.ethereum)
		await tryFocusingTabOrWindow(openedDialog)
	})

	const pendingTransactionData = await getPendingTransactionOrMessageByidentifier(request.uniqueRequestIdentifier)

	if (pendingTransactionData === undefined) return formRejectMessage(undefined)
	return { type: 'doNotReply' as const }
}
