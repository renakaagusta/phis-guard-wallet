import { ParsedEvent } from '../types/EnrichedEthereumData.js'
import { EthereumBytes32 } from '../types/wire-types.js'
import { bytesToUnsigned, dataStringWith0xStart } from '../utils/bigint.js'
import { extractENSFuses } from '../utils/ethereumNameService.js'
// event AddressChanged(bytes32 indexed node, uint coinType, bytes newAddress)
export function handleEnsAddressChanged(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'unsignedInteger' || eventLog.args[2]?.typeValue.type !== 'bytes') throw new Error('Malformed ENS AddressChanged Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		coinType: eventLog.args[1].typeValue.value,
		to: eventLog.args[2].typeValue.value
	}
}

// event AddrChanged(bytes32 indexed node, address a)
export function handleEnsAddrChanged(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'address') throw new Error('Malformed ENS AddrChanged Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		to: eventLog.args[1].typeValue.value
	}
}

// event NameRenewed(string name, bytes32 indexed label, uint cost, uint expires)
export function handleEnsControllerNameRenewed(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'string' || eventLog.args[1]?.typeValue.type !== 'fixedBytes' || eventLog.args[2]?.typeValue.type !== 'unsignedInteger' || eventLog.args[3]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS NameRenewed Event')
	return {
		name: eventLog.args[0].typeValue.value,
		labelHash: bytesToUnsigned(eventLog.args[1].typeValue.value),
		cost: eventLog.args[2].typeValue.value,
		expires: eventLog.args[3].typeValue.value,
	}
}

// event NameRegistered(string name, bytes32 indexed label, address indexed owner, uint cost, uint expires)
export function handleControllerNameRegistered(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'string' || eventLog.args[1]?.typeValue.type !== 'fixedBytes' || eventLog.args[2]?.typeValue.type !== 'address' || eventLog.args[3]?.typeValue.type !== 'unsignedInteger' || eventLog.args[4]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS Name Registered Event')
	return {
		name: eventLog.args[0].typeValue.value,
		labelHash: bytesToUnsigned(eventLog.args[1].typeValue.value),
		owner: eventLog.args[2].typeValue.value,
		cost: eventLog.args[3].typeValue.value,
		expires: eventLog.args[4].typeValue.value,
	}
}

// event NameRenewed(uint256 indexed hash, uint expires)
export function handleBaseRegistrarNameRenewed(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'unsignedInteger' || eventLog.args[1]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS Name Renewed Event')
	return {
		labelHash: eventLog.args[0].typeValue.value,
		expires: eventLog.args[1].typeValue.value,
	}
}

// event NameRegistered(uint256 indexed hash, address indexed owner, uint expires)
export function handleBaseRegistrarNameRegistered(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'unsignedInteger' || eventLog.args[1]?.typeValue.type !== 'address' || eventLog.args[2]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS Name Registered Event')
	return {
		labelHash: eventLog.args[0].typeValue.value,
		owner: eventLog.args[1].typeValue.value,
		expires: eventLog.args[2].typeValue.value,
	}
}

// event TextChanged(bytes32 indexed node, string indexed indexedKey, string key)
export function handleEnsTextChanged(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'fixedBytes' || eventLog.args[2]?.typeValue.type !== 'string') throw new Error('Malformed ENS TextChanged Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		indexedKey: eventLog.args[1]?.typeValue.value,
		key: eventLog.args[2]?.typeValue.value,
	}
}

// event Transfer(bytes32 indexed node, address owner)
export function handleEnsTransfer(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'address') throw new Error('Malformed ENS Transfer Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		owner: eventLog.args[1].typeValue.value,
	}
}

// event NewOwner(bytes32 indexed node, bytes32 indexed label, address owner)
export function handleEnsNewOwner(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'fixedBytes' || eventLog.args[2]?.typeValue.type !== 'address') throw new Error('Malformed ENS New Owner Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		labelHash: bytesToUnsigned(eventLog.args[1].typeValue.value),
		owner: eventLog.args[2].typeValue.value,
	}
}

// event NewResolver(bytes32 indexed node, address resolver)
export function handleEnsNewResolver(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'address') throw new Error('Malformed ENS New Resolver Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		address: eventLog.args[1].typeValue.value,
	}
}

// event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value);
export function handleEnsTextChangedKeyValue(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'fixedBytes' || eventLog.args[2]?.typeValue.type !== 'string' || eventLog.args[3]?.typeValue.type !== 'string') throw new Error('Malformed ENS Text changed Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		indexedKey: eventLog.args[1].typeValue.value,
		key: eventLog.args[2].typeValue.value,
		value: eventLog.args[3].typeValue.value
	}
}

// event ContenthashChanged(bytes32 indexed node, bytes hash);
export function handleEnsContentHashChanged(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'bytes') throw new Error('Malformed ENS Content Hash Changed Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		hash: eventLog.args[1].typeValue.value
	}
}

// event FusesSet(bytes32 indexed node, uint32 fuses)
export function handleEnsFusesSet(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS Fuses Set Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		fuses: extractENSFuses(eventLog.args[1]?.typeValue.value)
	}
}

// event NameUnwrapped(bytes32 indexed node, address owner)
export function handleEnsNameUnWrapped(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'address') throw new Error('Malformed ENS Name Unwrapped Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		owner: eventLog.args[1].typeValue.value,
	}
}

// event NameChanged(bytes32 indexed node, string name); // 0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63
export function handleEnsNameChanged(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'string') throw new Error('Malformed ENS Name Unwrapped Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		name: eventLog.args[1].typeValue.value
	}
}

// event ReverseClaimed(address indexed addr, bytes32 indexed node) // 0xa58E81fe9b61B5c3fE2AFD33CF304c454AbFc7Cb
export function handleEnsReverseClaimed(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'address' || eventLog.args[1]?.typeValue.type !== 'fixedBytes') throw new Error('Malformed ENS Name Unwrapped Event')
	return {
		address: eventLog.args[0]?.typeValue.value,
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[1].typeValue.value))
	}
}

// event NewTTL(bytes32 indexed node, uint64 ttl)
export function handleEnsNewTtl(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS New TTL Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		ttl: eventLog.args[1].typeValue.value
	}
}

// event ExpiryExtended(bytes32 indexed node, uint64 expiry)
export function handleEnsExpiryExtended(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS ExpiryExtended Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		expires: eventLog.args[1].typeValue.value,
	}
}

function decodeENSName(encodedName: Uint8Array): string {
	let i = 0
	let decodedName = ''
	while (i < encodedName.length) {
		const length = encodedName[i]
		if (length === 0 || length === undefined) break
		i++
		const label = new TextDecoder().decode(encodedName.slice(i, i + length))
		decodedName += label + '.'
		i += length
	}
	if (decodedName.endsWith('.')) decodedName = decodedName.slice(0, -1)
	return decodedName
}

// event NameWrapped(bytes32 indexed node, bytes name, address owner, uint32 fuses, uint64 expiry)
export function handleNameWrapped(eventLog: ParsedEvent) {
	if (eventLog.args[0]?.typeValue.type !== 'fixedBytes' || eventLog.args[1]?.typeValue.type !== 'bytes' || eventLog.args[2]?.typeValue.type !== 'address' || eventLog.args[3]?.typeValue.type !== 'unsignedInteger' || eventLog.args[4]?.typeValue.type !== 'unsignedInteger') throw new Error('Malformed ENS ExpiryExtended Event')
	return {
		node: EthereumBytes32.parse(dataStringWith0xStart(eventLog.args[0].typeValue.value)),
		name: decodeENSName(eventLog.args[1].typeValue.value),
		owner: eventLog.args[2].typeValue.value,
		fuses: extractENSFuses(eventLog.args[3]?.typeValue.value),
		expires: eventLog.args[4].typeValue.value,
	}
}
