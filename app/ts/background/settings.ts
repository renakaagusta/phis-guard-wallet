import { AddressBookEntries } from '../types/addressBookTypes.js'
import { Page } from '../types/exportedSettingsTypes.js'
import { Settings } from '../types/interceptor-messages.js'
import { WebsiteAccessArray } from '../types/websiteAccessTypes.js'
import { ETHEREUM_COIN_ICON } from '../utils/constants.js'
import { Semaphore } from '../utils/semaphore.js'
import { browserStorageLocalGet, browserStorageLocalSafeParseGet, browserStorageLocalSet } from '../utils/storageUtils.js'

export const defaultActiveAddresses: AddressBookEntries = [
	{
		type: 'contact' as const,
		entrySource: 'User' as const,
		name: 'anvil',
		address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266n,
		useAsActiveAddress: true,
		chainId: 'AllChains',
	},
]

export const defaultRpcs = [
	{
		name: 'Anvil',
		chainId: 31337n,
		httpsRpc: 'http://localhost:8545',
		currencyName: 'Ether',
		currencyTicker: 'ETH',
		currencyLogoUri: ETHEREUM_COIN_ICON,
		primary: true,
		minimized: true,
	},
	{
		name: 'Ethereum Mainnet',
		chainId: 1n,
		httpsRpc: 'https://ethereum.dark.florist',
		currencyName: 'Ether',
		currencyTicker: 'ETH',
		currencyLogoUri: ETHEREUM_COIN_ICON,
		primary: true,
		minimized: true,
	},
	{
		name: 'Sepolia',
		chainId: 11155111n,
		httpsRpc: 'https://sepolia.dark.florist',
		currencyName: 'Sepolia Testnet ETH',
		currencyTicker: 'SEETH',
		currencyLogoUri: ETHEREUM_COIN_ICON,
		primary: true,
		minimized: true,
	},
	{
		name: 'Holesky',
		chainId: 17000n,
		httpsRpc: 'https://holesky.dark.florist',
		currencyName: 'Holesky Testnet ETH',
		currencyTicker: 'HOETH',
		currencyLogoUri: ETHEREUM_COIN_ICON,
		primary: true,
		minimized: true,
	},
	{
		name: 'Ethereum (experimental nethermind)',
		chainId: 1n,
		httpsRpc: 'https://nethermind.dark.florist',
		currencyName: 'Ether',
		currencyTicker: 'ETH',
		currencyLogoUri: ETHEREUM_COIN_ICON,
		primary: false,
		minimized: true,
	},
] as const

export async function getSettings() : Promise<Settings> {
	const resultsPromise = browserStorageLocalGet([
		'activeSimulationAddress',
		'openedPageV2',
		'useSignersAddressAsActiveAddress',
		'websiteAccess'
	])
	const activeRpcNetwork = (await browserStorageLocalSafeParseGet('activeRpcNetwork'))?.activeRpcNetwork
	const results = await resultsPromise
	if (defaultRpcs[0] === undefined || defaultActiveAddresses[0] === undefined) throw new Error('default rpc or default address was missing')
	return {
		activeSimulationAddress: 'activeSimulationAddress' in results ? results.activeSimulationAddress : defaultActiveAddresses[0].address,
		openedPage: results.openedPageV2 ?? { page: 'Home' },
		useSignersAddressAsActiveAddress: results.useSignersAddressAsActiveAddress ?? false,
		websiteAccess: results.websiteAccess ?? [],
		activeRpcNetwork: activeRpcNetwork || defaultRpcs[0],
	}
}

export function getInterceptorDisabledSites(settings: Settings): string[] {
	return settings.websiteAccess.filter((site) => site.interceptorDisabled === true).map((site) => site.website.websiteOrigin)
}

export const setPage = async (openedPageV2: Page) => await browserStorageLocalSet({ openedPageV2 })
export const getPage = async() => (await browserStorageLocalGet('openedPageV2'))?.openedPageV2 ?? { page: 'Home' }

export async function setUseSignersAddressAsActiveAddress(useSignersAddressAsActiveAddress: boolean, currentSignerAddress: bigint | undefined = undefined) {
	return await browserStorageLocalSet({
		useSignersAddressAsActiveAddress,
		...useSignersAddressAsActiveAddress === true ? { activeSigningAddress: currentSignerAddress } : {}
	})
}

export const getWebsiteAccess = async() => (await browserStorageLocalGet('websiteAccess'))?.websiteAccess ?? []
const websiteAccessSemaphore = new Semaphore(1)
export async function updateWebsiteAccess(updateFunc: (prevState: WebsiteAccessArray) => WebsiteAccessArray) {
	await websiteAccessSemaphore.execute(async () => {
		return await browserStorageLocalSet({ websiteAccess: updateFunc(await getWebsiteAccess()) })
	})
}

export const getUseTabsInsteadOfPopup = async() => (await browserStorageLocalGet('useTabsInsteadOfPopup'))?.useTabsInsteadOfPopup ?? false
export const setUseTabsInsteadOfPopup = async(useTabsInsteadOfPopup: boolean) => await browserStorageLocalSet({ useTabsInsteadOfPopup })

export const getMetamaskCompatibilityMode = async() => (await browserStorageLocalGet('metamaskCompatibilityMode'))?.metamaskCompatibilityMode ?? false
export const setMetamaskCompatibilityMode = async(metamaskCompatibilityMode: boolean) => await browserStorageLocalSet({ metamaskCompatibilityMode })