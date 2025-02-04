import { sendSubscriptionReplyOrCallBack } from '../../background/messageSending.js'
import { getEthereumSubscriptionsAndFilters, updateEthereumSubscriptionsAndFilters } from '../../background/storageVariables.js'
import { EthSubscribeParams } from '../../types/JsonRpc-types.js'
import { WebsiteTabConnections } from '../../types/user-interface-types.js'
import { EthereumSubscriptionsAndFilters, SimulationState } from '../../types/visualizer-types.js'
import { WebsiteSocket } from '../../utils/requests.js'
import { EthereumClientService } from './EthereumClientService.js'
import { getSimulatedBlock } from './SimulationModeEthereumClientService.js'

const dec2hex = (dec: number) => dec.toString(16).padStart(2, '0')

function generateId(len: number) {
	const arr = new Uint8Array((len || 40) / 2)
	globalThis.crypto.getRandomValues(arr)
	return `0x${ Array.from(arr, dec2hex).join('') }`
}

export async function removeEthereumSubscription(socket: WebsiteSocket, subscriptionOrFilterId: string) {
	const changes = await updateEthereumSubscriptionsAndFilters((subscriptions: EthereumSubscriptionsAndFilters) => {
		return subscriptions.filter((subscription) => subscription.subscriptionOrFilterId !== subscriptionOrFilterId
			&& subscription.subscriptionCreatorSocket.tabId === socket.tabId // only allow the same tab and connection to remove the subscription
			&& subscription.subscriptionCreatorSocket.connectionName === socket.connectionName
		)
	})
	if (changes.oldSubscriptions.find((sub) => sub.subscriptionOrFilterId === subscriptionOrFilterId) !== undefined
		&& changes.newSubscriptions.find((sub) => sub.subscriptionOrFilterId === subscriptionOrFilterId) === undefined
	) {
		return true // subscription was found and removed
	}
	return false
}

export async function sendSubscriptionMessagesForNewBlock(blockNumber: bigint, ethereumClientService: EthereumClientService, simulationState: SimulationState | undefined, websiteTabConnections: WebsiteTabConnections) {
	const ethereumSubscriptionsAndFilters = await getEthereumSubscriptionsAndFilters()
	for (const subscriptionOrFilter of ethereumSubscriptionsAndFilters) {
		if (websiteTabConnections.get(subscriptionOrFilter.subscriptionCreatorSocket.tabId) === undefined) { // connection removed
			await removeEthereumSubscription(subscriptionOrFilter.subscriptionCreatorSocket, subscriptionOrFilter.subscriptionOrFilterId)
			break
		}
		switch (subscriptionOrFilter.type) {
			case 'newHeads': {
				const newBlock = await ethereumClientService.getBlock(undefined, blockNumber, false)

				sendSubscriptionReplyOrCallBack(websiteTabConnections, subscriptionOrFilter.subscriptionCreatorSocket, {
					type: 'result',
					method: 'newHeads' as const,
					result: { subscription: subscriptionOrFilter.type, result: newBlock } as const,
					subscription: subscriptionOrFilter.subscriptionOrFilterId,
				})

				if (simulationState !== undefined) {
					const simulatedBlock = await getSimulatedBlock(ethereumClientService, undefined, simulationState, blockNumber + 1n, false)
					// post our simulated block on top (reorg it)
					sendSubscriptionReplyOrCallBack(websiteTabConnections, subscriptionOrFilter.subscriptionCreatorSocket, {
						type: 'result',
						method: 'newHeads' as const,
						result: { subscription: subscriptionOrFilter.type, result: simulatedBlock },
						subscription: subscriptionOrFilter.subscriptionOrFilterId,
					})
				}
				break
			}
		}
	}
	return
}
export async function createEthereumSubscription(params: EthSubscribeParams, subscriptionCreatorSocket: WebsiteSocket) {
	switch(params.params[0]) {
		case 'newHeads': {
			const subscriptionOrFilterId = generateId(40)
			await updateEthereumSubscriptionsAndFilters((subscriptionsAndfilters: EthereumSubscriptionsAndFilters) => {
				return subscriptionsAndfilters.concat({ type: 'newHeads', subscriptionOrFilterId, params, subscriptionCreatorSocket })
			})
			return subscriptionOrFilterId
		}
		case 'logs': throw `Dapp requested for 'logs' subscription but it's not implemented` //TODO: implement
		case 'newPendingTransactions': throw `Dapp requested for 'newPendingTransactions' subscription but it's not implemented` //TODO: implement
		case 'syncing': throw `Dapp requested for 'syncing' subscription but it's not implemented` //TODO: implement
	}
}