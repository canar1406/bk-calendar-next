import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createBrowserStorage,
	createProfileStore,
	type KeyValueStorage,
	type SyncProfile
} from '../src/storage.ts';

class MemoryStorage implements KeyValueStorage {
	private values = new Map<string, unknown>();
	async get<T>(key: string): Promise<T | undefined> {
		return this.values.get(key) as T | undefined;
	}
	async set<T>(key: string, value: T): Promise<void> {
		this.values.set(key, structuredClone(value));
	}
	async remove(key: string): Promise<void> {
		this.values.delete(key);
	}
}

const profile: SyncProfile = {
	schemaVersion: 1,
	profileId: 'student-2024:261',
	sourceKind: 'student-2024',
	semester: 261,
	calendarName: 'BKalendar • HK 261',
	calendarId: 'calendar-id',
	lastCheckedAt: '2026-09-02T00:00:00.000Z'
};

describe('local profile storage', () => {
	it('persists and lists profiles without credentials', async () => {
		const storage = new MemoryStorage();
		const store = createProfileStore(storage);
		await store.save(profile);
		assert.deepEqual(await store.get(profile.profileId), profile);
		assert.deepEqual(
			(await store.list()).map((item) => item.profileId),
			[profile.profileId]
		);
		assert.equal(JSON.stringify(await store.get(profile.profileId)).includes('accessToken'), false);
	});

	it('rejects unsupported schema versions', async () => {
		const storage = new MemoryStorage();
		await storage.set('bkalendar-next:profiles', [{ ...profile, schemaVersion: 99 }]);
		await assert.rejects(createProfileStore(storage).list(), /phiên bản dữ liệu/);
	});

	it('reports corrupted browser storage with a domain error', async () => {
		const storage = {
			getItem: () => '{not-json',
			setItem: () => undefined,
			removeItem: () => undefined
		} as unknown as Storage;

		await assert.rejects(
			createBrowserStorage(storage).get('bkalendar-next:profiles'),
			/Dữ liệu BKalendar đã hỏng/
		);
	});
});
