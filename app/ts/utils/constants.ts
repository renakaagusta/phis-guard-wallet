import { ethers } from 'ethers'
import { CHAIN_NAMES } from './chainNames.js'

// common contract addresses
export const MULTICALL3 = 0xcA11bde05977b3631167028862bE2a173976CA11n // Contract for bundling bulk call transactions, deployed on every chain. https://github.com/mds1/multicall
export const ETHEREUM_LOGS_LOGGER_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeEn


// common event log signatures
export const TRANSFER_LOG = ethers.keccak256(ethers.toUtf8Bytes('Transfer(address,address,uint256)'))
export const APPROVAL_LOG = ethers.keccak256(ethers.toUtf8Bytes('Approval(address,address,uint256)'))
export const DEPOSIT_LOG = ethers.keccak256(ethers.toUtf8Bytes('Deposit(address,uint256)'))
export const WITHDRAWAL_LOG = ethers.keccak256(ethers.toUtf8Bytes('Withdrawal(address,uint256)'))

// Other
export const MOCK_ADDRESS = 0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefn

// ENS Fuses
export const CANNOT_UNWRAP = 1n
export const CANNOT_BURN_FUSES = 2n
export const CANNOT_TRANSFER = 4n
export const CANNOT_SET_RESOLVER = 8n
export const CANNOT_SET_TTL = 16n
export const CANNOT_CREATE_SUBDOMAIN = 32n
export const CANNOT_APPROVE = 64n
export const PARENT_CANNOT_CONTROL = 1n << 16n
export const IS_DOT_ETH = 1n << 17n
export const CAN_EXTEND_EXPIRY = 1n << 18n
export const CAN_DO_EVERYTHING = 0n

// https://blog.logrocket.com/understanding-resolving-metamask-error-codes/#4001
export const METAMASK_ERROR_USER_REJECTED_REQUEST = 4001
export const METAMASK_ERROR_NOT_AUTHORIZED = 4100
export const METAMASK_ERROR_FAILED_TO_PARSE_REQUEST = -32700
export const METAMASK_ERROR_BLANKET_ERROR = -32603

export const ERROR_INTERCEPTOR_DISABLED = { error: { code: METAMASK_ERROR_USER_REJECTED_REQUEST, message: 'PhisGuard is disabled' } }
export const METAMASK_ERROR_ALREADY_PENDING = { error: { code: -32002, message: 'Access request pending already.' } }
export const ERROR_INTERCEPTOR_NO_ACTIVE_ADDRESS = { error: { code: 2, message: 'Interceptor: No active address' } }
export const METAMASK_ERROR_NOT_CONNECTED_TO_CHAIN = { error: { code: 4900, message: 'Interceptor: Not connected to chain' } }
export const ERROR_INTERCEPTOR_GET_CODE_FAILED = { error: { code: -40001, message: 'Interceptor: Get code failed' } } // I wonder how we should come up with these numbers?
export const ERROR_INTERCEPTOR_GAS_ESTIMATION_FAILED = -40002
// const ERROR_INTERCEPTOR_NOT_READY = { error: { code: 1, message: 'Interceptor: Not ready' } }
// const ERROR_INTERCEPTOR_UNKNOWN_ORIGIN = { error: { code: 400, message: 'Interceptor: Unknown website origin' } }

function get4Byte(functionAbi: string) {
	return Number(ethers.keccak256(ethers.toUtf8Bytes(functionAbi)).slice(0, 10))
}

export const FourByteExplanations = {
	[get4Byte('transferFrom(address,address,uint256)')]: 'ERC20/ERC721 Transfer From' as const,
	[get4Byte('transfer(address,uint256)')]: 'ERC20 Transfer' as const,
	[get4Byte('approve(address,uint256)')]:'ERC20 Approval' as const,
	[get4Byte('setApprovalForAll(address,bool)')]: 'ERC721 Approval For All' as const,
	[get4Byte('multicall((address,uint256,bytes)[])')]: 'Multicall' as const,
	[get4Byte('exactInput((bytes,address,uint256,uint256,uint256))')]: 'Exact Input Swap' as const,
	[get4Byte('multicall(uint256,bytes[])')]: 'Multicall' as const,
	[get4Byte('multicall(bytes[])')]: 'Multicall' as const,
	[get4Byte('mint(address)')]: 'Mint' as const,
	[get4Byte('mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))')]: 'Mint' as const,
	[get4Byte('burn(address)')]: 'Burn' as const,
	[get4Byte('submitVote(uint256,bool)')]: 'Submit Vote' as const,
	[get4Byte('castVote(uint256,uint8)')]: 'Cast Vote' as const,
	[get4Byte('castVoteWithReason(uint256,uint8,string)')]: 'Cast Vote with Reason' as const,
	[get4Byte('castVoteWithReasonAndParams(uint256,uint8,string,bytes)')]: 'Cast Vote with Reason and Additional Info' as const,
	[get4Byte('castVoteBySig(uint256,uint8,voter,bytes)')]: 'Cast Vote by Signature' as const,
	[get4Byte('castVoteWithReasonAndParamsBySig(uint256,uint8,address,string,bytes,bytes)')]: 'Cast Vote with Reason And Additional Info by Signature' as const,
}

export const DEFAULT_TAB_CONNECTION = {  iconReason: 'The website has not requested to connect to PhisGuard.' }

export const ETHEREUM_COIN_ICON = '../../img/coins/ethereum.png'

export const DEFAULT_CALL_ADDRESS = 0x1n

export const MAX_BLOCK_CACHE = 5

export const TIME_BETWEEN_BLOCKS = 12
export const GAS_PER_BLOB = 2n**17n
export const METAMASK_LOGO = '../img/signers/metamask.svg'
export const BRAVE_LOGO = '../img/signers/brave.svg'
export const COINBASEWALLET_LOGO = '../img/signers/coinbasewallet.svg'

export function getChainName(chainId: bigint) { return CHAIN_NAMES.get(chainId.toString()) || `Chain: ${chainId.toString()}` }

export const ETHEREUM_EIP1559_ELASTICITY_MULTIPLIER = 4n // Bounds the maximum gas limit an EIP-1559 block may have, Ethereum = 4, Polygon = 8, lets just default to 4
export const ETHEREUM_EIP1559_BASEFEECHANGEDENOMINATOR = 8n // Bounds the amount the base fee can change between blocks.

export const MOCK_PRIVATE_KEYS_ADDRESS = 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdfn // an address represeting 0x1 privatekey

export const WARNING_COLOR = '#FFC107'
export const PRIMARY_COLOR = '#58a5b3'

export const CANNOT_SIMULATE_OFF_LEGACY_BLOCK = 'Cannot simulate off a legacy block'

export const NEW_BLOCK_ABORT = 'New Block Abort'