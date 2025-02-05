import * as funtypes from 'funtypes'
import { InterceptedRequest } from '../utils/requests.js'
import { AddressBookEntry } from './addressBookTypes.js'
import { EnrichedEIP712 } from './eip721.js'
import { RpcNetwork } from './rpc.js'
import { SignerName } from './signerTypes.js'
import { Website } from './websiteAccessTypes.js'
import { EthereumAddress, EthereumQuantity, EthereumTimestamp, NonHexBigInt } from './wire-types.js'

type EIP2612Message = funtypes.Static<typeof EIP2612Message>
const EIP2612Message = funtypes.ReadonlyObject({
	types: funtypes.ReadonlyObject({
		EIP712Domain: funtypes.Tuple(
			funtypes.ReadonlyObject({
				name: funtypes.Literal('name'),
				type: funtypes.Literal('string'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('version'),
				type: funtypes.Literal('string'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('chainId'),
				type: funtypes.Literal('uint256'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('verifyingContract'),
				type: funtypes.Literal('address'),
			}),
		),
		Permit: funtypes.Tuple(
			funtypes.ReadonlyObject({
				name: funtypes.Literal('owner'),
				type: funtypes.Literal('address'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('spender'),
				type: funtypes.Literal('address'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('value'),
				type: funtypes.Literal('uint256'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('nonce'),
				type: funtypes.Literal('uint256'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('deadline'),
				type: funtypes.Literal('uint256'),
			}),
		),
	}),
	primaryType: funtypes.Literal('Permit'),
	domain: funtypes.ReadonlyObject({
		name: funtypes.String,
		version: NonHexBigInt,
		chainId: NonHexBigInt,
		verifyingContract: EthereumAddress,
	}),
	message: funtypes.ReadonlyObject({
		owner: EthereumAddress,
		spender: EthereumAddress,
		value: NonHexBigInt,
		nonce: funtypes.Number,
		deadline: funtypes.Number,
	}),
})

export type Permit2 = funtypes.Static<typeof Permit2>
export const Permit2 = funtypes.ReadonlyObject({
	types: funtypes.ReadonlyObject({
		PermitSingle: funtypes.Tuple(
			funtypes.ReadonlyObject({
				name: funtypes.Literal('details'),
				type: funtypes.Literal('PermitDetails'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('spender'),
				type: funtypes.Literal('address'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('sigDeadline'),
				type: funtypes.Literal('uint256'),
			}),
		),
		PermitDetails: funtypes.Tuple(
			funtypes.ReadonlyObject({
				name: funtypes.Literal('token'),
				type: funtypes.Literal('address'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('amount'),
				type: funtypes.Literal('uint160'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('expiration'),
				type: funtypes.Literal('uint48'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('nonce'),
				type: funtypes.Literal('uint48'),
			}),
		),
		EIP712Domain: funtypes.Tuple(
			funtypes.ReadonlyObject({
				name: funtypes.Literal('name'),
				type: funtypes.Literal('string'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('chainId'),
				type: funtypes.Literal('uint256'),
			}),
			funtypes.ReadonlyObject({
				name: funtypes.Literal('verifyingContract'),
				type: funtypes.Literal('address'),
			}),
		)
	}),
	domain: funtypes.ReadonlyObject({
		name: funtypes.Literal('Permit2'),
		chainId: NonHexBigInt,
		verifyingContract: EthereumAddress,
	}),
	primaryType: funtypes.Literal('PermitSingle'),
	message: funtypes.ReadonlyObject({
		details: funtypes.ReadonlyObject({
			token: EthereumAddress,
			amount: NonHexBigInt,
			expiration: NonHexBigInt,
			nonce: NonHexBigInt,
		}),
		spender: EthereumAddress,
		sigDeadline: NonHexBigInt,
	})
})

type PersonalSignRequestBase = funtypes.Static<typeof PersonalSignRequestBase>
const PersonalSignRequestBase = funtypes.Intersect(
	funtypes.ReadonlyObject({
		activeAddress: AddressBookEntry,
		rpcNetwork: RpcNetwork,
		request: InterceptedRequest,
		signerName: SignerName,
		quarantineReasons: funtypes.ReadonlyArray(funtypes.String),
		quarantine: funtypes.Boolean,
		account: AddressBookEntry,
		website: Website,
		created: EthereumTimestamp,
		rawMessage: funtypes.String,
		stringifiedMessage: funtypes.String,
		messageIdentifier: EthereumQuantity,
	}),
	funtypes.ReadonlyPartial({
		isValidMessage: funtypes.Boolean,
	})
)

type VisualizedPersonalSignRequestNotParsed = funtypes.Static<typeof VisualizedPersonalSignRequest>
const VisualizedPersonalSignRequestNotParsed = funtypes.Intersect(
	PersonalSignRequestBase,
	funtypes.ReadonlyObject({
		method: funtypes.Union(funtypes.Literal('personal_sign'), funtypes.Literal('eth_signTypedData')),
		type: funtypes.Literal('NotParsed'),
		message: funtypes.String,
	})
)

type EthSignTyped = funtypes.Static<typeof EthSignTyped>
const EthSignTyped = funtypes.Union(
	funtypes.Literal('eth_signTypedData_v1'),
	funtypes.Literal('eth_signTypedData_v2'),
	funtypes.Literal('eth_signTypedData_v3'),
	funtypes.Literal('eth_signTypedData_v4'),
)

type VisualizedPersonalSignRequestEIP712 = funtypes.Static<typeof VisualizedPersonalSignRequestEIP712>
const VisualizedPersonalSignRequestEIP712 = funtypes.Intersect(
	PersonalSignRequestBase,
	funtypes.ReadonlyObject({
		method: EthSignTyped,
		type: funtypes.Literal('EIP712'),
		message: EnrichedEIP712,
	})
)

export type VisualizedPersonalSignRequestPermit = funtypes.Static<typeof VisualizedPersonalSignRequestPermit>
export const VisualizedPersonalSignRequestPermit = funtypes.Intersect(
	PersonalSignRequestBase,
	funtypes.ReadonlyObject({
		method: EthSignTyped,
		type: funtypes.Literal('Permit'),
		message: EIP2612Message,
		owner: AddressBookEntry,
		spender: AddressBookEntry,
		verifyingContract: AddressBookEntry,
	})
)

export type VisualizedPersonalSignRequestPermit2 = funtypes.Static<typeof VisualizedPersonalSignRequestPermit2>
export const VisualizedPersonalSignRequestPermit2 = funtypes.Intersect(
	PersonalSignRequestBase,
	funtypes.ReadonlyObject({
		method: EthSignTyped,
		type: funtypes.Literal('Permit2'),
		message: Permit2,
		token: AddressBookEntry,
		spender: AddressBookEntry,
		verifyingContract: AddressBookEntry,
	})
)
export type VisualizedPersonalSignRequest = funtypes.Static<typeof VisualizedPersonalSignRequest>
export const VisualizedPersonalSignRequest = funtypes.Union(
	VisualizedPersonalSignRequestNotParsed,
	VisualizedPersonalSignRequestEIP712,
	VisualizedPersonalSignRequestPermit,
	VisualizedPersonalSignRequestPermit2
)

export type PersonalSignRequestIdentifiedEIP712Message = funtypes.Static<typeof PersonalSignRequestIdentifiedEIP712Message>
export const PersonalSignRequestIdentifiedEIP712Message = funtypes.Union(EIP2612Message, Permit2)
