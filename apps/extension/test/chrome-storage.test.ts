import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createChromeStorage } from '../src/storage/chrome.ts';

describe('chrome.storage.local adapter', () => {
	it('implements the shared key-value storage contract', async () => {
		const values: Record<string, unknown> = {};
		const storage = createChromeStorage({
			async get(key) {
				return key in values ? { [key]: values[key] } : {};
			},
			async set(items) {
				Object.assign(values, structuredClone(items));
			},
			async remove(key) {
				delete values[key];
			}
		});

		assert.equal(await storage.get('profile'), undefined);
		await storage.set('profile', { semester: 261 });
		assert.deepEqual(await storage.get('profile'), { semester: 261 });
		await storage.remove('profile');
		assert.equal(await storage.get('profile'), undefined);
	});
});
