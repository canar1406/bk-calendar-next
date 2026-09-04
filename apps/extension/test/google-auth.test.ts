import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	disconnectGoogle,
	requestGoogleToken,
	type ExtensionIdentityApi
} from '../src/background/google-auth.ts';

const webClientId = '290456536857-ujdg26n2gqovjc27h2mqrd9p6vhm7pbp.apps.googleusercontent.com';

describe('cross-browser extension Google OAuth', () => {
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
});
