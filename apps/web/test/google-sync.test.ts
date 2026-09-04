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
import { GoogleCalendarApiError } from '../../../packages/google-calendar/src/index.ts';
import {
	createProfileStore,
	type KeyValueStorage,
	type SyncProfile
} from '../../../packages/timetable/src/storage.ts';
import { syncPendingProfile, syncWithGoogleReauth } from '../src/lib/google-sync.ts';

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
	it('re-authenticates once after Google reports an expired token', async () => {
		let tokenRequests = 0;
		let syncAttempts = 0;
		let retryPreparation = 0;
		const result = await syncWithGoogleReauth({
			requestToken: async () => `token-${++tokenRequests}`,
			run: async () => {
				syncAttempts += 1;
				if (syncAttempts === 1) throw new Error('Google Calendar API 401: Invalid Credentials');
				return 'synced';
			},
			beforeRetry: () => {
				retryPreparation += 1;
			}
		});

		assert.equal(result, 'synced');
		assert.equal(tokenRequests, 2);
		assert.equal(syncAttempts, 2);
		assert.equal(retryPreparation, 1);
	});

	it('migrates a legacy repo calendar so new events are added and stale ones are removed', async () => {
		const store = createProfileStore(new MemoryStorage());
		const pending = await snapshot(
			[
				event,
				{ ...event, stableKey: 'new-event', courseCode: 'AS1001', title: 'Nhập môn kỹ thuật' }
			],
			{ state: 'complete', parsedRows: 2, expectedRows: 2 }
		);
		await store.save({
			schemaVersion: 1,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			pendingSnapshot: pending
		});
		const calls: string[] = [];
		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway: {
				...emptyGateway(),
				async listCalendarEvents() {
					return [
						{
							id: 'legacy-old',
							stableKey: 'legacy:legacy-old',
							fingerprint: 'legacy:legacy-old',
							summary: 'Môn cũ',
							description: 'courseCode: OLD1001',
							location: 'H1',
							start: event.start,
							end: event.end
						},
						{
							id: 'legacy-current',
							stableKey: 'legacy:legacy-current',
							fingerprint: 'legacy:legacy-current',
							summary: event.title,
							description: 'courseCode: MT1003',
							location: event.location,
							start: event.start,
							end: event.end
						},
						{
							id: 'personal-note',
							stableKey: 'legacy:personal-note',
							fingerprint: 'legacy:personal-note',
							summary: 'Việc cá nhân',
							description: 'Ghi chú riêng',
							location: '',
							start: event.start,
							end: event.end
						}
					];
				},
				async listManagedEvents() {
					throw new Error('legacy adapter must list unmarked events');
				},
				async insertEvent(_calendarId, localEvent) {
					calls.push(`insert:${localEvent.courseCode}`);
					return remote(localEvent);
				},
				async patchEvent(_calendarId, _eventId, localEvent) {
					calls.push(`patch:${localEvent.courseCode}`);
					return remote(localEvent);
				},
				async deleteEvent(_calendarId, eventId) {
					calls.push(`delete:${eventId}`);
				}
			},
			async findCalendars() {
				return [];
			},
			async findLegacyCalendars() {
				return [{ id: 'legacy-calendar' }];
			},
			async createCalendar() {
				throw new Error('should reuse the legacy calendar');
			}
		});

		assert.deepEqual(calls, ['insert:AS1001', 'patch:MT1003', 'delete:legacy-old']);
		assert.equal(synced.profile.calendarId, 'legacy-calendar');
		assert.equal(synced.profile.calendarOrigin, 'legacy');
		assert.equal(synced.promoted, true);
	});

	it('re-resolves a stale calendar ID after Google returns 404 before inserting new events', async () => {
		const store = createProfileStore(new MemoryStorage());
		const pending = await snapshot(
			[{ ...event, courseCode: 'AS1001', title: 'Nhập môn kỹ thuật' }],
			{ state: 'complete', parsedRows: 1, expectedRows: 1 }
		);
		await store.save({
			schemaVersion: 1,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			calendarId: 'old-account-calendar',
			pendingSnapshot: pending
		});
		let listCalls = 0;
		let insertedInto = '';
		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway: {
				...emptyGateway(),
				async listManagedEvents(calendarId) {
					listCalls += 1;
					if (calendarId === 'old-account-calendar') {
						throw new GoogleCalendarApiError(404, 'Not Found');
					}
					return [];
				},
				async insertEvent(calendarId, localEvent) {
					insertedInto = `${calendarId}:${localEvent.courseCode}`;
					return remote(localEvent);
				}
			},
			async findCalendars() {
				return [{ id: 'new-account-calendar' }];
			},
			async createCalendar() {
				throw new Error('must reuse the current account calendar');
			}
		});

		assert.equal(listCalls, 2);
		assert.equal(insertedInto, 'new-account-calendar:AS1001');
		assert.equal(synced.profile.calendarId, 'new-account-calendar');
		assert.equal(synced.promoted, true);
	});

	it('recognizes an existing original-repo calendar ID before syncing its unmarked events', async () => {
		const store = createProfileStore(new MemoryStorage());
		const pending = await snapshot(
			[{ ...event, courseCode: 'AS1001', title: 'Nhập môn kỹ thuật' }],
			{ state: 'complete', parsedRows: 1, expectedRows: 1 }
		);
		await store.save({
			schemaVersion: 1,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			calendarId: 'legacy-student-calendar',
			pendingSnapshot: pending
		});
		let legacyListCalls = 0;
		let inserted = 0;
		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway: {
				...emptyGateway(),
				async listCalendarEvents() {
					legacyListCalls += 1;
					return [];
				},
				async insertEvent() {
					inserted += 1;
					return remote(event);
				}
			},
			async findLegacyCalendars() {
				return [{ id: 'legacy-student-calendar' }];
			},
			async createCalendar() {
				throw new Error('must reuse the recognized legacy calendar');
			}
		});

		assert.equal(legacyListCalls, 1);
		assert.equal(inserted, 1);
		assert.equal(synced.profile.calendarOrigin, 'legacy');
		assert.equal(synced.promoted, true);
	});

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

	it('applies presentation colors and icons only to Google payload events', async () => {
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
		let inserted: ManagedEvent | undefined;

		await syncPendingProfile(store, 'student-2024:261', {
			gateway: {
				...emptyGateway(),
				async insertEvent(_calendarId, localEvent) {
					inserted = localEvent;
					return remote(localEvent);
				}
			},
			prepareEvents(events) {
				return events.map((item) => ({
					...item,
					colorId: '5',
					icon: '🧮',
					sourceFingerprint: item.fingerprint ?? '',
					fingerprint: `${item.fingerprint}:color:5:icon:🧮`
				}));
			},
			async createCalendar() {
				return { id: 'calendar-id' };
			}
		});

		assert.equal(inserted?.title, 'Giải tích 1');
		assert.equal(inserted?.icon, '🧮');
		assert.equal(inserted?.colorId, '5');
		assert.equal(
			(await store.get('student-2024:261'))?.acceptedSnapshot?.events[0]?.title,
			'Giải tích 1'
		);
	});

	it('patches presentation changes even when the source timetable itself is unchanged', async () => {
		const store = createProfileStore(new MemoryStorage());
		const accepted = await snapshot([event], {
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
			acceptedSnapshot: accepted,
			pendingSnapshot: accepted
		});
		let patched: ManagedEvent | undefined;

		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway: {
				...emptyGateway(),
				async listManagedEvents() {
					return [
						{
							id: 'remote-event',
							stableKey: event.stableKey,
							fingerprint: `${event.fingerprint}:color:7:icon:`
						}
					];
				},
				async patchEvent(_calendarId, _eventId, localEvent) {
					patched = localEvent;
					return remote(localEvent);
				}
			},
			prepareEvents(events) {
				return events.map((item) => ({
					...item,
					colorId: '5',
					icon: '🧮',
					sourceFingerprint: item.fingerprint ?? '',
					fingerprint: `${item.fingerprint}:color:5:icon:🧮`
				}));
			},
			async createCalendar() {
				throw new Error('must reuse the stored calendar');
			}
		});

		assert.equal(synced.result.patched, 1);
		assert.equal(patched?.colorId, '5');
		assert.equal(patched?.icon, '🧮');
		assert.equal(patched?.title, 'Giải tích 1');
	});

	it('reuses an existing managed semester calendar instead of creating a duplicate', async () => {
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
		let createCalls = 0;
		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway: emptyGateway(),
			async findCalendars(summary) {
				assert.equal(summary, 'BKalendar • HK 261');
				return [{ id: 'existing-calendar-id' }];
			},
			async createCalendar() {
				createCalls += 1;
				return { id: 'duplicate-calendar-id' };
			}
		});

		assert.equal(createCalls, 0);
		assert.equal(synced.profile.calendarId, 'existing-calendar-id');
		assert.equal((await store.get('student-2024:261'))?.calendarId, 'existing-calendar-id');
	});

	it('refuses to synchronize into the personal primary calendar even if storage is tampered', async () => {
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
			calendarId: 'primary',
			pendingSnapshot: pending
		});
		let gatewayCalls = 0;

		await assert.rejects(
			syncPendingProfile(store, 'student-2024:261', {
				gateway: {
					...emptyGateway(),
					async listManagedEvents() {
						gatewayCalls += 1;
						return [];
					}
				},
				async createCalendar() {
					throw new Error('must not create a calendar');
				}
			}),
			/lịch cá nhân mặc định/
		);
		assert.equal(gatewayCalls, 0);
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

	it('does not promote when remote stale events are skipped even if accepted matches pending', async () => {
		const store = createProfileStore(new MemoryStorage());
		const accepted = await snapshot([event], {
			state: 'complete',
			parsedRows: 1,
			expectedRows: 1
		});
		const pending = await createSnapshot({
			...accepted,
			capturedAt: '2026-09-03T00:00:00.000Z',
			completeness: { state: 'unknown', parsedRows: 1 },
			events: accepted.events
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
		const staleRemote = { ...event, stableKey: 'bk2_sample', fingerprint: 'sample' };
		const gateway: GoogleCalendarGateway = {
			async listManagedEvents() {
				return [remote(event), remote(staleRemote)];
			},
			async insertEvent(_calendarId, localEvent) {
				return remote(localEvent);
			},
			async patchEvent(_calendarId, _eventId, localEvent) {
				return remote(localEvent);
			},
			async deleteEvent() {
				throw new Error('deletion must remain blocked');
			}
		};

		const synced = await syncPendingProfile(store, 'student-2024:261', {
			gateway,
			async createCalendar() {
				throw new Error('must not create another calendar');
			}
		});

		assert.equal(synced.result.skippedDeletes, 1);
		assert.equal(synced.promoted, false);
		assert.equal(
			(await store.get('student-2024:261'))?.pendingSnapshot?.fingerprint,
			pending.fingerprint
		);
	});

	it('rejects sample snapshots before creating or modifying a Google calendar', async () => {
		const store = createProfileStore(new MemoryStorage());
		const pending = await createSnapshot({
			sourceKind: 'student-2024',
			semester: 261,
			capturedAt: '2026-09-03T00:00:00.000Z',
			provenance: 'sample',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 },
			warnings: [],
			events: [event]
		});
		await store.save({
			schemaVersion: 1,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			pendingSnapshot: pending
		});
		let gatewayCalls = 0;

		await assert.rejects(
			syncPendingProfile(store, 'student-2024:261', {
				gateway: {
					async listManagedEvents() {
						gatewayCalls += 1;
						return [];
					},
					async insertEvent(_calendarId, localEvent) {
						return remote(localEvent);
					},
					async patchEvent(_calendarId, _eventId, localEvent) {
						return remote(localEvent);
					},
					async deleteEvent() {}
				},
				async createCalendar() {
					gatewayCalls += 1;
					return { id: 'must-not-exist' };
				}
			}),
			/dữ liệu mẫu/i
		);
		assert.equal(gatewayCalls, 0);
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

function emptyGateway(): GoogleCalendarGateway {
	return {
		async listManagedEvents() {
			return [];
		},
		async insertEvent(_calendarId, localEvent) {
			return remote(localEvent);
		},
		async patchEvent(_calendarId, _eventId, localEvent) {
			return remote(localEvent);
		},
		async deleteEvent() {}
	};
}
