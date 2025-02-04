import { Signal, useComputed, useSignal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { sendPopupMessageToBackgroundPage } from '../../background/backgroundUtils.js'
import { PendingTransactionOrSignableMessage } from '../../types/accessRequest.js'
import { AddressBookEntry } from '../../types/addressBookTypes.js'
import { MessageToPopup, UnexpectedErrorOccured, UpdateConfirmTransactionDialog } from '../../types/interceptor-messages.js'
import { RpcEntries } from '../../types/rpc.js'
import { RenameAddressCallBack, RpcConnectionStatus } from '../../types/user-interface-types.js'
import { CompleteVisualizedSimulation, ModifyAddressWindowState, SimulatedAndVisualizedTransaction } from '../../types/visualizer-types.js'
import { addressString, checksummedAddress, stringifyJSONWithBigInts } from '../../utils/bigint.js'
import { checkAndThrowRuntimeLastError } from '../../utils/requests.js'
import { NetworkErrors } from '../App.js'
import { DinoSaysNotification } from '../subcomponents/DinoSays.js'
import { ErrorCheckBox, ErrorComponent, UnexpectedError } from '../subcomponents/Error.js'
import Hint from '../subcomponents/Hint.js'
import { SignerLogoText } from '../subcomponents/signers.js'
import { tryFocusingTabOrWindow } from '../ui-utils.js'
import { AddNewAddress } from './AddNewAddress.js'
import { InvalidMessage, isPossibleToSignMessage } from './PersonalSign.js'

const getResultsForTransaction = (results: readonly SimulatedAndVisualizedTransaction[], transactionIdentifier: bigint) => {
	return results.find((result) => result.transactionIdentifier === transactionIdentifier)
}

const HALF_HEADER_HEIGHT = 48 / 2

type TransactionCardParams = {
	pendingTransactionsAndSignableMessages: readonly PendingTransactionOrSignableMessage[],
	renameAddressCallBack: RenameAddressCallBack,
	currentBlockNumber: bigint | undefined,
	rpcConnectionStatus: Signal<RpcConnectionStatus>,
	numberOfUnderTransactions: number,
}

function TransactionCard(param: TransactionCardParams) {
	return <>
		<div class='card' style={`top: ${param.numberOfUnderTransactions * -HALF_HEADER_HEIGHT}px`}>
			<div class='card-content' style='padding-bottom: 5px;'>
				<div class='textbox'>
					<p class='paragraph' style='color: var(--subtitle-text-color)'>{stringifyJSONWithBigInts(param.pendingTransactionsAndSignableMessages[0]?.originalRequestParameters)}</p>
				</div>
			</div>
		</div>
	</>
}

type CheckBoxesParams = {
	currentPendingTransactionOrSignableMessage: PendingTransactionOrSignableMessage,
	forceSend: Signal<boolean>,
}
const CheckBoxes = (params: CheckBoxesParams) => {
	if (params.currentPendingTransactionOrSignableMessage.transactionOrMessageCreationStatus !== 'Simulated') return <></>
	const setForceSend = (checked: boolean) => { params.forceSend.value = checked }
	if (params.currentPendingTransactionOrSignableMessage.type === 'SignableMessage') {
		const visualizedPersonalSignRequest = params.currentPendingTransactionOrSignableMessage.visualizedPersonalSignRequest
		return <>
			{isPossibleToSignMessage(visualizedPersonalSignRequest, visualizedPersonalSignRequest.activeAddress.address) && visualizedPersonalSignRequest.quarantine
				? <div style='display: grid'>
					<div style='margin: 0px; margin-bottom: 10px; margin-left: 20px; margin-right: 20px; '>
						<ErrorCheckBox text={'I understand that there are issues with this signature request but I want to send it anyway against Interceptors recommendations.'} checked={params.forceSend.value} onInput={setForceSend} />
					</div>
				</div>
				: <></>
			}
		</>
	}
	if (params.currentPendingTransactionOrSignableMessage.simulationResults.statusCode !== 'success') return <></>
	const simulatedAndVisualizedTransactions = params.currentPendingTransactionOrSignableMessage.simulationResults.data.simulatedAndVisualizedTransactions
	const currentResults = getResultsForTransaction(simulatedAndVisualizedTransactions, params.currentPendingTransactionOrSignableMessage.transactionIdentifier)

	const margins = 'margin: 0px; margin-bottom: 10px; margin-left: 20px; margin-right: 20px;'
	if (currentResults === undefined) return <></>
	if (params.currentPendingTransactionOrSignableMessage?.approvalStatus.status === 'SignerError') return <div style='display: grid'>
		<div style={margins}>
			<ErrorComponent text={params.currentPendingTransactionOrSignableMessage.approvalStatus.message} />
		</div>
	</div>
	if (currentResults.statusCode !== 'success') return <div style='display: grid'>
		<div style={margins}>
			<ErrorCheckBox text={'I understand that the transaction will fail but I want to send it anyway.'} checked={params.forceSend.value} onInput={setForceSend} />
		</div>
	</div>
	if (currentResults.quarantine === true) return <div style='display: grid'>
		<div style={margins}>
			<ErrorCheckBox text={'I understand that there are issues with this transaction but I want to send it anyway against Interceptors recommendations.'} checked={params.forceSend.value} onInput={setForceSend} />
		</div>
	</div>
	return <></>
}

type ModalState =
	{ page: 'modifyAddress', state: Signal<ModifyAddressWindowState> } |
	{ page: 'noModal' }

type RejectButtonParams = {
	onClick: () => void
}
const RejectButton = ({ onClick }: RejectButtonParams) => {
	return <div style='display: flex;'>
		<button className='button is-primary is-danger button-overflow dialog-button-left' onClick={onClick} >
			{'Reject'}
		</button>
	</div>
}

type ButtonsParams = {
	currentPendingTransactionOrSignableMessage: PendingTransactionOrSignableMessage | undefined
	reject: () => void
	approve: () => void
}
function Buttons({ currentPendingTransactionOrSignableMessage, reject, approve }: ButtonsParams) {
	console.log('Buttons: Starting execution')

	if (currentPendingTransactionOrSignableMessage === undefined) {
		console.log('Buttons: currentPendingTransactionOrSignableMessage is undefined, returning RejectButton')
		return <RejectButton onClick={reject} />
	}

	console.log('Buttons: Preparing to return buttons UI')
	return <div style='display: flex; flex-direction: row;'>
		<button className='button is-primary is-danger button-overflow dialog-button-left' onClick={reject} >
			Reject
		</button>
		<button className='button is-primary button-overflow dialog-button-right' onClick={approve}>
			{currentPendingTransactionOrSignableMessage.approvalStatus.status === 'WaitingForSigner' ? <>
				<span>Waiting for signer</span>
			</> : <>
				{<SignerLogoText signerName={'NoSigner'} text={"Approve"} />
				}
			</>
			}
		</button>
	</div>
}

export function ConfirmTransaction() {
	console.log('ConfirmTransaction')
	const currentPendingTransactionOrSignableMessage = useSignal<PendingTransactionOrSignableMessage | undefined>(undefined)
	const pendingTransactionsAndSignableMessages = useSignal<readonly PendingTransactionOrSignableMessage[]>([])
	const completeVisualizedSimulation = useSignal<CompleteVisualizedSimulation | undefined>(undefined)
	const forceSend = useSignal<boolean>(false)
	const currentBlockNumber = useSignal<undefined | bigint>(undefined)
	const modalState = useSignal<ModalState>({ page: 'noModal' })
	const rpcConnectionStatus = useSignal<RpcConnectionStatus>(undefined)
	const pendingTransactionAddedNotification = useSignal<boolean>(false)
	const unexpectedError = useSignal<undefined | UnexpectedErrorOccured>(undefined)
	const rpcEntries = useSignal<RpcEntries>([])

	console.log('ConfirmTransaction 2')

	const updatePendingTransactionsAndSignableMessages = (message: UpdateConfirmTransactionDialog) => {
		completeVisualizedSimulation.value = message.data.visualizedSimulatorState
		currentBlockNumber.value = message.data.currentBlockNumber
	}

	useEffect(() => {
		function popupMessageListener(msg: unknown) {
			const maybeParsed = MessageToPopup.safeParse(msg)
			if (!maybeParsed.success) return // not a message we are interested in
			const parsed = maybeParsed.value

			if (parsed.method === 'popup_settingsUpdated') {
				sendPopupMessageToBackgroundPage({ method: 'popup_requestSettings' })
				return
			}
			if (parsed.method === 'popup_UnexpectedErrorOccured') {
				unexpectedError.value = parsed
				return
			}
			if (parsed.method === 'popup_addressBookEntriesChanged') return refreshMetadata()
			if (parsed.method === 'popup_new_block_arrived') {
				rpcConnectionStatus.value = parsed.data.rpcConnectionStatus
				refreshSimulation()
				currentBlockNumber.value = parsed.data.rpcConnectionStatus?.latestBlock?.number
				return
			}
			if (parsed.method === 'popup_failed_to_get_block') {
				rpcConnectionStatus.value = parsed.data.rpcConnectionStatus
				return
			}
			if (parsed.method === 'popup_update_confirm_transaction_dialog') {
				updatePendingTransactionsAndSignableMessages(UpdateConfirmTransactionDialog.parse(parsed))
				return
			}
			if (parsed.method === 'popup_update_confirm_transaction_dialog_pending_transactions') {
				pendingTransactionsAndSignableMessages.value = parsed.data.pendingTransactionAndSignableMessages
				const firstMessage = parsed.data.pendingTransactionAndSignableMessages[0]
				if (firstMessage === undefined) throw new Error('message data was undefined')
				currentPendingTransactionOrSignableMessage.value = firstMessage
				if (firstMessage.type === 'Transaction' && (firstMessage.transactionOrMessageCreationStatus === 'Simulated' || firstMessage.transactionOrMessageCreationStatus === 'FailedToSimulate') && firstMessage.simulationResults !== undefined && firstMessage.simulationResults.statusCode === 'success' && (currentBlockNumber.value === undefined || firstMessage.simulationResults.data.simulationState.blockNumber > currentBlockNumber.value)) {
					currentBlockNumber.value = firstMessage.simulationResults.data.simulationState.blockNumber
				}
			}
			return
		}
		browser.runtime.onMessage.addListener(popupMessageListener)
		return () => browser.runtime.onMessage.removeListener(popupMessageListener)
	})

	console.log('ConfirmTransaction 3')

	useEffect(() => {
		sendPopupMessageToBackgroundPage({ method: 'popup_confirmTransactionReadyAndListening' })
		sendPopupMessageToBackgroundPage({ method: 'popup_requestSettings' })
	}, [])

	async function approve() {
		if (currentPendingTransactionOrSignableMessage.value === undefined) throw new Error('dialogState is not set')
		pendingTransactionAddedNotification.value = false
		const currentWindow = await browser.windows.getCurrent()
		checkAndThrowRuntimeLastError()
		if (currentWindow.id === undefined) throw new Error('could not get our own Id!')
		try {
			await sendPopupMessageToBackgroundPage({ method: 'popup_confirmDialog', data: { uniqueRequestIdentifier: currentPendingTransactionOrSignableMessage.value.uniqueRequestIdentifier, action: 'accept' } })
			console.log('Line 6: Sent popup confirmation message')
		} catch (error) {
			console.warn('Failed to confirm transaction')
			// biome-ignore lint/suspicious/noConsoleLog: <Used for support debugging>
			console.log({ error })
		}
	}
	
	async function reject() {
		if (currentPendingTransactionOrSignableMessage.value === undefined) throw new Error('dialogState is not set')
		pendingTransactionAddedNotification.value = false
		const currentWindow = await browser.windows.getCurrent()
		checkAndThrowRuntimeLastError()
		if (currentWindow.id === undefined) throw new Error('could not get our own Id!')
		if (pendingTransactionsAndSignableMessages.value.length === 1) await tryFocusingTabOrWindow({ type: 'tab', id: currentPendingTransactionOrSignableMessage.value.uniqueRequestIdentifier.requestSocket.tabId })

		const getPossibleErrorString = () => {
			const pending = currentPendingTransactionOrSignableMessage.value
			if (pending === undefined) return undefined
			if (pending.transactionOrMessageCreationStatus === 'FailedToSimulate') return pending.transactionToSimulate.error.message
			if (pending.transactionOrMessageCreationStatus !== 'Simulated') return undefined
			if (pending.type !== 'Transaction') return undefined
			if (pending.simulationResults.statusCode !== 'success') return undefined
			const results = pending.simulationResults.data.simulatedAndVisualizedTransactions.find((tx) => tx.transactionIdentifier === pending.transactionIdentifier)
			if (results === undefined) return undefined
			return results.statusCode === 'failure' ? results.error.message : undefined
		}

		await sendPopupMessageToBackgroundPage({
			method: 'popup_confirmDialog', data: {
				uniqueRequestIdentifier: currentPendingTransactionOrSignableMessage.value.uniqueRequestIdentifier,
				action: 'reject',
				errorString: getPossibleErrorString(),
			}
		})
	}


	console.log('ConfirmTransaction 4')

	const refreshMetadata = async () => {
		if (currentPendingTransactionOrSignableMessage === undefined) return
		await sendPopupMessageToBackgroundPage({ method: 'popup_refreshConfirmTransactionMetadata' })
	}
	const refreshSimulation = async () => {
		if (currentPendingTransactionOrSignableMessage === undefined) return
		await sendPopupMessageToBackgroundPage({ method: 'popup_refreshConfirmTransactionDialogSimulation' })
	}

	function renameAddressCallBack(entry: AddressBookEntry) {
		modalState.value = {
			page: 'modifyAddress',
			state: new Signal({
				windowStateId: addressString(entry.address),
				errorState: undefined,
				incompleteAddressBookEntry: {
					addingAddress: false,
					symbol: undefined,
					decimals: undefined,
					logoUri: undefined,
					useAsActiveAddress: false,
					abi: undefined,
					declarativeNetRequestBlockMode: undefined,
					chainId: entry.chainId || 1n,
					...entry,
					address: checksummedAddress(entry.address),
				}
			})
		}
	}

	async function clearUnexpectedError() {
		unexpectedError.value = undefined
		await sendPopupMessageToBackgroundPage({ method: 'popup_clearUnexpectedError' })
	}

	console.log('currentPendingTransactionOrSignableMessage', currentPendingTransactionOrSignableMessage)

	console.log('Variables used in if condition:', {
		'currentPendingTransactionOrSignableMessage.value': currentPendingTransactionOrSignableMessage.value,
		'currentPendingTransactionOrSignableMessage.value?.transactionOrMessageCreationStatus': currentPendingTransactionOrSignableMessage.value?.transactionOrMessageCreationStatus
	})

	if (currentPendingTransactionOrSignableMessage.value === undefined) {
		return <>
			<main>
				
			</main>
		</>
	}
	
	console.log('2 currentPendingTransactionOrSignableMessage.value.transactionOrMessageCreationStatus !== \'Simulated\' && currentPendingTransactionOrSignableMessage.value.transactionOrMessageCreationStatus !== \'FailedToSimulate\' is true')
	const underTransactions = useComputed(() => pendingTransactionsAndSignableMessages.value.slice(1).reverse())

	console.log('currentPendingTransactionOrSignableMessage 2', currentPendingTransactionOrSignableMessage)
	return (
		<main>
			<Hint>
				<div class={`modal ${modalState.value.page !== 'noModal' ? 'is-active' : ''}`}>
					{modalState.value.page === 'modifyAddress' ?
						<AddNewAddress
							setActiveAddressAndInformAboutIt={undefined}
							modifyAddressWindowState={modalState.value.state}
							close={() => { modalState.value = { page: 'noModal' } }}
							activeAddress={currentPendingTransactionOrSignableMessage.value?.activeAddress}
							rpcEntries={rpcEntries}
						/>
						: <></>}
				</div>
				<div class='block popup-block popup-block-scroll' style='padding: 0px'>
					<div style='position: sticky; top: 0; z-index: 1;'>
						<UnexpectedError close={clearUnexpectedError} unexpectedError={unexpectedError.value} />
						<NetworkErrors rpcConnectionStatus={rpcConnectionStatus} />
						<InvalidMessage pendingTransactionOrSignableMessage={currentPendingTransactionOrSignableMessage.value} />
					</div>
					<div class='popup-contents'>
						<div style='margin: 10px'>
							{currentPendingTransactionOrSignableMessage.value.originalRequestParameters.method === 'eth_sendRawTransaction' && currentPendingTransactionOrSignableMessage.value.type === 'Transaction'
								? <DinoSaysNotification
									text={`This transaction is signed already. No extra signing required to forward it to ${currentPendingTransactionOrSignableMessage.value.transactionOrMessageCreationStatus !== 'Simulated' || currentPendingTransactionOrSignableMessage.value.simulationResults.statusCode === 'failed' ?
										'network' :
										currentPendingTransactionOrSignableMessage.value.simulationResults.data.simulationState.rpcNetwork.name}.`}
									close={() => { pendingTransactionAddedNotification.value = false }}
								/>
								: <></>
							}
							{pendingTransactionAddedNotification.value === true
								? <DinoSaysNotification
									text={`Hey! A new transaction request was queued. Accept or Reject the previous transaction${pendingTransactionsAndSignableMessages.value.length > 1 ? 's' : ''} to see the new one.`}
									close={() => { pendingTransactionAddedNotification.value = false }}
								/>
								: <></>
							}
							<div style={`top: ${underTransactions.value.length * -HALF_HEADER_HEIGHT}px`}></div>
							{currentPendingTransactionOrSignableMessage.value.type === 'Transaction' ?
								<TransactionCard
									pendingTransactionsAndSignableMessages={pendingTransactionsAndSignableMessages.value}
									renameAddressCallBack={renameAddressCallBack}
									currentBlockNumber={currentBlockNumber.value}
									rpcConnectionStatus={rpcConnectionStatus}
									numberOfUnderTransactions={underTransactions.value.length}
								/>
								: <>
									
								</>}
						</div>
						<nav class='window-footer popup-button-row' style='position: sticky; bottom: 0; width: 100%;'>
							<CheckBoxes currentPendingTransactionOrSignableMessage={currentPendingTransactionOrSignableMessage.value} forceSend={forceSend} />
							<Buttons
								currentPendingTransactionOrSignableMessage={currentPendingTransactionOrSignableMessage.value}
								reject={reject}
								approve={approve}
							/>
						</nav>
					</div>
				</div>
			</Hint>
		</main>
	)
}
