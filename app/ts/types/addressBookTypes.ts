import * as funtypes from 'funtypes'
import { EthereumAddress, EthereumQuantity, LiteralConverterParserFactory } from './wire-types.js'

export type ChainIdWithUniversal = funtypes.Static<typeof ChainIdWithUniversal>
export const ChainIdWithUniversal = funtypes.Union(EthereumQuantity, funtypes.Literal('AllChains'))

export type EntrySource = funtypes.Static<typeof EntrySource>
export const EntrySource = funtypes.Union(
	funtypes.Literal('DarkFloristMetadata'),
	funtypes.Literal('User'),
	funtypes.Literal('Interceptor'),
	funtypes.Literal('OnChain'),
	funtypes.Literal('FilledIn'),
)

export type DeclarativeNetRequestBlockMode = funtypes.Static<typeof DeclarativeNetRequestBlockMode>
export const DeclarativeNetRequestBlockMode = funtypes.Union(funtypes.Literal('block-all'), funtypes.Literal('disabled'))

export type AddressBookEntryCategory = 'contact' | 'activeAddress' 

export type ContactEntry = funtypes.Static<typeof ContactEntry>
export const ContactEntry = funtypes.ReadonlyObject({
	type: funtypes.Literal('contact'),
	name: funtypes.String,
	address: EthereumAddress,
	entrySource: funtypes.Union(EntrySource, funtypes.Literal(undefined).withParser(LiteralConverterParserFactory(undefined, 'User' as const))),
}).And(funtypes.Partial({
	logoUri: funtypes.String,
	abi: funtypes.String,
	useAsActiveAddress: funtypes.Boolean,
	askForAddressAccess: funtypes.Union(funtypes.Boolean, funtypes.Literal(undefined).withParser(LiteralConverterParserFactory(undefined, true))),
	declarativeNetRequestBlockMode: DeclarativeNetRequestBlockMode,
	chainId: ChainIdWithUniversal,
}))


export type ContactEntries = funtypes.Static<typeof ContactEntries>
export const ContactEntries = funtypes.ReadonlyArray(ContactEntry)

export type AddressBookEntry = funtypes.Static<typeof AddressBookEntry>
export const AddressBookEntry = funtypes.Union(
	ContactEntry,
)

export type AddressBookEntries = funtypes.Static<typeof AddressBookEntries>
export const AddressBookEntries = funtypes.ReadonlyArray(AddressBookEntry)

export type IncompleteAddressBookEntry = funtypes.Static<typeof IncompleteAddressBookEntry>
export const IncompleteAddressBookEntry = funtypes.ReadonlyObject({
	addingAddress: funtypes.Boolean, // if false, we are editing addess
	type: funtypes.Union(funtypes.Literal('contact')),
	address: funtypes.Union(funtypes.String, funtypes.Undefined),
	askForAddressAccess: funtypes.Boolean,
	name: funtypes.Union(funtypes.String, funtypes.Undefined),
	symbol: funtypes.Union(funtypes.String, funtypes.Undefined),
	decimals: funtypes.Union(EthereumQuantity, funtypes.Undefined),
	logoUri: funtypes.Union(funtypes.String, funtypes.Undefined),
	entrySource: EntrySource,
	abi: funtypes.Union(funtypes.String, funtypes.Undefined),
	useAsActiveAddress: funtypes.Union(funtypes.Undefined, funtypes.Boolean),
	declarativeNetRequestBlockMode: funtypes.Union(funtypes.Undefined, DeclarativeNetRequestBlockMode),
	chainId: ChainIdWithUniversal,
})
