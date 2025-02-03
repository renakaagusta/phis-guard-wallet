import { Erc20TokenEntry } from '../../types/addressBookTypes.js'
import { TokenPriceEstimate } from '../../types/visualizer-types.js'
import { addressString } from '../../utils/bigint.js'
import { getWithDefault } from '../../utils/typescript.js'
import { EthereumClientService } from './EthereumClientService.js'

interface TokenDecimals {
	address: bigint,
	decimals: bigint,
}

interface CachedTokenPriceEstimate {
	estimate: TokenPriceEstimate | undefined,
	estimateCalculated: Date
}

export class TokenPriceService {
	private cachedPrices = new Map<string, Map<string, CachedTokenPriceEstimate> > // quoteTokenAddress -> tokenAddress -> TokenPriceEstimate
	public cacheAge: number
	constructor(_: EthereumClientService, cacheAge: number) {
		this.cacheAge = cacheAge
	}

	public cleanUpCacheIfNeeded() {
		const currentTime = new Date()
		this.cachedPrices.forEach((quoteTokenAddressCache, quoteTokenAddressString)  => {
			quoteTokenAddressCache.forEach((estimate, tokenAddressString) => {
				if (currentTime.getTime() - estimate.estimateCalculated.getTime() > this.cacheAge) {
					quoteTokenAddressCache.delete(tokenAddressString)
				}
			})
			if (quoteTokenAddressCache.size === 0) this.cachedPrices.delete(quoteTokenAddressString)
		})
	}

	private async getTokenPrice(_: AbortController | undefined, token: TokenDecimals, quoteToken: Erc20TokenEntry) {
		return {
			token,
			quoteToken,
			// Use pool with most TVL
			price: 0n
		}
	}

	public async estimateEthereumPricesForTokens (requestAbortController: AbortController | undefined, quoteToken: Erc20TokenEntry, tokens: TokenDecimals[]) : Promise<TokenPriceEstimate[]> {
		if (tokens.length === 0) return []
		this.cleanUpCacheIfNeeded()
		const quoteTokenAddressString = addressString(quoteToken.address)
		const tokenPricePromises: Promise<TokenPriceEstimate | undefined>[] = tokens.map(async (token) => {
			const tokenAddressString = addressString(token.address)
			if (token.address === quoteToken.address) return { token, quoteToken, price: 10n ** quoteToken.decimals }
			const cachedEstimate = this.cachedPrices.get(quoteTokenAddressString)?.get(tokenAddressString)
			if (cachedEstimate !== undefined && (cachedEstimate.estimate === undefined || cachedEstimate.estimate.token.decimals === token.decimals)) {
				return cachedEstimate.estimate
			}
			const estimate = await this.getTokenPrice(requestAbortController, token, quoteToken)
			const quoteTokenAddressCache = getWithDefault(this.cachedPrices, quoteTokenAddressString, new Map<string, CachedTokenPriceEstimate>() )
			quoteTokenAddressCache.set(tokenAddressString, { estimate, estimateCalculated: new Date() })
			this.cachedPrices.set(quoteTokenAddressString, quoteTokenAddressCache)
			return estimate
		})
		return (await Promise.all(tokenPricePromises)).filter((tokenPrice): tokenPrice is TokenPriceEstimate => tokenPrice !== undefined)
	}
}

export function getTokenAmountsWorth(tokenAmount: bigint, tokenPriceEstimate: TokenPriceEstimate) {
	return (tokenPriceEstimate.price * tokenAmount) / (10n ** (tokenPriceEstimate.quoteToken.decimals))
}
