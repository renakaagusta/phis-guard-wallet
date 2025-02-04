import { extractTokenEvents } from '../../background/metadataUtils.js'
import { EnrichedEthereumInputData } from '../../types/EnrichedEthereumData.js'
import { AddressBookEntry } from '../../types/addressBookTypes.js'
import { TransactionOrMessageIdentifier } from '../../types/interceptor-messages.js'
import { VisualizedPersonalSignRequest } from '../../types/personal-message-definitions.js'
import { RpcNetwork } from '../../types/rpc.js'
import { LogAnalysisParams, NonLogAnalysisParams, RenameAddressCallBack } from '../../types/user-interface-types.js'
import { SimulatedAndVisualizedTransaction, SimulationAndVisualisationResults, TransactionVisualizationParameters } from '../../types/visualizer-types.js'
import { dataStringWith0xStart } from '../../utils/bigint.js'
import { SignatureCard } from '../pages/PersonalSign.js'
import { SmallAddress } from '../subcomponents/address.js'
import { ArrowIcon } from '../subcomponents/icons.js'
import { insertBetweenElements } from '../subcomponents/misc.js'
import { EnrichedSolidityTypeComponentWithAddressBook } from '../subcomponents/solidityType.js'

export type TransactionImportanceBlockParams = {
	simTx: SimulatedAndVisualizedTransaction
	activeAddress: bigint
	renameAddressCallBack: RenameAddressCallBack
	addressMetadata: readonly AddressBookEntry[]
	rpcNetwork: RpcNetwork
}

// showcases the most important things the transaction does
export function TransactionImportanceBlock(_: TransactionImportanceBlockParams) {
	return <></>
}

export function SenderReceiver({ from, to, renameAddressCallBack }: { from: AddressBookEntry, to: AddressBookEntry | undefined, renameAddressCallBack: (entry: AddressBookEntry) => void, }) {
	const textColor = 'var(--text-color)'
	if (to === undefined) {
		return <span class = 'log-table' style = 'margin-top: 10px; column-gap: 5px; justify-content: space-between; grid-template-columns: auto auto'>
			<div class = 'log-cell' style = ''>
				<p style = { 'color: var(--subtitle-text-color);' }> Transaction sender: </p>
			</div>
			<div class = 'log-cell' style = ''>
				<SmallAddress
					addressBookEntry = { from }
					textColor = { 'var(--subtitle-text-color)' }
					renameAddressCallBack = { renameAddressCallBack }
				/>
			</div>
		</span>
	}
	return <span class = 'log-table' style = 'justify-content: space-between; column-gap: 5px; grid-template-columns: auto auto auto;'>
		<div class = 'log-cell' style = 'margin: 2px;'>
			<SmallAddress
				addressBookEntry = { from }
				textColor = { textColor }
				renameAddressCallBack = { renameAddressCallBack }
			/>
		</div>
		<div class = 'log-cell' style = 'padding-right: 0.2em; padding-left: 0.2em; justify-content: center;'>
			<ArrowIcon color = { textColor } />
		</div>
		<div class = 'log-cell' style = 'margin: 2px; justify-content: end;'>
			<SmallAddress
				addressBookEntry = { to }
				textColor = { textColor }
				renameAddressCallBack = { renameAddressCallBack }
			/>
		</div>
	</span>
}

export function Transaction(param: TransactionVisualizationParameters) {
	return (
		<div class = 'card'>
			<div class = 'card-content' style = 'padding-bottom: 5px;'>
				<div class = 'container'>
					<TransactionImportanceBlock { ...param } rpcNetwork = { param.simulationAndVisualisationResults.rpcNetwork } addressMetadata = { param.addressMetaData }/>
				</div>				
				<SenderReceiver from = { param.simTx.transaction.from } to = { param.simTx.transaction.to } renameAddressCallBack = { param.renameAddressCallBack }/>
			</div>
		</div>
	)
}

type TransactionsAndSignedMessagesParams = {
	simulationAndVisualisationResults: SimulationAndVisualisationResults
	removeTransactionOrSignedMessage: (transactionOrMessageIdentifier: TransactionOrMessageIdentifier) => void
	activeAddress: bigint
	renameAddressCallBack: RenameAddressCallBack
	removedTransactionOrSignedMessages: readonly TransactionOrMessageIdentifier[]
	addressMetaData: readonly AddressBookEntry[]
}

export function TransactionsAndSignedMessages(param: TransactionsAndSignedMessagesParams) {
	const transactions = param.simulationAndVisualisationResults.simulatedAndVisualizedTransactions.filter((tx) => param.removedTransactionOrSignedMessages.find((x) => x.type === 'Transaction' && x.transactionIdentifier === tx.transactionIdentifier) === undefined)
	const messages = param.simulationAndVisualisationResults.visualizedPersonalSignRequests.filter((message) => !param.removedTransactionOrSignedMessages.map((x) => x.type === 'SignedMessage' ? x.messageIdentifier : undefined).includes(message.messageIdentifier))
	const transactionsAndMessages: readonly (VisualizedPersonalSignRequest | SimulatedAndVisualizedTransaction)[] = [...messages, ...transactions].sort((n1, n2) => n1.created.getTime() - n2.created.getTime())
	return <ul>
		{ transactionsAndMessages.map((simTx, _index) => (
			<li>
				{ 'activeAddress' in simTx ? <>
					<SignatureCard
						visualizedPersonalSignRequest = { simTx }
						renameAddressCallBack = { param.renameAddressCallBack }
						removeTransactionOrSignedMessage = { param.removeTransactionOrSignedMessage }
						numberOfUnderTransactions = { 0 }
					/>
				</> : <>
					<Transaction
						simTx = { simTx }
						simulationAndVisualisationResults = { param.simulationAndVisualisationResults }
						removeTransactionOrSignedMessage = { param.removeTransactionOrSignedMessage }
						activeAddress = { param.activeAddress }
						renameAddressCallBack = { param.renameAddressCallBack }
						addressMetaData = { param.addressMetaData }
					/>
				</> }
			</li>
		)) }
	</ul>
}

export function TokenLogAnalysis(param: LogAnalysisParams) {
	const tokenEvents = extractTokenEvents(param.simulatedAndVisualizedTransaction.events)

	if (tokenEvents.length === 0) return <p class = 'paragraph'> No token events </p>
	return <span class = 'token-log-table' style = 'justify-content: center; column-gap: 5px; row-gap: 5px;'></span>
}

export function NonTokenLogAnalysis(_: NonLogAnalysisParams) {
	return <></>
}

type ParsedInputDataParams = {
	inputData: EnrichedEthereumInputData
	addressMetaData: readonly AddressBookEntry[]
	renameAddressCallBack: RenameAddressCallBack
}

export function ParsedInputData(params: ParsedInputDataParams) {
	const textStyle = 'text-overflow: ellipsis; overflow: hidden;'
	if (params.inputData.type === 'NonParsed') {
		return <div class = 'textbox'>
			<p class = 'paragraph' style = 'color: var(--subtitle-text-color)'>{ dataStringWith0xStart(params.inputData.input) }</p>
		</div>
	}
	return <>
		<div class = 'log-cell' style = { { 'grid-column-start': 2, 'grid-column-end': 4, display: 'flex', 'flex-wrap': 'wrap' } }>
			<p class = 'paragraph' style = { textStyle }> { `${ params.inputData.name }(` } </p>
			{ insertBetweenElements(params.inputData.args.map((arg) => {
				return <>
					<p style = { textStyle } class = 'paragraph'> { `${ arg.paramName } =` }&nbsp;</p>
					<EnrichedSolidityTypeComponentWithAddressBook valueType = { arg.typeValue } addressMetaData = { params.addressMetaData } renameAddressCallBack = { params.renameAddressCallBack } />
				</>
			}), <p style = { textStyle } class = 'paragraph'>,&nbsp;</p>) }
			<p class = 'paragraph' style = { textStyle }> { ')' } </p>
		</div>
	</>
}
