import * as funtypes from 'funtypes'
import { AddressBookEntry } from './addressBookTypes.js'
import { PureGroupedSolidityType } from './solidityType.js'
import { EthereumAddress, EthereumBytes32, EthereumData, EthereumInput, EthereumQuantity } from './wire-types.js'

export type SolidityVariable = funtypes.Static<typeof SolidityVariable>
export const SolidityVariable = funtypes.ReadonlyObject({
	typeValue: PureGroupedSolidityType,
	paramName: funtypes.String
})

export type EnrichedEthereumInputData = funtypes.Static<typeof EnrichedEthereumInputData>
export const EnrichedEthereumInputData = funtypes.Union(
	funtypes.ReadonlyObject({
		input: EthereumInput,
		type: funtypes.Literal('NonParsed')
	}),
	funtypes.ReadonlyObject({
		input: EthereumInput,
		type: funtypes.Literal('Parsed'),
		name: funtypes.String, // eg. 'Transfer'
		args: funtypes.ReadonlyArray(SolidityVariable), // TODO: add support for structs (abiV2)
	}),
)


export type ParsedEvent = funtypes.Static<typeof ParsedEvent>
export const ParsedEvent = funtypes.ReadonlyObject({
	isParsed: funtypes.Literal('Parsed'),
	name: funtypes.String, // eg. 'Transfer'
	signature: funtypes.String, // eg. 'Transfer(address,address,uint256)'
	args: funtypes.ReadonlyArray(SolidityVariable), // TODO: add support for structs (abiV2)
	address: EthereumAddress,
	loggersAddressBookEntry: AddressBookEntry,
	data: EthereumInput,
	topics: funtypes.ReadonlyArray(EthereumBytes32),
})

type NonParsedEvent = funtypes.Static<typeof NonParsedEvent>
const NonParsedEvent = funtypes.ReadonlyObject({
	isParsed: funtypes.Literal('NonParsed'),
	address: EthereumAddress,
	loggersAddressBookEntry: AddressBookEntry,
	data: EthereumInput,
	topics: funtypes.ReadonlyArray(EthereumBytes32),
})

export type TokenVisualizerResult = funtypes.Static<typeof TokenVisualizerResult>
export const TokenVisualizerResult = funtypes.Intersect(
	funtypes.ReadonlyObject({
		from: EthereumAddress,
		to: EthereumAddress,
		tokenAddress: EthereumAddress,
	}),
	funtypes.Union(
		funtypes.ReadonlyObject({ // ERC20 transfer / approval
			amount: EthereumQuantity,
			type: funtypes.Literal('ERC20'),
			isApproval: funtypes.Boolean,
		}),
		funtypes.ReadonlyObject({ // ERC721 transfer / approval
			tokenId: EthereumQuantity,
			type: funtypes.Literal('ERC721'),
			isApproval: funtypes.Boolean,
		}),
		funtypes.ReadonlyObject({ // ERC721 all approval // all approval removal
			type: funtypes.Literal('NFT All approval'),
			allApprovalAdded: funtypes.Boolean, // true if approval is added, and false if removed
			isApproval: funtypes.Literal(true),
		}),
		funtypes.ReadonlyObject({
			type: funtypes.Literal('ERC1155'),
			operator: EthereumAddress,
			tokenId: EthereumQuantity,
			amount: EthereumQuantity,
			isApproval: funtypes.Literal(false),
		})
	)
)

type EnsFuseName = funtypes.Static<typeof EnsFuseName>
const EnsFuseName = funtypes.Union(
	funtypes.Literal('Cannot Unwrap Name'),
	funtypes.Literal('Cannot Burn Fuses'),
	funtypes.Literal('Cannot Transfer'),
	funtypes.Literal('Cannot Set Resolver'),
	funtypes.Literal('Cannot Set Time To Live'),
	funtypes.Literal('Cannot Create Subdomain'),
	funtypes.Literal('Parent Domain Cannot Control'),
	funtypes.Literal('Cannot Approve'),
	funtypes.Literal('Is .eth domain'),
	funtypes.Literal('Can Extend Expiry'),
	funtypes.Literal('Can Do Everything')
)

export type ParsedEnsEvent = funtypes.Static<typeof ParsedEnsEvent>
export const ParsedEnsEvent = funtypes.Intersect(
	ParsedEvent,
	funtypes.ReadonlyObject({ type: funtypes.Literal('ENS') }),
	funtypes.Union(
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSAddrChanged'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				to: EthereumAddress,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSAddressChanged'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				to: EthereumData,
				coinType: EthereumQuantity,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSTransfer'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				owner: EthereumAddress,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSTextChangedKeyValue'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				indexedKey: EthereumData,
				key: funtypes.String,
				value: funtypes.String,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSTextChanged'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				indexedKey: EthereumData,
				key: funtypes.String
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSReverseClaimed'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				address: EthereumAddress,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSNewTTL'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				ttl: EthereumQuantity
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSNewResolver'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				address: EthereumAddress,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSNameUnwrapped'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				owner: EthereumAddress,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSNameChanged'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				name: funtypes.String,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSExpiryExtended'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				expires: EthereumQuantity,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSContentHashChanged'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				hash: EthereumData,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Union(funtypes.Literal('ENSNewOwner')),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				owner: EthereumAddress,
				labelHash: EthereumBytes32,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSControllerNameRenewed'),
			logInformation: funtypes.ReadonlyObject({
				name: funtypes.String,
				labelHash: EthereumBytes32,
				cost: EthereumQuantity,
				expires: EthereumQuantity,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSControllerNameRegistered'),
			logInformation: funtypes.ReadonlyObject({
				name: funtypes.String,
				labelHash: EthereumBytes32,
				owner: EthereumAddress,
				cost: EthereumQuantity,
				expires: EthereumQuantity,
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSBaseRegistrarNameRenewed'),
			logInformation: funtypes.ReadonlyObject({
				labelHash: EthereumBytes32,
				expires: EthereumQuantity
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSBaseRegistrarNameRegistered'),
			logInformation: funtypes.ReadonlyObject({
				labelHash: EthereumBytes32,
				owner: EthereumAddress,
				expires: EthereumQuantity
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSFusesSet'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				fuses: funtypes.ReadonlyArray(EnsFuseName),
			}),
		}),
		funtypes.ReadonlyObject({
			subType: funtypes.Literal('ENSNameWrapped'),
			logInformation: funtypes.ReadonlyObject({
				node: EthereumBytes32,
				fuses: funtypes.ReadonlyArray(EnsFuseName),
				owner: EthereumAddress,
				name: funtypes.String,
				expires: EthereumQuantity
			}),
		}),
	)
)

export type EnrichedEthereumEvent = funtypes.Static<typeof EnrichedEthereumEvent>
export const EnrichedEthereumEvent = funtypes.Union(
	funtypes.Intersect(
		NonParsedEvent,
		funtypes.ReadonlyObject({ type: funtypes.Literal('NonParsed') })
	),
	ParsedEnsEvent,
	funtypes.Intersect(
		ParsedEvent,
		funtypes.Union(
			funtypes.ReadonlyObject({ type: funtypes.Literal('Parsed') }),
			funtypes.ReadonlyObject({ type: funtypes.Literal('TokenEvent'), logInformation: TokenVisualizerResult }),
		)
	),
)

export type EnrichedEthereumEvents = funtypes.Static<typeof EnrichedEthereumEvents>
export const EnrichedEthereumEvents = funtypes.ReadonlyArray(EnrichedEthereumEvent)