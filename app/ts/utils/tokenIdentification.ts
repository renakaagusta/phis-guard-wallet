import { IEthereumClientService } from '../simulation/services/EthereumClientService.js'
import { EthereumAddress } from '../types/wire-types.js'

type EOA = {
	type: 'EOA'
	address: EthereumAddress
}
export type IdentifiedAddress = (EOA)

async function tryAggregateMulticall(ethereumClientService: IEthereumClientService, requestAbortController: AbortController | undefined, calls: { targetAddress: EthereumAddress, callData: Uint8Array }[]): Promise<{ success: boolean, returnData: Uint8Array }[]> {
	const results = await ethereumClientService.ethSimulateV1([{ calls: calls.map((call) => ({
		type: '1559' as const,
		to: call.targetAddress,
		input: call.callData
	}))}], 'latest', requestAbortController)
	const blockResult = results[0]
	if (blockResult === undefined) throw new Error('Failed eth_simulateV1 call: did not get a block')
	if (blockResult.calls.length !== calls.length) throw new Error('Failed eth_simulateV1 call: call length mismatch')
	return blockResult.calls.map((call) => ({
		success: call.status === 'success',
		returnData: call.returnData
	}))
}

export async function itentifyAddressViaOnChainInformation(ethereumClientService: IEthereumClientService, requestAbortController: AbortController | undefined, address: EthereumAddress): Promise<IdentifiedAddress> {
	const contractCode = await ethereumClientService.getCode(address, 'latest', requestAbortController)
	if (contractCode.length === 0) return { type: 'EOA', address }


	try {
		const [isErc721, hasMetadata, isErc1155, name, symbol, decimals, totalSupply] = await tryAggregateMulticall(ethereumClientService, requestAbortController, [])
		if (isErc721 === undefined || hasMetadata === undefined || isErc1155 === undefined || name === undefined || symbol === undefined || decimals === undefined || totalSupply === undefined) throw new Error('Multicall result is too short')
	
	} catch (error) {
		// For any reason decoding txing fails catch and return as unknown contract
		console.warn(error)
	}

	return { type: 'EOA', address }
}
