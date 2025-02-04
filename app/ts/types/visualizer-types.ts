
import * as funtypes from 'funtypes'
import { InterceptedRequest, WebsiteSocket } from '../utils/requests.js'
import { AddressBookEntry, IncompleteAddressBookEntry } from './addressBookTypes.js'
import { EnrichedEthereumEvent, EnrichedEthereumInputData } from './EnrichedEthereumData.js'
import { EthSimulateV1CallResult } from './ethSimulate-types.js'
import { TransactionOrMessageIdentifier } from './interceptor-messages.js'
import { SignMessageParams } from './jsonRpc-signing-types.js'
import { EthSubscribeParams, OriginalSendRequestParameters, SendRawTransactionParams, SendTransactionParams } from './JsonRpc-types.js'
import { VisualizedPersonalSignRequest } from './personal-message-definitions.js'
import { RpcNetwork } from './rpc.js'
import { RenameAddressCallBack } from './user-interface-types.js'
import { Website } from './websiteAccessTypes.js'
import { EthereumAddress, EthereumBytes32, EthereumData, EthereumQuantity, EthereumSendableSignedTransaction, EthereumTimestamp, EthereumUnsignedTransaction, OptionalEthereumAddress } from './wire-types.js'

export type SimulatedAndVisualizedTransactionBase = funtypes.Static<typeof SimulatedAndVisualizedTransactionBase>
export const SimulatedAndVisualizedTransactionBase = funtypes.Intersect(
	funtypes.ReadonlyObject({
		website: Website,
		created: EthereumTimestamp,
		gasSpent: EthereumQuantity,
		realizedGasPrice: EthereumQuantity,
		quarantine: funtypes.Boolean,
		quarantineReasons: funtypes.ReadonlyArray(funtypes.String),
		events: funtypes.ReadonlyArray(EnrichedEthereumEvent),
		parsedInputData: EnrichedEthereumInputData,
		transactionIdentifier: EthereumQuantity,
	}),
	funtypes.Union(
		funtypes.ReadonlyObject({
			statusCode: funtypes.Literal('success'),
		}),
		funtypes.ReadonlyObject({
			statusCode: funtypes.Literal('failure'),
			error: funtypes.ReadonlyObject({
				code: funtypes.Number,
				message: funtypes.String,
				decodedErrorMessage: funtypes.String,
			})
		})
	)
)

export type ProtectorResults = funtypes.Static<typeof ProtectorResults>
export const ProtectorResults = funtypes.ReadonlyObject( {
	quarantine: funtypes.Boolean,
	quarantineReasons: funtypes.ReadonlyArray(funtypes.String),
})

export type PreSimulationTransaction = funtypes.Static<typeof PreSimulationTransaction>
export const PreSimulationTransaction = funtypes.ReadonlyObject({
	signedTransaction: EthereumSendableSignedTransaction,
	website: Website,
	created: EthereumTimestamp,
	originalRequestParameters: funtypes.Union(SendTransactionParams, SendRawTransactionParams),
	transactionIdentifier: EthereumQuantity,
})

export type SimulatedTransaction = funtypes.Static<typeof SimulatedTransaction>
export const SimulatedTransaction = funtypes.ReadonlyObject({
	realizedGasPrice: EthereumQuantity,
	preSimulationTransaction: PreSimulationTransaction,
	ethSimulateV1CallResult: EthSimulateV1CallResult,
})

export type EstimateGasError = funtypes.Static<typeof EstimateGasError>
export const EstimateGasError = funtypes.ReadonlyObject({
	error: funtypes.ReadonlyObject({
		code: funtypes.Number,
		message: funtypes.String,
		data: funtypes.String
	})
})

export type WebsiteCreatedEthereumUnsignedTransaction = funtypes.Static<typeof WebsiteCreatedEthereumUnsignedTransaction>
export const WebsiteCreatedEthereumUnsignedTransaction = funtypes.ReadonlyObject({
	website: Website,
	created: EthereumTimestamp,
	originalRequestParameters: OriginalSendRequestParameters,
	transactionIdentifier: EthereumQuantity,
	success: funtypes.Literal(true),
	transaction: EthereumUnsignedTransaction,
})

export type FailedToCreateWebsiteCreatedEthereumUnsignedTransaction = funtypes.Static<typeof FailedToCreateWebsiteCreatedEthereumUnsignedTransaction>
export const FailedToCreateWebsiteCreatedEthereumUnsignedTransaction = funtypes.ReadonlyObject({
	website: Website,
	created: EthereumTimestamp,
	originalRequestParameters: OriginalSendRequestParameters,
	transactionIdentifier: EthereumQuantity,
	success: funtypes.Literal(false),
	error: EstimateGasError.fields.error
})

export type WebsiteCreatedEthereumUnsignedTransactionOrFailed = funtypes.Static<typeof WebsiteCreatedEthereumUnsignedTransactionOrFailed>
export const WebsiteCreatedEthereumUnsignedTransactionOrFailed = funtypes.Union(WebsiteCreatedEthereumUnsignedTransaction, FailedToCreateWebsiteCreatedEthereumUnsignedTransaction)

export type SignedMessageTransaction = funtypes.Static<typeof SignedMessageTransaction>
export const SignedMessageTransaction = funtypes.ReadonlyObject({
	website: Website,
	created: EthereumTimestamp,
	fakeSignedFor: EthereumAddress,
	originalRequestParameters: SignMessageParams,
	request: InterceptedRequest,
	simulationMode: funtypes.Boolean,
	messageIdentifier: EthereumQuantity,
})

export type SimulationState = funtypes.Static<typeof SimulationState>
export const SimulationState = funtypes.ReadonlyObject({
	addressToMakeRich: funtypes.Union(funtypes.Undefined, EthereumAddress),
	simulatedTransactions: funtypes.ReadonlyArray(SimulatedTransaction),
	signedMessages: funtypes.ReadonlyArray(SignedMessageTransaction),
	blockNumber: EthereumQuantity,
	blockTimestamp: EthereumTimestamp,
	baseFeePerGas: EthereumQuantity,
	rpcNetwork: RpcNetwork,
	simulationConductedTimestamp: EthereumTimestamp,
})

export type TransactionWithAddressBookEntries = funtypes.Static<typeof TransactionWithAddressBookEntries>
export const TransactionWithAddressBookEntries = funtypes.Intersect(
	funtypes.ReadonlyObject({
		from: AddressBookEntry,
		to: funtypes.Union(AddressBookEntry, funtypes.Undefined),
		value: EthereumQuantity,
		input: EthereumData,
		rpcNetwork: RpcNetwork,
		hash: EthereumQuantity,
		gas: EthereumQuantity,
		nonce: EthereumQuantity,
	}),
	funtypes.Union(
		funtypes.ReadonlyObject({
			type: funtypes.Literal('1559'),
			maxFeePerGas: EthereumQuantity,
			maxPriorityFeePerGas: EthereumQuantity,
		}),
		funtypes.ReadonlyObject({
			type: funtypes.Literal('4844'),
			maxFeePerGas: EthereumQuantity,
			maxPriorityFeePerGas: EthereumQuantity,
			maxFeePerBlobGas: EthereumQuantity,
			blobVersionedHashes: funtypes.ReadonlyArray(EthereumBytes32),
		}),
		funtypes.ReadonlyObject({ type: funtypes.Union(funtypes.Literal('legacy'), funtypes.Literal('2930')) })
	)
)

export type SimulatedAndVisualizedTransaction = funtypes.Static<typeof SimulatedAndVisualizedTransaction>
export const SimulatedAndVisualizedTransaction = funtypes.Intersect(
	SimulatedAndVisualizedTransactionBase,
	funtypes.ReadonlyObject({ transaction: TransactionWithAddressBookEntries })
)

export type SimulationAndVisualisationResults = {
	blockNumber: bigint,
	blockTimestamp: Date,
	simulationConductedTimestamp: Date,
	addressBookEntries: readonly AddressBookEntry[],
	simulatedAndVisualizedTransactions: readonly SimulatedAndVisualizedTransaction[],
	visualizedPersonalSignRequests: readonly VisualizedPersonalSignRequest[],
	rpcNetwork: RpcNetwork,
	activeAddress: bigint,
	namedTokenIds: readonly NamedTokenId[],
}

export type TransactionVisualizationParameters = {
	simTx: SimulatedAndVisualizedTransaction
	simulationAndVisualisationResults: SimulationAndVisualisationResults
	removeTransactionOrSignedMessage: ((transactionOrMessageIdentifier: TransactionOrMessageIdentifier) => void) | undefined
	activeAddress: bigint
	renameAddressCallBack: RenameAddressCallBack
	addressMetaData: readonly AddressBookEntry[]
}

export type SimulationUpdatingState = funtypes.Static<typeof SimulationUpdatingState>
export const SimulationUpdatingState = funtypes.Union(funtypes.Literal('updating'), funtypes.Literal('done'), funtypes.Literal('failed'))

export type SimulationResultState = funtypes.Static<typeof SimulationResultState>
export const SimulationResultState = funtypes.Union(funtypes.Literal('done'), funtypes.Literal('invalid'), funtypes.Literal('corrupted'))

export type NamedTokenId = funtypes.Static<typeof NamedTokenId>
export const NamedTokenId = funtypes.ReadonlyObject({
	tokenAddress: EthereumAddress,
	tokenId: EthereumQuantity,
	tokenIdName: funtypes.String
})

type EventsForEachTransaction = funtypes.Static<typeof EventsForEachTransaction>
const EventsForEachTransaction = funtypes.ReadonlyArray(funtypes.ReadonlyArray(EnrichedEthereumEvent))

export type CompleteVisualizedSimulation = funtypes.Static<typeof CompleteVisualizedSimulation>
export const CompleteVisualizedSimulation = funtypes.ReadonlyObject({
	eventsForEachTransaction: EventsForEachTransaction,
	parsedInputData: funtypes.ReadonlyArray(EnrichedEthereumInputData),
	protectors: funtypes.ReadonlyArray(ProtectorResults),
	addressBookEntries: funtypes.ReadonlyArray(AddressBookEntry),
	namedTokenIds: funtypes.ReadonlyArray(NamedTokenId),
	simulationState: funtypes.Union(SimulationState, funtypes.Undefined),
	activeAddress: OptionalEthereumAddress,
	simulationUpdatingState: SimulationUpdatingState,
	simulationResultState: SimulationResultState,
	simulationId: funtypes.Number,
	simulatedAndVisualizedTransactions: funtypes.ReadonlyArray(SimulatedAndVisualizedTransaction),
	visualizedPersonalSignRequests: funtypes.ReadonlyArray(VisualizedPersonalSignRequest),
})

type NewHeadsSubscription = funtypes.Static<typeof NewHeadsSubscription>
const NewHeadsSubscription = funtypes.ReadonlyObject({
	type: funtypes.Literal('newHeads'),
	subscriptionOrFilterId: funtypes.String,
	params: EthSubscribeParams,
	subscriptionCreatorSocket: WebsiteSocket,
})

export type EthereumSubscriptionsAndFilters = funtypes.Static<typeof EthereumSubscriptionsAndFilters>
export const EthereumSubscriptionsAndFilters = funtypes.ReadonlyArray(funtypes.Union(NewHeadsSubscription))

export type VisualizedSimulatorState = funtypes.Static<typeof VisualizedSimulatorState>
export const VisualizedSimulatorState = funtypes.ReadonlyObject({
	eventsForEachTransaction: funtypes.ReadonlyArray(funtypes.ReadonlyArray(EnrichedEthereumEvent)),
	parsedInputData: funtypes.ReadonlyArray(EnrichedEthereumInputData),
	protectors: funtypes.ReadonlyArray(ProtectorResults),
	addressBookEntries: funtypes.ReadonlyArray(AddressBookEntry),
	namedTokenIds: funtypes.ReadonlyArray(NamedTokenId),
	simulationState: funtypes.Union(SimulationState),
	simulatedAndVisualizedTransactions: funtypes.ReadonlyArray(SimulatedAndVisualizedTransaction),
	visualizedPersonalSignRequests: funtypes.ReadonlyArray(VisualizedPersonalSignRequest),
})

type ModifyAddressWindowStateError = funtypes.Static<typeof ModifyAddressWindowStateError>
const ModifyAddressWindowStateError = funtypes.Union(funtypes.ReadonlyObject({ message: funtypes.String, blockEditing: funtypes.Boolean }), funtypes.Undefined)

export type ModifyAddressWindowState = funtypes.Static<typeof ModifyAddressWindowState>
export const ModifyAddressWindowState = funtypes.ReadonlyObject({
	windowStateId: funtypes.String,
	incompleteAddressBookEntry: IncompleteAddressBookEntry,
	errorState: ModifyAddressWindowStateError,
})

export type TransactionStack = funtypes.Static<typeof TransactionStack>
export const TransactionStack = funtypes.ReadonlyObject({
	transactions: funtypes.ReadonlyArray(PreSimulationTransaction),
	signedMessages: funtypes.ReadonlyArray(SignedMessageTransaction)
})
