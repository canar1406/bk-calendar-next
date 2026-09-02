import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CALENDAR_SCOPE, requestGoogleAccessToken, type GoogleIdentityApi } from '../src/oauth.ts';

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
	it('allows account chooser without hosted-domain restriction', async () => {
		const fake = fakeIdentity({ access_token: 'token-value' });
		const token = await requestGoogleAccessToken(fake.api, 'client-id');
		assert.equal(token, 'token-value');
		assert.equal(fake.config.client_id, 'client-id');
		assert.equal(fake.config.scope, CALENDAR_SCOPE);
		assert.equal(fake.config.prompt, 'select_account consent');
		assert.equal('hosted_domain' in fake.config, false);
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
});
