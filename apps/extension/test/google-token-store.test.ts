import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createGoogleTokenStore,
	createMemoryTokenStorageArea,
	selectTokenStorageArea,
	type TokenStorageArea
} from '../src/background/google-token-store.ts';

describe('Google extension token store', () => {
	it('uses the session area when available and falls back safely when Edge omits it', async () => {
		const values = new Map<string, unknown>();
		const area: TokenStorageArea = {
			async get(key) {
				return { [key]: values.get(key) };
			},
			async set(items) {
				for (const [key, value] of Object.entries(items)) values.set(key, value);
			},
			async remove(key) {
				values.delete(key);
			}
		};

		const store = createGoogleTokenStore(selectTokenStorageArea(undefined, area));
		await store.write({ token: 'edge-token', expiresAt: 1_000 });
		assert.deepEqual(await store.read(), { token: 'edge-token', expiresAt: 1_000 });
		await store.remove();
		assert.equal(await store.read(), undefined);
	});

	it('uses an in-memory fallback instead of persistent local storage', async () => {
		const fallback = selectTokenStorageArea(undefined, createMemoryTokenStorageArea());

		await fallback.set({ token: { value: 'memory-only' } });
		assert.deepEqual(await fallback.get('token'), { token: { value: 'memory-only' } });
	});
});
