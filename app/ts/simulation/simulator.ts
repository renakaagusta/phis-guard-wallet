import { EnrichedEthereumEvent } from '../types/EnrichedEthereumData.js'
import { EthereumEvent } from '../types/ethSimulate-types.js'
import { RpcEntry } from '../types/rpc.js'
import { EthereumBlockHeader } from '../types/wire-types.js'
import { EthereumClientService } from './services/EthereumClientService.js'
import { EthereumJSONRpcRequestHandler } from './services/EthereumJSONRpcRequestHandler.js'

export const parseEvents = async (events: readonly EthereumEvent[], _: EthereumClientService, __: AbortController | undefined): Promise<readonly EnrichedEthereumEvent[]> => {
	const maybeParsedEvents: EnrichedEthereumEvent[][] = await Promise.all(events.map(async (event) => {
		return { ...event, type: 'NonParsed' }
	})) as any
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
