import { WEB_BRIDGE_PING_TYPE, type WebBridgePingResponse } from '../shared/web-bridge-runtime.ts';

export const WEB_APP_URL = 'https://canar1406.github.io/bk-calendar-next/';
export const WEB_APP_URL_PATTERN = `${WEB_APP_URL}*`;

export interface WebBridgePresenceApi {
	queryTabs(properties: { url: string }): Promise<Array<{ id?: number | undefined }>>;
	sendMessage(
		tabId: number,
		message: { type: typeof WEB_BRIDGE_PING_TYPE }
	): Promise<WebBridgePingResponse | undefined>;
	inject(tabId: number): Promise<void>;
}

export async function detectWebBridgeConnection(api: WebBridgePresenceApi): Promise<boolean> {
	const tabs = await api.queryTabs({ url: WEB_APP_URL_PATTERN });
	for (const tab of tabs) {
		if (typeof tab.id !== 'number') continue;
		try {
			const response = await api.sendMessage(tab.id, { type: WEB_BRIDGE_PING_TYPE });
			if (response?.ok === true) return true;
		} catch {
			// A tab opened before the extension was reloaded has no active content bridge.
		}
	}
	return false;
}

export async function ensureWebBridgeConnection(api: WebBridgePresenceApi): Promise<boolean> {
	if (await detectWebBridgeConnection(api)) return true;
	const tabs = await api.queryTabs({ url: WEB_APP_URL_PATTERN });
	await Promise.all(
		tabs.map(async (tab) => {
			if (typeof tab.id !== 'number') return;
			try {
				await api.sendMessage(tab.id, { type: WEB_BRIDGE_PING_TYPE });
			} catch {
				await api.inject(tab.id).catch(() => {});
			}
		})
	);
	return await detectWebBridgeConnection(api);
}
