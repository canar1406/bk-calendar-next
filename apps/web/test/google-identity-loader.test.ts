import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GoogleIdentityApi } from '../../../packages/google-calendar/src/oauth.ts';
import { loadGoogleIdentity } from '../src/lib/google-identity.ts';

const identity: GoogleIdentityApi = {
	accounts: {
		oauth2: {
			initTokenClient() {
				return { requestAccessToken() {} };
			}
		}
	}
};

describe('Google Identity script loader', () => {
	it('returns an already loaded Google Identity API without adding another script', async () => {
		let appended = false;
		const loaded = await loadGoogleIdentity({
			getIdentity: () => identity,
			appendScript() {
				appended = true;
			}
		});

		assert.equal(loaded, identity);
		assert.equal(appended, false);
	});

	it('resolves only after the GIS script exposes the identity API', async () => {
		let current: GoogleIdentityApi | undefined;
		const loaded = await loadGoogleIdentity({
			getIdentity: () => current,
			appendScript(callbacks) {
				current = identity;
				callbacks.onLoad();
			}
		});

		assert.equal(loaded, identity);
	});

	it('rejects when the GIS script cannot load', async () => {
		await assert.rejects(
			loadGoogleIdentity({
				getIdentity: () => undefined,
				appendScript(callbacks) {
					callbacks.onError();
				}
			}),
			/Google Identity Services/
		);
	});
});
