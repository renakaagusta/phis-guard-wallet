import { identifyAddress } from '../background/metadataUtils.js'
import { EnrichedEthereumEvent, EnrichedEthereumInputData } from '../types/EnrichedEthereumData.js'
import { EthereumEvent } from '../types/ethSimulate-types.js'
import { RpcEntry } from '../types/rpc.js'
import { EthereumAddress, EthereumBlockHeader, EthereumData, EthereumQuantity } from '../types/wire-types.js'
import { getAbi } from '../utils/abi.js'
import { EthereumClientService } from './services/EthereumClientService.js'
import { EthereumJSONRpcRequestHandler } from './services/EthereumJSONRpcRequestHandler.js'

export const parseInputData = async (transaction: { to: EthereumAddress | undefined | null, value: EthereumQuantity, input: EthereumData}, ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined): Promise<EnrichedEthereumInputData> => {
	const nonParsed = { input: transaction.input, type: 'NonParsed' as const }
	if (transaction.to === undefined || transaction.to === null) return nonParsed
	const addressBookEntry = await identifyAddress(ethereumClientService, requestAbortController, transaction.to)
	const abi = getAbi(addressBookEntry)
	if (!abi) return nonParsed
	return nonParsed
	// const parsed = parseTransactionInputIfPossible(new Interface(abi as any), transaction.input, transaction.value)
	// if (parsed === null) return nonParsed
	// const argTypes = extractFunctionArgumentTypes(parsed.signature)
	// if (argTypes === undefined) return nonParsed
	// if (parsed.args.length !== argTypes.length) return nonParsed
	// try {
	// 	const valuesWithTypes = parsed.args.map((value, index) => {
	// 		const solidityType = argTypes[index]
	// 		const paramName = parsed.fragment.inputs[index]?.name
	// 		if (paramName === undefined) throw new Error('missing parameter name')
	// 		if (solidityType === undefined) throw new Error(`unknown solidity type: ${ solidityType }`)
	// 		const isArray = solidityType.includes('[')
	// 		const verifiedSolidityType = SolidityType.safeParse(removeTextBetweenBrackets(solidityType))
	// 		if (verifiedSolidityType.success === false) throw new Error(`unknown solidity type: ${ solidityType }`)
	// 		if (typeof value === 'object' && value !== null && 'hash' in value) {
	// 			// this field is stored as a hash instead as an original object
	// 			return { paramName, typeValue: { type: 'fixedBytes' as const, value: EthereumData.parse(value.hash) } }
	// 		}
	// 		return { paramName, typeValue: parseSolidityValueByTypePure(verifiedSolidityType.value, value, isArray) }
	// 	})
	// 	return {
	// 		input: transaction.input,
	// 		type: 'Parsed' as const,
	// 		name: parsed.name,
	// 		args: valuesWithTypes,
	// 	}
	// } catch(e: unknown) {
	// 	console.log(transaction)
	// 	console.error(e)
	// 	return nonParsed
	// }
}

export const parseEvents = async (events: readonly EthereumEvent[], ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined): Promise<readonly EnrichedEthereumEvent[]> => {
	const parsedEvents = await Promise.all(events.map(async (event) => {
		// todo, we should do this parsing earlier, to be able to add possible addresses to addressMetaData set
		const loggersAddressBookEntry = await identifyAddress(ethereumClientService, requestAbortController, event.address)
		const abi = getAbi(loggersAddressBookEntry)
		const nonParsed = { ...event, isParsed: 'NonParsed' as const, loggersAddressBookEntry }
		if (!abi) return nonParsed
		// const parsed = parseEventIfPossible(new Interface(abi as any), event)
		return nonParsed
		// const argTypes = extractFunctionArgumentTypes(parsed.signature)
		// if (argTypes === undefined) return nonParsed
		// if (parsed.args.length !== argTypes.length) return nonParsed
		// const valuesWithTypes = parsed.args.map((value, index) => {
		// 	const solidityType = argTypes[index]
		// 	const paramName = parsed.fragment.inputs[index]?.name
		// 	if (paramName === undefined) throw new Error('missing parameter name')
		// 	if (solidityType === undefined) throw new Error(`unknown solidity type: ${ solidityType }`)
		// 	const isArray = solidityType.includes('[')
		// 	const verifiedSolidityType = SolidityType.safeParse(removeTextBetweenBrackets(solidityType))
		// 	if (verifiedSolidityType.success === false) throw new Error(`unknown solidity type: ${ solidityType }`)
		// 	if (typeof value === 'object' && value !== null && 'hash' in value) {
		// 		// this field is stored as a hash instead as an original object
		// 		return { paramName, typeValue: { type: 'fixedBytes' as const, value: EthereumData.parse(value.hash) } }
		// 	}
		// 	return { paramName, typeValue: parseSolidityValueByTypePure(verifiedSolidityType.value, value, isArray) }
		// })
		// return {
		// 	...event,
		// 	isParsed: 'Parsed' as const,
		// 	name: parsed.name,
		// 	signature: parsed.signature,
		// 	args: valuesWithTypes,
		// 	loggersAddressBookEntry,
		// }
	}))

	const maybeParsedEvents: EnrichedEthereumEvent[][] = parsedEvents.map((parsedEvent) => {
		if (parsedEvent.isParsed === 'NonParsed') return [{ ...parsedEvent, type: 'NonParsed' }]
		const logSignature = parsedEvent.topics[0]
		if (logSignature === undefined) return [{ ...parsedEvent, type: 'Parsed' }]

		return [{ ...parsedEvent, type: 'Parsed' }]
	}) as any
	return maybeParsedEvents.flat()
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
