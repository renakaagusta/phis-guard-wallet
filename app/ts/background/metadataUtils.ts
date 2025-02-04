import { keccak_256 } from '@noble/hashes/sha3'
import { ethers } from 'ethers'
import { EthereumClientService } from '../simulation/services/EthereumClientService.js'
import { AddressBookEntries, AddressBookEntry } from '../types/addressBookTypes.js'
import { EnrichedEthereumEvents, EnrichedEthereumInputData, SolidityVariable } from '../types/EnrichedEthereumData.js'
import { ENSNameHashes } from '../types/ens.js'
import { RpcNetwork } from '../types/rpc.js'
import { NamedTokenId, SimulationState } from '../types/visualizer-types.js'
import { EthereumBytes32 } from '../types/wire-types.js'
import { addressString, addressStringWithout0x, bytesToUnsigned, checksummedAddress } from '../utils/bigint.js'
import { ENS_ADDR_REVERSE_NODE, ENS_TOKEN_WRAPPER, ETHEREUM_LOGS_LOGGER_ADDRESS, MOCK_ADDRESS } from '../utils/constants.js'
import { getEnsReverseNodeHash, getEthereumNameServiceNameFromTokenId } from '../utils/ethereumNameService.js'
import { IdentifiedAddress, itentifyAddressViaOnChainInformation } from '../utils/tokenIdentification.js'
import { getUniqueItemsByProperties } from '../utils/typed-arrays.js'
import { defaultActiveAddresses } from './settings.js'
import { addEnsLabelHash, addEnsNodeHash, addUserAddressBookEntryIfItDoesNotExist, getEnsLabelHashes, getEnsNodeHashes, getUserAddressBookEntries, getUserAddressBookEntriesForChainIdMorePreciseFirst } from './storageVariables.js'
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
		askForAddressAccess: true,
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

export async function identifyAddress(ethereumClientService: EthereumClientService, requestAbortController: AbortController | undefined, address: bigint, useLocalStorage = true) : Promise<AddressBookEntry> {
	const identifiedAddress = await identifyAddressWithoutNode(address, ethereumClientService.getRpcEntry(), useLocalStorage)
	if (identifiedAddress !== undefined) return identifiedAddress
	const addrString = addressString(address)
	const tokenIdentification = await itentifyAddressViaOnChainInformation(ethereumClientService, requestAbortController, address)
	const chainId = ethereumClientService.getChainId()
	const getEntry = (tokenIdentification: IdentifiedAddress) => {
		switch (tokenIdentification.type) {
			default:
			case 'EOA': return {
				address,
				name: ethers.getAddress(addrString),
				type: 'contact' as const,
				entrySource: 'OnChain' as const,
				chainId
			}
		}
	}
	const entry = getEntry(tokenIdentification)
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

export async function nameTokenIds(ethereumClientService: EthereumClientService, events: EnrichedEthereumEvents) {
	type TokenAddressTokenIdPair = { tokenAddress: bigint, tokenId: bigint }
	const tokenAddresses = events.map((event) => {
		if (event.type !== 'TokenEvent' || event.logInformation.type !== 'ERC1155') return undefined
		return { tokenAddress: event.logInformation.tokenAddress, tokenId: event.logInformation.tokenId }
	}).filter((pair): pair is TokenAddressTokenIdPair => pair !== undefined)

	const pairs = getUniqueItemsByProperties(tokenAddresses, ['tokenAddress', 'tokenId'])
	const namedPairs = (await Promise.all(pairs.map(async (pair) => {
		if (pair.tokenAddress === ENS_TOKEN_WRAPPER && ethereumClientService.getChainId() === 1n) {
			const tokenIdName = (await getAndCacheEnsNodeHash(ethereumClientService, pair.tokenId, [])).name
			if (tokenIdName === undefined) return undefined
			return { ...pair, tokenIdName }
		}
		return undefined
	}))).filter((pair): pair is NamedTokenId => pair !== undefined)
	return namedPairs
}

export const extractTokenEvents = (events: readonly any[]): readonly any[] => {
	return events.filter((tokenEvent): tokenEvent is any => tokenEvent.type === 'TokenEvent').map((token) => token.logInformation)
}
export const extractEnsEvents = (events: readonly any[]): readonly any[] => {
	return events.filter((tokenEvent): tokenEvent is any => tokenEvent.type === 'ENS')
}

export const retrieveEnsNodeAndLabelHashes = async (ethereumClientService: EthereumClientService, events: EnrichedEthereumEvents, addressBookEntriesToMatchReverseResolutions: readonly AddressBookEntry[]) => {
	const labelHashesToRetrieve = events.map((event) => 'logInformation' in event && 'labelHash' in event.logInformation ? event.logInformation.labelHash : undefined).filter((labelHash): labelHash is bigint => labelHash !== undefined)
	const reverseEnsLabelHashes = addressBookEntriesToMatchReverseResolutions.map((entry) => addressStringWithout0x(entry.address)).map((label) => ({ label, labelHash: bytesToUnsigned(keccak_256(label)) }))
	const newLabels = [...events.map((event) => 'logInformation' in event && 'name' in event.logInformation ? event.logInformation.name : undefined).filter((label): label is string => label !== undefined)]

	// update the mappings if we have new labels
	const deduplicatedLabels = Array.from(new Set(newLabels))
	await Promise.all(deduplicatedLabels.map(async (label) => Promise.all([await addEnsLabelHash(label), await addEnsNodeHash(label.endsWith('.eth') ? label : `${ label }.eth`)])))

	// return the label hashes that we have now available
	const currentLabelHashes = [...reverseEnsLabelHashes, ...await getEnsLabelHashes()]
	const ensLabelHashes = Array.from(new Set(labelHashesToRetrieve)).map((labelHash) => {
		const found = currentLabelHashes.find((entry) => entry.labelHash === labelHash)
		if (found) addEnsLabelHash(found.label) // if we actally use the label, add to our cache. This should already be there unless it was a reverse ens label hash that we guessed
		return { labelHash, label: found?.label }
	})

	const hashes = new Set<bigint>()
	for (const event of events) {
		if (!('logInformation' in event && 'node' in event.logInformation)) continue
		hashes.add(event.logInformation.node)
	}
	const reverseEnsNameHashes = addressBookEntriesToMatchReverseResolutions.map((addressBookEntry) => getEnsReverseNodeHash(addressBookEntry.address))
	const ensNameHashes = await Promise.all([...hashes].map((hash) => getAndCacheEnsNodeHash(ethereumClientService, hash, reverseEnsNameHashes)))

	return { ensNameHashes, ensLabelHashes }
}

const addNewEnsNameEntry = async (name: string) => {
	const [label] = name.split('.')
	if (label !== undefined) await addEnsLabelHash(label)
	await addEnsNodeHash(name)
}

const getAndCacheEnsNodeHash = async (ethereumClientService: EthereumClientService, ensNameHash: EthereumBytes32, extraNameHashes: ENSNameHashes) => {
	const currentHashes = [ENS_ADDR_REVERSE_NODE, ...await getEnsNodeHashes()]
	const entry = currentHashes.find((entry) => entry.nameHash === ensNameHash)
	if (entry !== undefined) return entry

	const extraNameEntry = extraNameHashes.find((entry) => entry.nameHash === ensNameHash)
	if (extraNameEntry !== undefined) { // extra name entries do not exist in our localstorage, so if we find a match, lets add them there
		await addNewEnsNameEntry(extraNameEntry.name)
		return extraNameEntry
	}

	const name = await getEthereumNameServiceNameFromTokenId(ethereumClientService, undefined, ensNameHash)
	if (name !== undefined) await addNewEnsNameEntry(name)
	return { nameHash: ensNameHash, name }
}
