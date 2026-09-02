import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
	GoogleCalendarGateway,
	ManagedGoogleEvent
} from '../../../packages/google-calendar/src/index.ts';
import {
	createSnapshot,
	type CaptureCompleteness,
	type ManagedEvent
} from '../../../packages/timetable/src/index.ts';
import {
	createProfileStore,
	type KeyValueStorage,
	type SyncProfile
} from '../../../packages/timetable/src/storage.ts';
import { syncPendingProfile } from '../src/lib/google-sync.ts';

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

async function snapshot(events: ManagedEvent[], completeness: CaptureCompleteness) {
	return await createSnapshot({
		sourceKind: 'student-2024',
		semester: 261,
		capturedAt: '2026-09-02T00:00:00.000Z',
		completeness,
		warnings: [],
		events
	});
}

const event: ManagedEvent = {
	stableKey: 'bk2_event',
	fingerprint: 'fingerprint',
	sourceKind: 'student-2024',
	semester: 261,
	courseCode: 'MT1003',
	group: 'L11',
	sessionOrdinal: 0,
	weekday: 2,
	title: 'Giải tích 1',
	location: 'H1-GĐH1',
	start: '2026-08-24T00:00:00.000Z',
	end: '2026-08-24T02:50:00.000Z',
	timeZone: 'Asia/Ho_Chi_Minh',
	activeWeekIndexes: [0],
	excludedStarts: [],
	metadata: { courseCode: 'MT1003' }
};

describe('Google profile sync workflow', () => {
	it('persists a newly created calendar ID before inserting events and then promotes the snapshot', async () => {
		const store = createProfileStore(new MemoryStorage());
		const pending = await snapshot([event], {
			state: 'complete',
			parsedRows: 1,
			expectedRows: 1
		});
		await store.save({
			schemaVersion: 1,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			pendingSnapshot: pending
		});

		const gateway: GoogleCalendarGateway = {
			async listManagedEvents() {
				return [];
			},
			async insertEvent(_calendarId, localEvent) {
				assert.equal((await store.get('student-2024:261'))?.calendarId, 'calendar-id');
				return remote(localEvent);
			},
			async patchEvent(_calendarId, _eventId, localEvent) {
				return remote(localEvent);
			},
			async deleteEvent() {}
		};

		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway,
			async createCalendar() {
				return { id: 'calendar-id' };
			},
			now: () => '2026-09-02T01:00:00.000Z'
		});
		const stored = await store.get('student-2024:261');

		assert.equal(synced.promoted, true);
		assert.equal(stored?.calendarId, 'calendar-id');
		assert.equal(stored?.acceptedSnapshot?.fingerprint, pending.fingerprint);
		assert.equal(stored?.pendingSnapshot, undefined);
		assert.equal(stored?.lastSyncedAt, '2026-09-02T01:00:00.000Z');
	});

	it('keeps the pending snapshot when a Google write fails', async () => {
		const store = createProfileStore(new MemoryStorage());
		const pending = await snapshot([event], {
			state: 'complete',
			parsedRows: 1,
			expectedRows: 1
		});
		await store.save({
			schemaVersion: 1,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			calendarId: 'calendar-id',
			pendingSnapshot: pending
		});

		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway: failingGateway(),
			async createCalendar() {
				throw new Error('must not create another calendar');
			}
		});
		const stored = await store.get('student-2024:261');

		assert.equal(synced.promoted, false);
		assert.equal(synced.result.failed.length, 1);
		assert.equal(stored?.acceptedSnapshot, undefined);
		assert.equal(stored?.pendingSnapshot?.fingerprint, pending.fingerprint);
	});

	it('does not delete or promote potential removals from an incomplete capture', async () => {
		const store = createProfileStore(new MemoryStorage());
		const accepted = await snapshot([event], {
			state: 'complete',
			parsedRows: 1,
			expectedRows: 1
		});
		const pending = await snapshot([], {
			state: 'incomplete',
			parsedRows: 0,
			expectedRows: 1
		});
		await store.save({
			schemaVersion: 1,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			calendarId: 'calendar-id',
			acceptedSnapshot: accepted,
			pendingSnapshot: pending
		});
		let deleteCalls = 0;
		const gateway: GoogleCalendarGateway = {
			async listManagedEvents() {
				return [remote(event)];
			},
			async insertEvent(_calendarId, localEvent) {
				return remote(localEvent);
			},
			async patchEvent(_calendarId, _eventId, localEvent) {
				return remote(localEvent);
			},
			async deleteEvent() {
				deleteCalls += 1;
			}
		};

		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway,
			async createCalendar() {
				throw new Error('must not create another calendar');
			}
		});
		const stored = await store.get('student-2024:261');

		assert.equal(deleteCalls, 0);
		assert.equal(synced.promoted, false);
		assert.equal(stored?.acceptedSnapshot?.fingerprint, accepted.fingerprint);
		assert.equal(stored?.pendingSnapshot?.fingerprint, pending.fingerprint);
	});
});

function remote(localEvent: ManagedEvent): ManagedGoogleEvent {
	return {
		id: `remote-${localEvent.stableKey}`,
		stableKey: localEvent.stableKey,
		fingerprint: localEvent.fingerprint ?? ''
	};
}

function failingGateway(): GoogleCalendarGateway {
	return {
		async listManagedEvents() {
			return [];
		},
		async insertEvent() {
			throw new Error('Google insert failed');
		},
		async patchEvent() {
			throw new Error('Google patch failed');
		},
		async deleteEvent() {
			throw new Error('Google delete failed');
		}
	};
}
