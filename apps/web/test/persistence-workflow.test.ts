import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createProfileStore,
	type KeyValueStorage,
	type SyncProfile
} from '../../../packages/timetable/src/storage.ts';
import {
	prepareTimetable,
	stageTransferredSnapshot,
	stageTimetableImport
} from '../src/lib/workflow.ts';

const source = `20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Ngày cập nhật gần nhất của HK này: 28/08/2026 14:57:54
HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
20261\tMT1003\tGiải tích 1\t4\t4\tL11\t2\t2 - 4\t7:00 - 9:50\tH1-GĐH1\tBK-CS2\t35|--|37|
Trình bày từ dòng 1 đến 1 / 1 dòng`;

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

describe('persisted web import workflow', () => {
	it('stages a changed snapshot without replacing the accepted snapshot', async () => {
		const store = createProfileStore(new MemoryStorage());
		const accepted = await prepareTimetable(source, undefined, {
			capturedAt: '2026-09-02T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});
		const profile: SyncProfile = {
			schemaVersion: 1,
			profileId: accepted.profileId,
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			calendarId: 'calendar-id',
			acceptedSnapshot: accepted.snapshot
		};
		await store.save(profile);

		const staged = await stageTimetableImport(store, source.replace('H1-GĐH1', 'H1-101'), {
			capturedAt: '2026-09-03T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});
		const stored = await store.get(profile.profileId);

		assert.equal(staged.diff.changed.length, 1);
		assert.equal(stored?.calendarId, 'calendar-id');
		assert.equal(stored?.acceptedSnapshot?.fingerprint, accepted.snapshot.fingerprint);
		assert.equal(stored?.pendingSnapshot?.fingerprint, staged.snapshot.fingerprint);
	});

	it('does not mutate a stored profile when parsing fails', async () => {
		const store = createProfileStore(new MemoryStorage());
		const accepted = await prepareTimetable(source, undefined, {
			capturedAt: '2026-09-02T00:00:00.000Z'
		});
		const profile: SyncProfile = {
			schemaVersion: 1,
			profileId: accepted.profileId,
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			acceptedSnapshot: accepted.snapshot
		};
		await store.save(profile);

		await assert.rejects(stageTimetableImport(store, 'dữ liệu không hợp lệ'), /table/i);
		assert.deepEqual(await store.get(profile.profileId), profile);
	});

	it('stages an extension snapshot while preserving the accepted snapshot and calendar ID', async () => {
		const store = createProfileStore(new MemoryStorage());
		const accepted = await prepareTimetable(source, undefined, {
			capturedAt: '2026-09-02T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});
		await store.save({
			schemaVersion: 1,
			profileId: accepted.profileId,
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			calendarId: 'calendar-id',
			acceptedSnapshot: accepted.snapshot
		});
		const incoming = await prepareTimetable(source.replace('H1-GĐH1', 'H1-101'), undefined, {
			capturedAt: '2026-09-03T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});

		const staged = await stageTransferredSnapshot(store, incoming.snapshot);
		const stored = await store.get(accepted.profileId);

		assert.equal(staged.diff.changed.length, 1);
		assert.equal(stored?.calendarId, 'calendar-id');
		assert.equal(stored?.acceptedSnapshot?.fingerprint, accepted.snapshot.fingerprint);
		assert.equal(stored?.pendingSnapshot?.fingerprint, incoming.snapshot.fingerprint);
	});
});
