import { ethers } from 'ethers'
import { EthereumClientService } from '../simulation/services/EthereumClientService.js'
import { AddressBookEntries, AddressBookEntry } from '../types/addressBookTypes.js'
import { EnrichedEthereumEvents, EnrichedEthereumInputData, SolidityVariable } from '../types/EnrichedEthereumData.js'
import { RpcNetwork } from '../types/rpc.js'
import { SimulationState } from '../types/visualizer-types.js'
import { addressString, checksummedAddress } from '../utils/bigint.js'
import { ETHEREUM_LOGS_LOGGER_ADDRESS, MOCK_ADDRESS } from '../utils/constants.js'
import { defaultActiveAddresses } from './settings.js'
import { addUserAddressBookEntryIfItDoesNotExist, getUserAddressBookEntries, getUserAddressBookEntriesForChainIdMorePreciseFirst } from './storageVariables.js'
const LOGO_URI_PREFIX = '../vendor/@darkflorist/address-metadata'

const pathJoin = (parts: string[], sep = '/') => parts.join(sep).replace(new RegExp(sep + '{1,}', 'g'), sep)

export const getFullLogoUri = (logoURI: string) => pathJoin([LOGO_URI_PREFIX, logoURI])

export async function getActiveAddressEntry(address: bigint): Promise<AddressBookEntry> {
	const identifiedAddress = await identifyAddressWithoutNode(address, undefined)
	if (identifiedAddress?.useAsActiveAddress) return identifiedAddress
	return {
		type: 'contact' as const,
		name: checksummedAddress(address),
		useAsActiveAddress: true,
		address: address,
		entrySource: 'FilledIn'
	}
}

export async function getActiveAddresses() : Promise<AddressBookEntries> {
	const activeAddresses = (await getUserAddressBookEntries()).filter((entry) => entry.useAsActiveAddress)
	return activeAddresses === undefined || activeAddresses.length === 0 ? defaultActiveAddresses : activeAddresses
}

async function identifyAddressWithoutNode(address: bigint, rpcEntry: RpcNetwork | undefined, useLocalStorage = true) : Promise<AddressBookEntry | undefined> {
	if (useLocalStorage) {
		const userEntry = (await getUserAddressBookEntriesForChainIdMorePreciseFirst(rpcEntry?.chainId || 1n)).find((entry) => entry.address === address)
		if (userEntry !== undefined) return userEntry
	}

	if (address === MOCK_ADDRESS) return {
		address: address,
		name: 'Ethereum Validator',
		logoUri: '../../img/contracts/rhino.png',
		type: 'contact',
		entrySource: 'Interceptor',
		chainId: rpcEntry?.chainId
	}
	if (address === 0n) return {
		address: address,
		name: '0x0 Address',
		type: 'contact',
		entrySource: 'Interceptor',
		chainId: rpcEntry?.chainId
	}
	return undefined
}

export async function identifyAddress(ethereumClientService: EthereumClientService, _: AbortController | undefined, address: bigint, useLocalStorage = true) : Promise<AddressBookEntry> {
	const identifiedAddress = await identifyAddressWithoutNode(address, ethereumClientService.getRpcEntry(), useLocalStorage)
	if (identifiedAddress !== undefined) return identifiedAddress
	const addrString = addressString(address)
	const chainId = ethereumClientService.getChainId()
	
	const entry = {
		address,
		name: ethers.getAddress(addrString),
		type: 'contact' as const,
		entrySource: 'OnChain' as const,
		chainId
	}
	if (useLocalStorage) await addUserAddressBookEntryIfItDoesNotExist(entry)
	return entry
}

export const getAddressesForSolidityTypes = (variables: readonly SolidityVariable[]) => {
	return variables.map((argumentVariable) => {
		if (argumentVariable.typeValue.type === 'address') return argumentVariable.typeValue.value
		if (argumentVariable.typeValue.type === 'address[]') return argumentVariable.typeValue.value
		return undefined
	}).filter((address): address is bigint => address !== undefined)
}

export async function getAddressBookEntriesForVisualiser(ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined, events: EnrichedEthereumEvents, inputData: readonly EnrichedEthereumInputData[], simulationState: SimulationState): Promise<AddressBookEntry[]> {
	const eventAndTransactionArguments = [...events.flatMap((event) => event.type !== 'NonParsed' ? event.args : []), ...inputData.flatMap((event) => event.type !== 'NonParsed' ? event.args : [])]
	const addressesInEventsAndInputData = getAddressesForSolidityTypes(eventAndTransactionArguments)
	const addressesToFetchMetadata = [...addressesInEventsAndInputData, ...events.map((event) => event.address)]

	for (const tx of simulationState.simulatedTransactions) {
		addressesToFetchMetadata.push(tx.preSimulationTransaction.signedTransaction.from)
		if (tx.preSimulationTransaction.signedTransaction.to !== null) addressesToFetchMetadata.push(tx.preSimulationTransaction.signedTransaction.to)
	}

	const deDuplicated = new Set<bigint>([...addressesToFetchMetadata, ETHEREUM_LOGS_LOGGER_ADDRESS])
	const addressIdentificationPromises: Promise<AddressBookEntry>[] = Array.from(deDuplicated.values()).map((address) => identifyAddress(ethereumClientService, requestAbortController, address))

	return await Promise.all(addressIdentificationPromises)
}