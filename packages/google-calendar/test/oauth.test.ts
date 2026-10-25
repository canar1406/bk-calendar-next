import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	CALENDAR_SCOPE,
	clearGoogleAccessToken,
	requestGoogleAccessToken,
	type GoogleIdentityApi
} from '../src/oauth.ts';

function fakeIdentity(response: Record<string, string>): {
	api: GoogleIdentityApi;
	config: Record<string, unknown>;
} {
	const capture: { config: Record<string, unknown> } = { config: {} };
	const api: GoogleIdentityApi = {
		accounts: {
			oauth2: {
				initTokenClient(config) {
					capture.config = config as unknown as Record<string, unknown>;
					return {
						requestAccessToken() {
							queueMicrotask(() => config.callback(response));
						}
					};
				}
			}
		}
	};
	return {
		api,
		get config() {
			return capture.config;
		}
	};
}

describe('Google Identity access token flow', () => {
	it('restricts account chooser to the hcmut.edu.vn Google Workspace domain', async () => {
		const fake = fakeIdentity({ access_token: 'token-value' });
		const token = await requestGoogleAccessToken(fake.api, 'client-id');
		assert.equal(token, 'token-value');
		assert.equal(fake.config.client_id, 'client-id');
		assert.equal(fake.config.scope, CALENDAR_SCOPE);
		assert.equal(fake.config.prompt, 'select_account');
		assert.equal(fake.config.hosted_domain, 'hcmut.edu.vn');
	});

	it('rejects OAuth errors and missing access tokens', async () => {
		await assert.rejects(
			requestGoogleAccessToken(
				fakeIdentity({ error: 'access_denied', error_description: 'Người dùng từ chối' }).api,
				'client-id'
			),
			/Người dùng từ chối/
		);
		await assert.rejects(
			requestGoogleAccessToken(fakeIdentity({}).api, 'client-id'),
			/không trả về access token/
		);
	});

	it('settles when the account popup closes instead of leaving sync permanently busy', async () => {
		const identity: GoogleIdentityApi = {
			accounts: {
				oauth2: {
					initTokenClient(config) {
						return {
							requestAccessToken() {
								const callbacks = config as unknown as {
									error_callback?: (error: { type: string }) => void;
								};
								callbacks.error_callback?.({ type: 'popup_closed' });
							}
						};
					}
				}
			}
		};
		const outcome = await Promise.race([
			requestGoogleAccessToken(identity, 'popup-test').then(
				() => 'resolved',
				(error: Error) => error.message
			),
			new Promise<string>((resolve) => setTimeout(() => resolve('still waiting'), 40))
		]);
		assert.match(outcome, /đóng|hủy/iu);
	});

	it('explains Google user limits without suggesting that changing accounts bypasses them', async () => {
		await assert.rejects(
			requestGoogleAccessToken(
				fakeIdentity({ error: 'rate_limit_exceeded', error_description: 'Sign-in limit reached' })
					.api,
				'limit-test'
			),
			/Google Cloud|xác minh|chủ ứng dụng/iu
		);
	});

	it('reuses an unexpired in-memory token instead of requesting repeated consent', async () => {
		let requests = 0;
		const fake = fakeIdentity({ access_token: 'short-lived-token', expires_in: '3600' });
		const original = fake.api.accounts.oauth2.initTokenClient;
		fake.api.accounts.oauth2.initTokenClient = (config) => {
			requests++;
			return original(config);
		};
		assert.equal(await requestGoogleAccessToken(fake.api, 'cache-test'), 'short-lived-token');
		assert.equal(await requestGoogleAccessToken(fake.api, 'cache-test'), 'short-lived-token');
		assert.equal(requests, 1);
	});

	it('shares concurrent requests and supports invalidating a rejected token', async () => {
		let requests = 0;
		const fake = fakeIdentity({ access_token: 'fresh-token', expires_in: '3600' });
		const original = fake.api.accounts.oauth2.initTokenClient;
		fake.api.accounts.oauth2.initTokenClient = (config) => {
			requests++;
			return original(config);
		};
		await Promise.all([
			requestGoogleAccessToken(fake.api, 'single-flight'),
			requestGoogleAccessToken(fake.api, 'single-flight')
		]);
		assert.equal(requests, 1);
		clearGoogleAccessToken(fake.api, 'single-flight');
		await requestGoogleAccessToken(fake.api, 'single-flight');
		assert.equal(requests, 2);
	});

	it('ignores callbacks from a popup that already timed out', async (t) => {
		t.mock.timers.enable({ apis: ['setTimeout'] });
		let callback: (response: { access_token: string }) => void = () => {};
		let requests = 0;
		const api: GoogleIdentityApi = {
			accounts: {
				oauth2: {
					initTokenClient(config) {
						callback = config.callback;
						requests++;
						return { requestAccessToken() {} };
					}
				}
			}
		};
		const expired = requestGoogleAccessToken(api, 'late');
		const rejection = assert.rejects(expired, /quá lâu/iu);
		t.mock.timers.tick(120_000);
		await rejection;
		callback({ access_token: 'stale-token' });
		const next = requestGoogleAccessToken(api, 'late');
		assert.equal(requests, 2);
		callback({ access_token: 'fresh-token' });
		assert.equal(await next, 'fresh-token');
	});
});
