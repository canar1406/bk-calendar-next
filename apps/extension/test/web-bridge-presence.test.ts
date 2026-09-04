import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	WEB_APP_URL_PATTERN,
	detectWebBridgeConnection,
	ensureWebBridgeConnection,
	type WebBridgePresenceApi
} from '../src/background/web-bridge-presence.ts';

describe('web BKalendar bridge presence', () => {
	it('reports connected only when an official web tab answers the bridge ping', async () => {
		const calls: string[] = [];
		const api: WebBridgePresenceApi = {
			async queryTabs(properties) {
				calls.push(`query:${properties.url}`);
				return [{ id: 41 }, { id: 42 }];
			},
			async sendMessage(tabId, message) {
				calls.push(`ping:${tabId}:${message.type}`);
				if (tabId === 42) return { ok: true };
				throw new Error('stale content script');
			},
			async inject() {}
		};

		assert.equal(await detectWebBridgeConnection(api), true);
		assert.deepEqual(calls, [
			`query:${WEB_APP_URL_PATTERN}`,
			'ping:41:bkalendar:web-bridge:ping',
			'ping:42:bkalendar:web-bridge:ping'
		]);
	});

	it('reports disconnected when no official web tab has an active content bridge', async () => {
		const api: WebBridgePresenceApi = {
			async queryTabs() {
				return [{ id: 41 }, {}];
			},
			async sendMessage() {
				return undefined;
			},
			async inject() {}
		};

		assert.equal(await detectWebBridgeConnection(api), false);
	});

	it('injects the bridge into an already-open official tab after an extension reload', async () => {
		const injected: number[] = [];
		let ready = false;
		const api: WebBridgePresenceApi = {
			async queryTabs() {
				return [{ id: 41 }];
			},
			async sendMessage() {
				if (!ready) throw new Error('bridge is not injected');
				return { ok: true };
			},
			async inject(tabId) {
				injected.push(tabId);
				ready = true;
			}
		};

		assert.equal(await ensureWebBridgeConnection(api), true);
		assert.deepEqual(injected, [41]);
	});
});
