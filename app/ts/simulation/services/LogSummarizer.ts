import { AddressBookEntry } from '../../types/addressBookTypes.js'
import { NamedTokenId, SimulatedAndVisualizedTransaction } from '../../types/visualizer-types.js'
type BalanceChangeSummary = {
	erc20TokenBalanceChanges: Map<string, bigint>, // token address, amount
	erc20TokenApprovalChanges: Map<string, Map<string, bigint > > // token address, approved address, amount

	erc721TokenBalanceChanges: Map<string, Map<string, boolean > >, // token address, token id, {true if received, false if sent}
	erc721and1155OperatorChanges: Map<string, string | undefined> // token address, operator
	erc721TokenIdApprovalChanges: Map<string, Map<string, string > > // token address, tokenId, approved address

	erc1155TokenBalanceChanges: Map<string, Map<string, bigint > >, // token address, token id, { amount }
}

export type SummaryOutcome = {
	summaryFor: AddressBookEntry
}

export class LogSummarizer {
	private summary = new Map<string, BalanceChangeSummary>()

	public constructor(_: readonly (SimulatedAndVisualizedTransaction | undefined)[]) {
		const summaryEntriesArray = Array.from(this.summary.entries())
		for (const [address, addressSummary] of summaryEntriesArray) {
			if (
				addressSummary.erc721TokenBalanceChanges.size === 0 &&
				addressSummary.erc721TokenIdApprovalChanges.size === 0 &&
				addressSummary.erc20TokenApprovalChanges.size === 0 &&
				addressSummary.erc20TokenBalanceChanges.size === 0 &&
				addressSummary.erc1155TokenBalanceChanges.size === 0 &&
				addressSummary.erc721and1155OperatorChanges.size === 0
			) {
				this.summary.delete(address)
			}
		}
	}

	public getSummary = (addressMetaData: Map<string, AddressBookEntry>, tokenPriceEstimates: readonly any[], namedTokenIds: readonly NamedTokenId[]) => {
		const summaries: SummaryOutcome[] = []
		for (const [address, _summary] of this.summary.entries()) {
			const summary = this.getSummaryForAddr(address, addressMetaData, tokenPriceEstimates, namedTokenIds)
			if (summary === undefined) continue
			const summaryFor = addressMetaData.get(address)
			if (summaryFor === undefined) throw new Error(`Missing metadata for address: ${ address }`)
			summaries.push({ summaryFor: summaryFor, ...summary })
		}
		return summaries
	}

	public readonly getSummaryForAddr = (address: string, _: Map<string, AddressBookEntry>, __: readonly any[], ___: readonly NamedTokenId[]): Omit<SummaryOutcome, 'summaryFor'> | undefined => {
		const addressSummary = this.summary.get(address)
		if (addressSummary === undefined) return undefined

		
		return {
			
		}
	}
}
