import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	syncManagedCalendar,
	type GoogleCalendarGateway,
	type ManagedGoogleEvent
} from '../src/index.ts';
import type { ManagedEvent } from '../../timetable/src/index.ts';

function local(stableKey: string, fingerprint: string, location = 'H1'): ManagedEvent {
	return {
		stableKey,
		fingerprint,
		sourceKind: 'student-2024',
		semester: 261,
		courseCode: stableKey,
		group: 'L01',
		sessionOrdinal: 0,
		weekday: 2,
		title: stableKey,
		location,
		start: '2026-08-31T00:00:00.000Z',
		end: '2026-08-31T01:00:00.000Z',
		timeZone: 'Asia/Ho_Chi_Minh',
		activeWeekIndexes: [0],
		excludedStarts: [],
		metadata: {}
	};
}
const remote = (
	id: string,
	stableKey: string,
	fingerprint: string,
	overrides: Partial<ManagedGoogleEvent> = {}
): ManagedGoogleEvent => ({
	id,
	etag: `etag-${id}`,
	stableKey,
	fingerprint,
	...overrides
});

function gateway(existing: ManagedGoogleEvent[]) {
	const calls: string[] = [];
	const api: GoogleCalendarGateway = {
		listManagedEvents: async () => existing,
		insertEvent: async (_calendarId, event) => {
			calls.push(`insert:${event.stableKey}`);
			return remote(`new-${event.stableKey}`, event.stableKey, event.fingerprint ?? '');
		},
		patchEvent: async (_calendarId, id, event) => {
			calls.push(`patch:${id}:${event.location}`);
			return remote(id, event.stableKey, event.fingerprint ?? '');
		},
		deleteEvent: async (_calendarId, id) => {
			calls.push(`delete:${id}`);
		}
	};
	return { api, calls };
}

describe('managed Google Calendar reconciliation', () => {
	it('does not write anything on an identical second sync', async () => {
		const { api, calls } = gateway([remote('event-1', 'MT1003', 'same')]);
		const result = await syncManagedCalendar(api, 'calendar-1', [local('MT1003', 'same')]);
		assert.deepEqual(calls, []);
		assert.deepEqual(
			{
				inserted: result.inserted,
				patched: result.patched,
				deleted: result.deleted,
				unchanged: result.unchanged
			},
			{ inserted: 0, patched: 0, deleted: 0, unchanged: 1 }
		);
	});

	it('preserves remote course presentation during an extension check with unchanged source', async () => {
		const { api, calls } = gateway([
			remote('event-1', 'MT1003', 'same:color:5:icon:🧮', {
				sourceFingerprint: 'same',
				colorId: '5',
				icon: '🧮'
			})
		]);

		const result = await syncManagedCalendar(api, 'calendar-1', [local('MT1003', 'same')]);

		assert.deepEqual(calls, []);
		assert.equal(result.unchanged, 1);
	});

	it('patches a changed course presentation even when the timetable source is unchanged', async () => {
		let patched: ManagedEvent | undefined;
		const { api } = gateway([
			remote('event-1', 'MT1003', 'same:color:2:icon:📘', {
				sourceFingerprint: 'same',
				colorId: '2',
				icon: '📘'
			})
		]);
		api.patchEvent = async (_calendarId, _eventId, event) => {
			patched = event;
			return remote('event-1', event.stableKey, event.fingerprint ?? '');
		};

		const result = await syncManagedCalendar(
			api,
			'calendar-1',
			[
				{
					...local('MT1003', 'same'),
					colorId: '5',
					icon: '🧮',
					sourceFingerprint: 'same',
					fingerprint: 'same:color:5:icon:🧮'
				}
			],
			{ allowDeletes: false }
		);

		assert.equal(result.patched, 1);
		assert.equal(patched?.colorId, '5');
		assert.equal(patched?.icon, '🧮');
		assert.equal(patched?.sourceFingerprint, 'same');
		assert.equal(patched?.fingerprint, 'same:color:5:icon:🧮');
	});

	it('inherits course presentation when patching a changed MyBK source', async () => {
		let patched: ManagedEvent | undefined;
		const { api } = gateway([
			remote('event-1', 'MT1003', 'old:color:5:icon:🧮', {
				sourceFingerprint: 'old',
				colorId: '5',
				icon: '🧮'
			})
		]);
		api.patchEvent = async (_calendarId, _eventId, event) => {
			patched = event;
			return remote('event-1', event.stableKey, event.fingerprint ?? '');
		};

		const result = await syncManagedCalendar(api, 'calendar-1', [local('MT1003', 'new')]);

		assert.equal(result.patched, 1);
		assert.equal(patched?.colorId, '5');
		assert.equal(patched?.icon, '🧮');
		assert.equal(patched?.sourceFingerprint, 'new');
		assert.equal(patched?.fingerprint, 'new:color:5:icon:🧮');
	});

	it('removes duplicate managed copies while preserving one canonical event', async () => {
		const { api, calls } = gateway([
			remote('event-a', 'MT1003', 'same'),
			remote('event-b', 'MT1003', 'same')
		]);

		const result = await syncManagedCalendar(api, 'calendar-1', [local('MT1003', 'same')]);

		assert.deepEqual(calls, ['delete:event-b']);
		assert.deepEqual(
			{
				deleted: result.deleted,
				unchanged: result.unchanged,
				skippedDeletes: result.skippedDeletes
			},
			{ deleted: 1, unchanged: 1, skippedDeletes: 0 }
		);
	});

	it('does not remove duplicate managed copies when deletion is blocked', async () => {
		const { api, calls } = gateway([
			remote('event-a', 'MT1003', 'same'),
			remote('event-b', 'MT1003', 'same')
		]);

		const result = await syncManagedCalendar(api, 'calendar-1', [local('MT1003', 'same')], {
			allowDeletes: false
		});

		assert.deepEqual(calls, []);
		assert.equal(result.skippedDeletes, 1);
	});

	it('inserts new, patches changed and deletes removed managed events', async () => {
		const { api, calls } = gateway([
			remote('physics-id', 'PH1003', 'old'),
			remote('removed-id', 'AS1001', 'old')
		]);
		const result = await syncManagedCalendar(api, 'calendar-1', [
			local('PH1003', 'new', 'H3-301'),
			local('MT1003', 'new')
		]);
		assert.deepEqual(calls, ['insert:MT1003', 'patch:physics-id:H3-301', 'delete:removed-id']);
		assert.deepEqual(
			{
				inserted: result.inserted,
				patched: result.patched,
				deleted: result.deleted,
				unchanged: result.unchanged
			},
			{ inserted: 1, patched: 1, deleted: 1, unchanged: 0 }
		);
	});

	it('reports partial failures and continues remaining operations', async () => {
		const { api, calls } = gateway([remote('removed-id', 'AS1001', 'old')]);
		api.insertEvent = async () => {
			calls.push('insert:MT1003');
			throw new Error('quota exceeded');
		};
		const result = await syncManagedCalendar(api, 'calendar-1', [local('MT1003', 'new')]);
		assert.deepEqual(calls, ['insert:MT1003', 'delete:removed-id']);
		assert.equal(result.failed.length, 1);
		assert.deepEqual(
			{ operation: result.failed[0]?.operation, stableKey: result.failed[0]?.stableKey },
			{ operation: 'insert', stableKey: 'MT1003' }
		);
	});

	it('reports remote events that were intentionally not deleted', async () => {
		const { api, calls } = gateway([remote('sample-id', 'CO1027', 'sample')]);
		const result = await syncManagedCalendar(api, 'calendar-1', [], {
			allowDeletes: false
		});

		assert.deepEqual(calls, []);
		assert.equal(result.deleted, 0);
		assert.equal(result.skippedDeletes, 1);
	});
});
