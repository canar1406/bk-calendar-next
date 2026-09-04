import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const popupPath = new URL('../src/popup/index.html', import.meta.url);

describe('MyBK credential opt-in UI', () => {
	it('requires explicit consent and uses password-manager-compatible autocomplete fields', async () => {
		const html = await readFile(popupPath, 'utf8');

		assert.match(html, /id="mybk-username"[^>]*autocomplete="username"/);
		assert.match(html, /id="mybk-password"[^>]*autocomplete="current-password"/);
		assert.match(html, /id="credential-consent"[^>]*type="checkbox"/);
		assert.equal(/id="credential-consent"[^>]*checked/.test(html), false);
		assert.match(html, /id="remove-credentials"/);
		assert.match(html, /id="tracking-mode"/);
		assert.match(html, /value="off"/);
		assert.match(html, /value="review"[^>]*selected/);
		assert.match(html, /value="auto-safe"/);
		assert.match(html, /id="connect-google"/);
		assert.match(html, /id="disconnect-google"/);
	});
});
