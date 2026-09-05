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
			const response = await withTimeout(
				api.sendMessage(tab.id, { type: WEB_BRIDGE_PING_TYPE }),
				800
			);
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
				await withTimeout(api.sendMessage(tab.id, { type: WEB_BRIDGE_PING_TYPE }), 800);
			} catch {
				await withTimeout(api.inject(tab.id), 800).catch(() => {});
			}
		})
	);
	return await detectWebBridgeConnection(api);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('Web bridge timeout.')), timeoutMs);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			}
		);
	});
}
