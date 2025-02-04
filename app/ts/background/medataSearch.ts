import { AddressBookEntry, ChainIdWithUniversal, ContactEntry } from '../types/addressBookTypes.js'
import { AddressBookCategory, GetAddressBookDataFilter } from '../types/interceptor-messages.js'
import { addressString } from '../utils/bigint.js'
import { getUserAddressBookEntriesForChainId, getUserAddressBookEntriesForChainIdMorePreciseFirst } from './storageVariables.js'

type PartialResult = {
	bestMatchLength: number,
	locationOfBestMatch: number,
}

function fuzzyCompare(pattern: RegExp, searchQuery: string, lowerCasedName: string, address: string) {
	const regexpMatch = bestMatch(lowerCasedName.match(pattern))
	const addressMatch = address.toLowerCase().includes(searchQuery.toLowerCase()) ? searchQuery.toLowerCase() : ''
	const bestMatchString = regexpMatch === undefined || addressMatch.length > regexpMatch.length ? addressMatch : regexpMatch
	if (bestMatchString.length === 0) return undefined
	return {
		bestMatchLength: bestMatchString.length,
		locationOfBestMatch: lowerCasedName.indexOf(bestMatchString)
	}
}

export function bestMatch(matches: RegExpMatchArray | null) {
	if (matches) return [...matches].sort((a, b) => b.length - a.length )[0]
	return undefined
}

function search<ElementType>(searchArray: readonly ElementType[], searchFunction: (elementType: ElementType) => { comparison: PartialResult | undefined, entry: ElementType }) {
	const results = searchArray.map((x) => searchFunction(x))
	const undefinedRemoved = results.filter((searchResult): searchResult is { comparison: PartialResult, entry: ElementType } => searchResult.comparison !== undefined)
	return undefinedRemoved.sort((a, b) => (a.comparison.bestMatchLength - b.comparison.bestMatchLength) || (a.comparison.locationOfBestMatch - b.comparison.locationOfBestMatch)).map((x) => x.entry)
}

async function filterAddressBookDataByCategoryAndSearchString(addressBookCategory: AddressBookCategory, searchString: string | undefined, chainId: ChainIdWithUniversal): Promise<any> {
	const unicodeEscapeString = (input: string) => `\\u{${ input.charCodeAt(0).toString(16) }}`
	const trimmedSearch = searchString !== undefined && searchString.trim().length > 0 ? searchString.trim() : undefined
	const searchPattern = trimmedSearch ? new RegExp(`(?=(${ trimmedSearch.split('').map(unicodeEscapeString).join('.*?') }))`, 'ui') : undefined
	const searchingDisabled = trimmedSearch === undefined || searchPattern === undefined
	const userEntries = (await getUserAddressBookEntriesForChainId(chainId)).filter((entry) => entry.entrySource !== 'OnChain')
	switch(addressBookCategory) {
		case 'My Contacts': {
			const entries = userEntries.filter((entry): entry is ContactEntry => entry.type === 'contact')
			if (searchingDisabled) return entries
			const searchFunction = (entry: ContactEntry) => ({
				comparison: fuzzyCompare(searchPattern, trimmedSearch, entry.name, addressString(entry.address)),
				entry,
			})
			return search(entries, searchFunction)
		}
		case 'My Active Addresses': {
			const entries = userEntries.filter((entry) => entry.useAsActiveAddress === true)
			if (searchingDisabled) return entries
			const searchFunction = (entry: AddressBookEntry) => ({
				comparison: fuzzyCompare(searchPattern, trimmedSearch, entry.name, addressString(entry.address)),
				entry,
			})
			return search(entries, searchFunction)
		}
		default: null
	}
}

export async function getMetadataForAddressBookData(filter: GetAddressBookDataFilter) {
	const filtered = await filterAddressBookDataByCategoryAndSearchString(filter.filter, filter.searchString, filter.chainId)
	return {
		entries: filtered.slice(filter.startIndex, filter.maxIndex),
		maxDataLength: filtered.length,
	}
}

export async function findEntryWithSymbolOrName(_: string | undefined, name: string | undefined, chainId: ChainIdWithUniversal): Promise<AddressBookEntry | undefined> {
	const lowerCasedName = name?.toLowerCase()

	const lowerCasedEqual = (nonLowerCased: string, lowerCased: string | undefined) => nonLowerCased.toLowerCase() === lowerCased

	const userEntries = await getUserAddressBookEntriesForChainIdMorePreciseFirst(chainId)
	const userEntry = userEntries.find((entry) => ('symbol' in entry) || lowerCasedEqual(entry.name, lowerCasedName))
	if (userEntry !== undefined) return userEntry
	return undefined
}
