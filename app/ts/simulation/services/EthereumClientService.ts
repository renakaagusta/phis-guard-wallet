import * as funtypes from 'funtypes'
import { EthSimulateV1Result, StateOverrides } from '../../types/ethSimulate-types.js'
import { DappRequestTransaction, EthGetLogsRequest, EthGetLogsResponse, EthGetStorageAtResponse, EthTransactionReceiptResponse } from '../../types/JsonRpc-types.js'
import { RpcEntry } from '../../types/rpc.js'
import { EthereumBlockHeader, EthereumBlockHeaderWithTransactionHashes, EthereumBlockTag, EthereumBytes32, EthereumData, EthereumQuantity, EthereumSignedTransactionWithBlockData, OptionalEthereumUnsignedTransaction } from '../../types/wire-types.js'
import { MAX_BLOCK_CACHE, TIME_BETWEEN_BLOCKS } from '../../utils/constants.js'
import { IUnsignedTransaction1559 } from '../../utils/ethereum.js'
import { IEthereumJSONRpcRequestHandler } from './EthereumJSONRpcRequestHandler.js'
import { SignatureWithFakeSignerAddress } from './SimulationModeEthereumClientService.js'

export type IEthereumClientService = Pick<EthereumClientService, keyof EthereumClientService>
export class EthereumClientService {
	private cachedBlock: EthereumBlockHeader | undefined = undefined
	private cacheRefreshTimer: NodeJS.Timer | undefined = undefined
	private retrievingBlock = false
	private newBlockAttemptCallback: (blockHeader: EthereumBlockHeader, ethereumClientService: EthereumClientService, isNewBlock: boolean) => Promise<void>
	private onErrorBlockCallback: (ethereumClientService: EthereumClientService, error: unknown) => Promise<void>
	private requestHandler
	private rpcEntry

    constructor(requestHandler: IEthereumJSONRpcRequestHandler, newBlockAttemptCallback: (blockHeader: EthereumBlockHeader, ethereumClientService: EthereumClientService, isNewBlock: boolean) => Promise<void>, onErrorBlockCallback: (ethereumClientService: EthereumClientService, error: unknown) => Promise<void>, rpcEntry: RpcEntry) {
		this.requestHandler = requestHandler
		this.newBlockAttemptCallback = newBlockAttemptCallback
		this.onErrorBlockCallback = onErrorBlockCallback
		this.rpcEntry = rpcEntry

		if (this.rpcEntry.httpsRpc !== requestHandler.rpcUrl) throw new Error('The URL values for rpcEntry and requestHander must match')
    }

	public readonly getRpcEntry = () => this.rpcEntry

	public readonly getNewBlockAttemptCallback = () => this.newBlockAttemptCallback
	public readonly getOnErrorBlockCallback = () => this.onErrorBlockCallback

	public getCachedBlock = () => {
		if (this.cachedBlock === undefined || this.cachedBlock === null) return undefined
		// if the block is older than MAX_BLOCK_CACHE block intervals, invalidate cache
		if ((Date.now() - this.cachedBlock.timestamp.getTime() * 1000) > TIME_BETWEEN_BLOCKS * MAX_BLOCK_CACHE) return undefined
		return this.cachedBlock
	}
	public cleanup = () => this.setBlockPolling(false)

	public readonly isBlockPolling = () => this.cacheRefreshTimer !== undefined

	public readonly setBlockPolling = (enabled: boolean) => {
		if (enabled && this.cacheRefreshTimer === undefined) {
			const now = Date.now()

			// query block everytime clock hits time % 12 + 7
			this.updateCache()
			const timeToTarget = Math.floor(now / 1000 / TIME_BETWEEN_BLOCKS) * 1000 * TIME_BETWEEN_BLOCKS + 7 * 1000 - now
			this.cacheRefreshTimer = setTimeout(() => { // wait until the clock is just right ( % 12 + 7 ), an then start querying every TIME_BETWEEN_BLOCKS secs
				this.updateCache()
				this.cacheRefreshTimer = setInterval(this.updateCache, TIME_BETWEEN_BLOCKS * 1000)
			}, timeToTarget > 0 ? timeToTarget : timeToTarget + TIME_BETWEEN_BLOCKS * 1000 )
			return
		}
		if (!enabled) {
			clearTimeout(this.cacheRefreshTimer)
			clearInterval(this.cacheRefreshTimer)
			this.cacheRefreshTimer = undefined
			this.cachedBlock = undefined
			return
		}
	}

	private readonly updateCache = async () => {
		if (this.retrievingBlock) return
		try {
			this.retrievingBlock = true
			const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getBlockByNumber', params: ['latest', true] }, undefined, true, 6000)
			if (this.cacheRefreshTimer === undefined) return
			const newBlock = EthereumBlockHeader.parse(response)
			if (newBlock === null) return
			console.info(`Current block number: ${ newBlock.number } on ${ this.getRpcEntry().name }`)
			const gotNewBlock = this.cachedBlock?.number !== newBlock.number
			if (gotNewBlock) this.requestHandler.clearCache()
			this.newBlockAttemptCallback(newBlock, this, gotNewBlock)
			this.cachedBlock = newBlock
		} catch(error: unknown) {
			return this.onErrorBlockCallback(this, error)
		} finally {
			this.retrievingBlock = false
		}
	}

	public readonly estimateGas = async (data: DappRequestTransaction, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_estimateGas', params: [data] }, requestAbortController )
		return EthereumQuantity.parse(response)
	}

	public readonly debugTraceCall = async (data: DappRequestTransaction, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'debug_traceCall', params: [data] }, requestAbortController)
		return response
	}

	public readonly getStorageAt = async (contract: bigint, slot: bigint, blockTag: EthereumBlockTag, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getStorageAt', params: [contract, slot, blockTag] }, requestAbortController)
		return EthGetStorageAtResponse.parse(response)
	}

	public readonly getTransactionCount = async (address: bigint, blockTag: EthereumBlockTag, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getTransactionCount', params: [address, blockTag] }, requestAbortController)
		return EthereumQuantity.parse(response)
	}

	public readonly getTransactionReceipt = async (hash: bigint, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getTransactionReceipt', params: [hash] }, requestAbortController)
		return EthTransactionReceiptResponse.parse(response)
	}

	public readonly getBalance = async (address: bigint, blockTag: EthereumBlockTag, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getBalance', params: [address, blockTag] }, requestAbortController)
		return EthereumQuantity.parse(response)
	}

	public readonly getCode = async (address: bigint, blockTag: EthereumBlockTag, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getCode', params: [address, blockTag] }, requestAbortController)
		return EthereumData.parse(response)
	}

	public async getBlock(requestAbortController: AbortController | undefined, blockTag?: EthereumBlockTag, fullObjects?: true): Promise<EthereumBlockHeader>
	public async getBlock(requestAbortController: AbortController | undefined, blockTag: EthereumBlockTag, fullObjects: boolean): Promise<EthereumBlockHeaderWithTransactionHashes | EthereumBlockHeader>
	public async getBlock(requestAbortController: AbortController | undefined, blockTag: EthereumBlockTag, fullObjects: false): Promise<EthereumBlockHeaderWithTransactionHashes>
	public async getBlock(requestAbortController: AbortController | undefined, blockTag: EthereumBlockTag = 'latest', fullObjects = true): Promise<EthereumBlockHeaderWithTransactionHashes | EthereumBlockHeader> {
		const cached = this.getCachedBlock()
		if (cached && (blockTag === 'latest' || blockTag === cached.number)) {
			if (fullObjects === false) return { ...cached, transactions: cached.transactions.map((transaction) => transaction.hash) }
			return cached
		}
		if (fullObjects === false) return EthereumBlockHeaderWithTransactionHashes.parse(await this.requestHandler.jsonRpcRequest({ method: 'eth_getBlockByNumber', params: [blockTag, false] }))
		return EthereumBlockHeader.parse(await this.requestHandler.jsonRpcRequest({ method: 'eth_getBlockByNumber', params: [blockTag, fullObjects] }, requestAbortController))
	}

	public async getBlockByHash(blockHash: EthereumBytes32, requestAbortController: AbortController | undefined, fullObjects = true): Promise<EthereumBlockHeaderWithTransactionHashes | EthereumBlockHeader> {
		const cached = this.getCachedBlock()
		if (cached && (cached.hash === blockHash)) {
			if (fullObjects === false) {
				return { ...cached, transactions: cached.transactions.map((transaction) => transaction.hash) }
			}
			return cached
		}
		if (fullObjects === false) {
			return EthereumBlockHeaderWithTransactionHashes.parse(await this.requestHandler.jsonRpcRequest({ method: 'eth_getBlockByHash', params: [blockHash, false] }))
		}
		return EthereumBlockHeader.parse(await this.requestHandler.jsonRpcRequest({ method: 'eth_getBlockByHash', params: [blockHash, fullObjects] }, requestAbortController))
	}

	public readonly getChainId = () => this.getRpcEntry().chainId

	public readonly getLogs = async (logFilter: EthGetLogsRequest, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getLogs', params: [logFilter] }, requestAbortController)
		return EthGetLogsResponse.parse(response)
	}

	public readonly getBlockNumber = async (requestAbortController: AbortController | undefined) => {
		const cached = this.getCachedBlock()
		if (cached) return cached.number
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_blockNumber' }, requestAbortController)
		return EthereumQuantity.parse(response)
	}

	public readonly getGasPrice = async(requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_gasPrice' }, requestAbortController)
		return EthereumQuantity.parse(response)
	}

	public readonly getTransactionByHash = async (hash: bigint, requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_getTransactionByHash', params: [hash] }, requestAbortController)
		if (response === null) return null
		return EthereumSignedTransactionWithBlockData.parse(response)
	}

	public readonly call = async (transaction: Partial<Pick<IUnsignedTransaction1559, 'to' | 'from' | 'input' | 'value' | 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'gasLimit'>>, blockTag: EthereumBlockTag, requestAbortController: AbortController | undefined) => {
		if (transaction.to === null) throw new Error('To cannot be null')
		const params = {
			to: transaction.to,
			from: transaction.from,
			data: transaction.input,
			value: transaction.value,
			...transaction.maxFeePerGas !== undefined && transaction.maxPriorityFeePerGas !== undefined ? { gasPrice: transaction.maxFeePerGas + transaction.maxPriorityFeePerGas } : {},
			gas: transaction.gasLimit
		}
		const response = await this.requestHandler.jsonRpcRequest({ method: 'eth_call', params: [params, blockTag] }, requestAbortController)
		return response as string
	}

	public readonly simulateTransactionsAndSignatures = async (_: readonly OptionalEthereumUnsignedTransaction[][], __: readonly SignatureWithFakeSignerAddress[], ___: bigint, ____: AbortController | undefined, _____: StateOverrides = {}) => {
		// const transactionsWithRemoveZeroPricedOnes = transactionsInBlocks.map((block) => block.map((transaction) => {
		// 	if (transaction.type !== '1559') return transaction
		// 	const { maxFeePerGas, ...transactionWithoutMaxFee } = transaction
		// 	return { ...transactionWithoutMaxFee, ...maxFeePerGas === 0n ? {} : { maxFeePerGas } }
		// }))
		// const parentBlock = await this.getBlock(requestAbortController, blockNumber)
		// if (parentBlock === null) throw new Error(`The block ${ blockNumber } is null`)

		// const [firstBlocksTransactions] = transactionsWithRemoveZeroPricedOnes
		// if (firstBlocksTransactions === undefined) throw new Error('No blocks specified for simulateTransactionsAndSignatures')

	
		// if (EthSimulateV1Result.parse([]).length !== transactionsWithRemoveZeroPricedOnes.length) throw new Error(`Ran Eth Simulate for ${ transactionsWithRemoveZeroPricedOnes.length } blocks but got ${ EthSimulateV1Result.parse([]).length } blocks`)
		// return EthSimulateV1Result.parse([])
		return EthSimulateV1Result.parse([])
	}

	public readonly web3ClientVersion = async (requestAbortController: AbortController | undefined) => {
		const response = await this.requestHandler.jsonRpcRequest({ method: 'web3_clientVersion', params: [] }, requestAbortController)
		return funtypes.String.parse(response)
	}
}
