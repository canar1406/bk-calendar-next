import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	disconnectGoogle,
	GOOGLE_WEB_CLIENT_ID,
	requestGoogleToken,
	type ExtensionTokenStore,
	type ExtensionIdentityApi
} from '../src/background/google-auth.ts';

const webClientId = '290456536857-ujdg26n2gqovjc27h2mqrd9p6vhm7pbp.apps.googleusercontent.com';

describe('cross-browser extension Google OAuth', () => {
	it('uses the Web OAuth client for the Edge launchWebAuthFlow fallback', () => {
		assert.equal(
			GOOGLE_WEB_CLIENT_ID,
			'290456536857-ujdg26n2gqovjc27h2mqrd9p6vhm7pbp.apps.googleusercontent.com'
		);
	});

	it('uses Chrome native token access when available', async () => {
		const identity: ExtensionIdentityApi = {
			async getAuthToken(details) {
				assert.deepEqual(details, { interactive: true });
				return { token: 'access-token' };
			},
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow() {
				throw new Error('fallback must not run');
			},
			async removeCachedAuthToken() {}
		};

		assert.equal(await requestGoogleToken(identity, true, webClientId), 'access-token');
	});

	it('falls back to launchWebAuthFlow on Edge and validates the OAuth state', async () => {
		let requestedUrl = '';
		const identity: ExtensionIdentityApi = {
			async getAuthToken() {
				throw new Error('getAuthToken is not implemented');
			},
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow(details) {
				requestedUrl = details.url;
				const state = new URL(details.url).searchParams.get('state');
				return `https://extension.chromiumapp.org/#access_token=edge-token&token_type=Bearer&expires_in=3600&state=${state}`;
			},
			async removeCachedAuthToken() {}
		};

		assert.equal(await requestGoogleToken(identity, true, webClientId), 'edge-token');
		const authUrl = new URL(requestedUrl);
		assert.equal(authUrl.searchParams.get('client_id'), webClientId);
		assert.equal(authUrl.searchParams.get('redirect_uri'), 'https://extension.chromiumapp.org/');
		assert.equal(authUrl.searchParams.get('response_type'), 'token');
		assert.equal(authUrl.searchParams.get('prompt'), 'select_account consent');
	});

	it('caches an Edge web-flow token for the silent follow-up check', async () => {
		let launches = 0;
		let cached: { token: string; expiresAt: number } | undefined;
		const store: ExtensionTokenStore = {
			async read() {
				return cached;
			},
			async write(value) {
				cached = value;
			},
			async remove() {
				cached = undefined;
			}
		};
		const identity: ExtensionIdentityApi = {
			async getAuthToken() {
				return {};
			},
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow(details) {
				launches += 1;
				const state = new URL(details.url).searchParams.get('state');
				return `https://extension.chromiumapp.org/#access_token=edge-token&expires_in=3600&state=${state}`;
			}
		};

		assert.equal(
			await requestGoogleToken(identity, true, webClientId, store, () => 1_000),
			'edge-token'
		);
		assert.equal(
			await requestGoogleToken(identity, false, webClientId, store, () => 2_000),
			'edge-token'
		);
		assert.equal(launches, 1);
		assert.deepEqual(cached, { token: 'edge-token', expiresAt: 3_601_000 });
	});

	it('uses a silent web auth flow for background checks', async () => {
		const identity: ExtensionIdentityApi = {
			async getAuthToken() {
				return {};
			},
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow(details) {
				assert.equal(details.interactive, false);
				assert.equal(new URL(details.url).searchParams.get('prompt'), 'none');
				const state = new URL(details.url).searchParams.get('state');
				return `https://extension.chromiumapp.org/#access_token=silent-token&state=${state}`;
			},
			async removeCachedAuthToken() {}
		};

		assert.equal(await requestGoogleToken(identity, false, webClientId), 'silent-token');
	});

	it('rejects a redirected response with the wrong state', async () => {
		const identity: ExtensionIdentityApi = {
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow() {
				return 'https://extension.chromiumapp.org/#access_token=stolen&state=wrong';
			}
		};

		await assert.rejects(
			() => requestGoogleToken(identity, true, webClientId),
			/OAuth không hợp lệ/
		);
	});

	it('reports that Google must be connected when neither token flow succeeds', async () => {
		const identity: ExtensionIdentityApi = {
			async getAuthToken() {
				return {};
			},
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow() {
				return undefined;
			},
			async removeCachedAuthToken() {}
		};

		await assert.rejects(
			() => requestGoogleToken(identity, false, webClientId),
			/Kết nối Google Calendar/
		);
	});

	it('explains a Google OAuth redirect URI configuration failure', async () => {
		const identity: ExtensionIdentityApi = {
			async getAuthToken() {
				return {};
			},
			getRedirectURL() {
				return 'https://bmpehgpialackfeihijielalbcbcbk.chromiumapp.org/';
			},
			async launchWebAuthFlow() {
				return 'https://accounts.google.com/signin/oauth/error?authError=redirect_uri_mismatch';
			}
		};

		await assert.rejects(
			() => requestGoogleToken(identity, true, webClientId),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.match(error.message, /Authorized redirect URI|redirect URI/i);
				assert.match(error.message, /bmpehgpialackfeihijielalbcbcbk\.chromiumapp\.org/);
				return true;
			}
		);
	});

	it('preserves a safe browser OAuth failure reason for diagnosis', async () => {
		const identity: ExtensionIdentityApi = {
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow() {
				throw new Error('Authorization page could not be loaded');
			}
		};

		await assert.rejects(
			() => requestGoogleToken(identity, true, webClientId),
			/Authorization page could not be loaded/
		);
	});

	it('removes a Chrome-cached token without persisting web-flow tokens', async () => {
		let removed = '';
		const identity: ExtensionIdentityApi = {
			async getAuthToken() {
				return { token: 'cached-token' };
			},
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow() {
				return undefined;
			},
			async removeCachedAuthToken(details) {
				removed = details.token;
			}
		};

		await disconnectGoogle(identity);
		assert.equal(removed, 'cached-token');
	});

	it('clears a cached Edge web-flow token on disconnect', async () => {
		let removed = false;
		const store: ExtensionTokenStore = {
			async read() {
				return { token: 'edge-token', expiresAt: Date.now() + 60_000 };
			},
			async write() {},
			async remove() {
				removed = true;
			}
		};
		const identity: ExtensionIdentityApi = {
			getRedirectURL() {
				return 'https://extension.chromiumapp.org/';
			},
			async launchWebAuthFlow() {
				return undefined;
			}
		};

		await disconnectGoogle(identity, store);
		assert.equal(removed, true);
	});
});
