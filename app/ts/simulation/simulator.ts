import { Interface } from 'ethers'
import { identifyAddress } from '../background/metadataUtils.js'
import { EnrichedEthereumEvent, EnrichedEthereumInputData, ParsedEvent } from '../types/EnrichedEthereumData.js'
import { EthereumEvent } from '../types/ethSimulate-types.js'
import { RpcEntry } from '../types/rpc.js'
import { SolidityType } from '../types/solidityType.js'
import { SimulationState, WebsiteCreatedEthereumUnsignedTransaction } from '../types/visualizer-types.js'
import { EthereumAddress, EthereumBlockHeader, EthereumData, EthereumQuantity } from '../types/wire-types.js'
import { extractFunctionArgumentTypes, getAbi, removeTextBetweenBrackets } from '../utils/abi.js'
import { bytes32String } from '../utils/bigint.js'
import { ENS_ADDRESS_CHANGED, ENS_ADDR_CHANGED, ENS_BASE_REGISTRAR_NAME_REGISTERED, ENS_BASE_REGISTRAR_NAME_RENEWED, ENS_CONTENT_HASH_CHANGED, ENS_CONTROLLER_NAME_REGISTERED, ENS_CONTROLLER_NAME_RENEWED, ENS_ETHEREUM_NAME_SERVICE, ENS_ETH_REGISTRAR_CONTROLLER, ENS_EXPIRY_EXTENDED, ENS_FUSES_SET, ENS_NAME_CHANGED, ENS_NAME_UNWRAPPED, ENS_NAME_WRAPPED, ENS_NEW_OWNER, ENS_NEW_RESOLVER, ENS_NEW_TTL, ENS_PUBLIC_RESOLVER, ENS_PUBLIC_RESOLVER_2, ENS_REGISTRY_WITH_FALLBACK, ENS_REVERSE_CLAIMED, ENS_REVERSE_REGISTRAR, ENS_TEXT_CHANGED, ENS_TEXT_CHANGED_KEY_VALUE, ENS_TOKEN_WRAPPER, ENS_TRANSFER } from '../utils/constants.js'
import { parseSolidityValueByTypePure } from '../utils/solidityTypes.js'
import { handleBaseRegistrarNameRegistered, handleBaseRegistrarNameRenewed, handleControllerNameRegistered, handleEnsAddrChanged, handleEnsAddressChanged, handleEnsContentHashChanged, handleEnsControllerNameRenewed, handleEnsExpiryExtended, handleEnsFusesSet, handleEnsNameChanged, handleEnsNameUnWrapped, handleEnsNewOwner, handleEnsNewResolver, handleEnsNewTtl, handleEnsReverseClaimed, handleEnsTextChanged, handleEnsTextChangedKeyValue, handleEnsTransfer, handleNameWrapped } from './logHandlers.js'
import { EthereumClientService } from './services/EthereumClientService.js'
import { EthereumJSONRpcRequestHandler } from './services/EthereumJSONRpcRequestHandler.js'
import { parseEventIfPossible, parseTransactionInputIfPossible } from './services/SimulationModeEthereumClientService.js'

const ensEventHandler = (parsedEvent: ParsedEvent) => {
	if (parsedEvent.topics[0] !== undefined) {
		const logSignature = bytes32String(parsedEvent.topics[0])
		if (parsedEvent.loggersAddressBookEntry.address === ENS_PUBLIC_RESOLVER || parsedEvent.loggersAddressBookEntry.address === ENS_PUBLIC_RESOLVER_2) {
			if (logSignature === ENS_ADDRESS_CHANGED) return { logInformation: handleEnsAddressChanged(parsedEvent), type: 'ENS' as const, subType: 'ENSAddressChanged' as const }
			if (logSignature === ENS_ADDR_CHANGED) return { logInformation: handleEnsAddrChanged(parsedEvent), type: 'ENS' as const, subType: 'ENSAddrChanged' as const }
			if (logSignature === ENS_TEXT_CHANGED) return { logInformation: handleEnsTextChanged(parsedEvent), type: 'ENS' as const, subType: 'ENSTextChanged' as const }
			if (logSignature === ENS_TEXT_CHANGED_KEY_VALUE) return { logInformation: handleEnsTextChangedKeyValue(parsedEvent), type: 'ENS' as const, subType: 'ENSTextChangedKeyValue' as const }
			if (logSignature === ENS_CONTENT_HASH_CHANGED) return { logInformation: handleEnsContentHashChanged(parsedEvent), type: 'ENS' as const, subType: 'ENSContentHashChanged' as const }
			if (logSignature === ENS_NAME_CHANGED) return { logInformation: handleEnsNameChanged(parsedEvent), type: 'ENS' as const, subType: 'ENSNameChanged' as const }
		}
		if (parsedEvent.loggersAddressBookEntry.address === ENS_TOKEN_WRAPPER) {
			if (logSignature === ENS_FUSES_SET) return { logInformation: handleEnsFusesSet(parsedEvent), type: 'ENS' as const, subType: 'ENSFusesSet' as const }
			if (logSignature === ENS_NAME_UNWRAPPED) return { logInformation: handleEnsNameUnWrapped(parsedEvent), type: 'ENS' as const, subType: 'ENSNameUnwrapped' as const }
			if (logSignature === ENS_NAME_WRAPPED) return { logInformation: handleNameWrapped(parsedEvent), type: 'ENS' as const, subType: 'ENSNameWrapped' as const }
			if (logSignature === ENS_EXPIRY_EXTENDED) return { logInformation: handleEnsExpiryExtended(parsedEvent), type: 'ENS' as const, subType: 'ENSExpiryExtended' as const }
			// TransferSingle (index_topic_1 address operator, index_topic_2 address from, index_topic_3 address to, uint256 id, uint256 value)
		}
		else if (parsedEvent.loggersAddressBookEntry.address === ENS_ETH_REGISTRAR_CONTROLLER) {
			if (logSignature === ENS_CONTROLLER_NAME_REGISTERED) return { logInformation: handleControllerNameRegistered(parsedEvent), type: 'ENS' as const, subType: 'ENSControllerNameRegistered' as const }
			if (logSignature === ENS_CONTROLLER_NAME_RENEWED) return { logInformation: handleEnsControllerNameRenewed(parsedEvent), type: 'ENS' as const, subType: 'ENSControllerNameRenewed' as const }
		}
		else if(parsedEvent.loggersAddressBookEntry.address === ENS_ETHEREUM_NAME_SERVICE) {
			if (logSignature === ENS_BASE_REGISTRAR_NAME_RENEWED) return { logInformation: handleBaseRegistrarNameRenewed(parsedEvent), type: 'ENS' as const, subType: 'ENSBaseRegistrarNameRenewed' as const }
			if (logSignature === ENS_BASE_REGISTRAR_NAME_REGISTERED) return { logInformation: handleBaseRegistrarNameRegistered(parsedEvent), type: 'ENS' as const, subType: 'ENSBaseRegistrarNameRegistered' as const }
			// Transfer (index_topic_1 address from, index_topic_2 address to, index_topic_3 uint256 tokenId)
			// ApprovalForAll (index_topic_1 address owner, index_topic_2 address operator, bool approved)
		}
		else if(parsedEvent.loggersAddressBookEntry.address === ENS_REGISTRY_WITH_FALLBACK) {
			if (logSignature === ENS_TRANSFER) return { logInformation: handleEnsTransfer(parsedEvent), type: 'ENS' as const, subType: 'ENSTransfer' as const }
			if (logSignature === ENS_NEW_OWNER) return { logInformation: handleEnsNewOwner(parsedEvent), type: 'ENS' as const, subType: 'ENSNewOwner' as const }
			if (logSignature === ENS_NEW_RESOLVER) return { logInformation: handleEnsNewResolver(parsedEvent), type: 'ENS' as const, subType: 'ENSNewResolver' as const }
			if (logSignature === ENS_NEW_TTL) return { logInformation: handleEnsNewTtl(parsedEvent), type: 'ENS' as const, subType: 'ENSNewTTL' as const }
			if (logSignature === ENS_EXPIRY_EXTENDED) return { logInformation: handleEnsExpiryExtended(parsedEvent), type: 'ENS' as const, subType: 'ENSExpiryExtended' as const }
		}
		else if(parsedEvent.loggersAddressBookEntry.address === ENS_REVERSE_REGISTRAR) {
			if (logSignature === ENS_REVERSE_CLAIMED) return { logInformation: handleEnsReverseClaimed(parsedEvent), type: 'ENS' as const, subType: 'ENSReverseClaimed' as const }
		}
	}
	return undefined
}

export const parseInputData = async (transaction: { to: EthereumAddress | undefined | null, value: EthereumQuantity, input: EthereumData}, ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined): Promise<EnrichedEthereumInputData> => {
	const nonParsed = { input: transaction.input, type: 'NonParsed' as const }
	if (transaction.to === undefined || transaction.to === null) return nonParsed
	const addressBookEntry = await identifyAddress(ethereumClientService, requestAbortController, transaction.to)
	const abi = getAbi(addressBookEntry)
	if (!abi) return nonParsed
	const parsed = parseTransactionInputIfPossible(new Interface(abi), transaction.input, transaction.value)
	if (parsed === null) return nonParsed
	const argTypes = extractFunctionArgumentTypes(parsed.signature)
	if (argTypes === undefined) return nonParsed
	if (parsed.args.length !== argTypes.length) return nonParsed
	try {
		const valuesWithTypes = parsed.args.map((value, index) => {
			const solidityType = argTypes[index]
			const paramName = parsed.fragment.inputs[index]?.name
			if (paramName === undefined) throw new Error('missing parameter name')
			if (solidityType === undefined) throw new Error(`unknown solidity type: ${ solidityType }`)
			const isArray = solidityType.includes('[')
			const verifiedSolidityType = SolidityType.safeParse(removeTextBetweenBrackets(solidityType))
			if (verifiedSolidityType.success === false) throw new Error(`unknown solidity type: ${ solidityType }`)
			if (typeof value === 'object' && value !== null && 'hash' in value) {
				// this field is stored as a hash instead as an original object
				return { paramName, typeValue: { type: 'fixedBytes' as const, value: EthereumData.parse(value.hash) } }
			}
			return { paramName, typeValue: parseSolidityValueByTypePure(verifiedSolidityType.value, value, isArray) }
		})
		return {
			input: transaction.input,
			type: 'Parsed' as const,
			name: parsed.name,
			args: valuesWithTypes,
		}
	} catch(e: unknown) {
		console.log(transaction)
		console.error(e)
		return nonParsed
	}
}

export const parseEvents = async (events: readonly EthereumEvent[], ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined): Promise<readonly EnrichedEthereumEvent[]> => {
	const parsedEvents = await Promise.all(events.map(async (event) => {
		// todo, we should do this parsing earlier, to be able to add possible addresses to addressMetaData set
		const loggersAddressBookEntry = await identifyAddress(ethereumClientService, requestAbortController, event.address)
		const abi = getAbi(loggersAddressBookEntry)
		const nonParsed = { ...event, isParsed: 'NonParsed' as const, loggersAddressBookEntry }
		if (!abi) return nonParsed
		const parsed = parseEventIfPossible(new Interface(abi), event)
		if (parsed === null) return nonParsed
		const argTypes = extractFunctionArgumentTypes(parsed.signature)
		if (argTypes === undefined) return nonParsed
		if (parsed.args.length !== argTypes.length) return nonParsed
		const valuesWithTypes = parsed.args.map((value, index) => {
			const solidityType = argTypes[index]
			const paramName = parsed.fragment.inputs[index]?.name
			if (paramName === undefined) throw new Error('missing parameter name')
			if (solidityType === undefined) throw new Error(`unknown solidity type: ${ solidityType }`)
			const isArray = solidityType.includes('[')
			const verifiedSolidityType = SolidityType.safeParse(removeTextBetweenBrackets(solidityType))
			if (verifiedSolidityType.success === false) throw new Error(`unknown solidity type: ${ solidityType }`)
			if (typeof value === 'object' && value !== null && 'hash' in value) {
				// this field is stored as a hash instead as an original object
				return { paramName, typeValue: { type: 'fixedBytes' as const, value: EthereumData.parse(value.hash) } }
			}
			return { paramName, typeValue: parseSolidityValueByTypePure(verifiedSolidityType.value, value, isArray) }
		})
		return {
			...event,
			isParsed: 'Parsed' as const,
			name: parsed.name,
			signature: parsed.signature,
			args: valuesWithTypes,
			loggersAddressBookEntry,
		}
	}))

	const maybeParsedEvents: EnrichedEthereumEvent[][] = parsedEvents.map((parsedEvent) => {
		if (parsedEvent.isParsed === 'NonParsed') return [{ ...parsedEvent, type: 'NonParsed' }]
		const logSignature = parsedEvent.topics[0]
		if (logSignature === undefined) return [{ ...parsedEvent, type: 'Parsed' }]

		const handledEnsEvent = ensEventHandler(parsedEvent)
		if (handledEnsEvent !== undefined) return [{ ...parsedEvent, ...handledEnsEvent }]
		return [{ ...parsedEvent, type: 'Parsed' }]
	})
	return maybeParsedEvents.flat()
}

export const runProtectorsForTransaction = async (_: SimulationState, __: WebsiteCreatedEthereumUnsignedTransaction, ___: EthereumClientService, ____: AbortController | undefined) => {
	const reasons: (string | undefined)[] = []
	const filteredReasons = reasons.filter((reason): reason is string => reason !== undefined)
	return {
		quarantine: filteredReasons.length > 0,
		quarantineReasons: Array.from(new Set<string>(filteredReasons)),
	}
}

type NewBlockCallBack = (blockHeader: EthereumBlockHeader, ethereumClientService: EthereumClientService, isNewBlock: boolean, simulator: Simulator) => Promise<void>
export class Simulator {
	public ethereum: EthereumClientService
	private newBlockAttemptCallback: NewBlockCallBack
	public constructor(rpcNetwork: RpcEntry, newBlockAttemptCallback: NewBlockCallBack, onErrorBlockCallback: (ethereumClientService: EthereumClientService, error: unknown) => Promise<void>) {
		this.newBlockAttemptCallback = newBlockAttemptCallback
		this.ethereum = new EthereumClientService(
			new EthereumJSONRpcRequestHandler(rpcNetwork.httpsRpc, true),
			async (blockHeader: EthereumBlockHeader, ethereumClientService: EthereumClientService, isNewBlock: boolean) => await newBlockAttemptCallback(blockHeader, ethereumClientService, isNewBlock, this),
			onErrorBlockCallback,
			rpcNetwork
		)
	}

	public cleanup = () => this.ethereum.cleanup()

	public reset = (rpcNetwork: RpcEntry) => {
		this.cleanup()
		this.ethereum = new EthereumClientService(
			new EthereumJSONRpcRequestHandler(rpcNetwork.httpsRpc, true),
			async (blockHeader: EthereumBlockHeader, ethereumClientService: EthereumClientService, isNewBlock: boolean) => await this.newBlockAttemptCallback(blockHeader, ethereumClientService, isNewBlock, this),
			this.ethereum.getOnErrorBlockCallback(),
			rpcNetwork
		)
	}
}
