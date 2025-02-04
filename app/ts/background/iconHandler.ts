import { RpcConnectionStatus, TabState } from '../types/user-interface-types.js'
import { PRIMARY_COLOR, TIME_BETWEEN_BLOCKS, WARNING_COLOR } from '../utils/constants.js'
import { Future } from '../utils/future.js'
import { imageToUri } from '../utils/imageToUri.js'
import { checkAndPrintRuntimeLastError, safeGetTab } from '../utils/requests.js'
import { modifyObject } from '../utils/typescript.js'
import { sendPopupMessageToOpenWindows, setExtensionBadgeBackgroundColor, setExtensionBadgeText, setExtensionIcon, setExtensionTitle } from './backgroundUtils.js'
import { getLastKnownCurrentTabId } from './popupMessageHandlers.js'
import { getRpcConnectionStatus, updateTabState } from './storageVariables.js'

export async function setInterceptorIcon(tabId: number, iconReason: string) {
	const tabIconDetails = { iconReason }
	await updateTabState(tabId, (previousState: TabState) => modifyObject(previousState, { tabIconDetails }))
	if (await getLastKnownCurrentTabId() === tabId) await sendPopupMessageToOpenWindows({ method: 'popup_websiteIconChanged', data: tabIconDetails })
	try {
		await setExtensionIcon({ path: { 128: '../img/head.png' }, tabId })
		await setExtensionTitle({ title: iconReason, tabId })
	} catch (error) {
		console.warn('failed to set interceptor icon and reason')
		console.warn(error)
	}
}

export function noNewBlockForOverTwoMins(connectionStatus: RpcConnectionStatus) {
	return connectionStatus?.latestBlock && (connectionStatus.lastConnnectionAttempt.getTime() - connectionStatus.latestBlock.timestamp.getTime()) > 2 * 60 * 1000
}

export async function updateExtensionBadge() {
	const connectionStatus = await getRpcConnectionStatus()
	if (connectionStatus?.isConnected === false || noNewBlockForOverTwoMins(connectionStatus) && connectionStatus && connectionStatus.retrying) {
		const nextConnectionAttempt = new Date(connectionStatus.lastConnnectionAttempt.getTime() + TIME_BETWEEN_BLOCKS * 1000)
		if (nextConnectionAttempt.getTime() - new Date().getTime() > 0) {
			await setExtensionBadgeBackgroundColor({ color: WARNING_COLOR })
			return await setExtensionBadgeText({ text: '!' })
		}
	}
	await setExtensionBadgeBackgroundColor({ color: PRIMARY_COLOR })
	return await setExtensionBadgeText( { text: '' } )
}


export async function retrieveWebsiteDetails(tabId: number) {
	const waitForLoadedFuture = new Future<void>

	// wait for the tab to be fully loaded
	const listener = function listener(tabIdUpdated: number, info: browser.tabs._OnUpdatedChangeInfo) {
		try {
			if (info.status === 'complete' && tabId === tabIdUpdated) return waitForLoadedFuture.resolve()
		} finally {
			checkAndPrintRuntimeLastError()
		}
	}

	try {
		browser.tabs.onUpdated.addListener(listener)
		const tab = await safeGetTab(tabId)
		if (tab !== undefined && tab.status === 'complete') waitForLoadedFuture.resolve()
		let timeout = undefined
		try {
			timeout = setTimeout(() => waitForLoadedFuture.reject(new Error('timed out')), 60000)
			await waitForLoadedFuture
		} finally {
			clearTimeout(timeout)
		}
	} catch(error) {
		return { title: undefined, icon: undefined }
	} finally {
		browser.tabs.onUpdated.removeListener(listener)
		checkAndPrintRuntimeLastError()
	}

	// if the tab is not ready yet try to wait for a while for it to be ready, if not, we just have no icon to show on firefox
	let maxRetries = 10
	// apparently there's a lot bugs in firefox related to getting this favicon. Eve if the tab has loaded, the favicon is not necessary loaded either
	// https://bugzilla.mozilla.org/show_bug.cgi?id=1450384
	// https://bugzilla.mozilla.org/show_bug.cgi?id=1417721
	// below is my attempt to try to get favicon...
	while ((await safeGetTab(tabId))?.favIconUrl === undefined) {
		await new Promise(resolve => setTimeout(resolve, 100))
		maxRetries--
		if (maxRetries <= 0) break // timeout
	}
	const tab = await safeGetTab(tabId)
	return {
		title: tab?.title,
		icon: tab?.favIconUrl === undefined ? undefined : await imageToUri(tab.favIconUrl)
	}
}
