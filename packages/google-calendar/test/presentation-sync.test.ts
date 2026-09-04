import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	syncManagedPresentation,
	type GoogleCalendarGateway,
	type ManagedGoogleEvent
} from '../src/index.ts';
import type { ManagedEvent } from '../../timetable/src/index.ts';

const localEvent: ManagedEvent = {
	stableKey: 'bk2_math',
	fingerprint: 'source:color:5:icon:🧮',
	sourceFingerprint: 'source',
	colorId: '5',
	icon: '🧮',
	sourceKind: 'student-2024',
	semester: 261,
	courseCode: 'MT1003',
	group: 'L01',
	sessionOrdinal: 0,
	weekday: 2,
	title: 'Giải tích 1',
	location: 'H1',
	start: '2026-08-31T00:00:00.000Z',
	end: '2026-08-31T01:00:00.000Z',
	timeZone: 'Asia/Ho_Chi_Minh',
	activeWeekIndexes: [0],
	excludedStarts: [],
	metadata: {}
};

describe('presentation-only Google sync', () => {
	it('patches matching managed events without inserting or deleting anything', async () => {
		const calls: string[] = [];
		let patched: ManagedEvent | undefined;
		const gateway = createGateway(
			[
				{
					id: 'remote-math',
					etag: 'etag-math',
					stableKey: localEvent.stableKey,
					fingerprint: 'source:color:2:icon:📘',
					sourceFingerprint: 'source',
					colorId: '2',
					icon: '📘'
				}
			],
			calls
		);
		gateway.patchEvent = async (_calendarId, eventId, event, etag) => {
			calls.push(`patch:${eventId}:${etag}`);
			patched = event;
			return remote(eventId, event);
		};

		const result = await syncManagedPresentation(gateway, 'calendar-261', [localEvent]);

		assert.deepEqual(calls, ['list:calendar-261', 'patch:remote-math:etag-math']);
		assert.deepEqual(result, {
			patched: 1,
			unchanged: 0,
			missing: 0,
			failed: []
		});
		assert.equal(patched?.colorId, '5');
		assert.equal(patched?.icon, '🧮');
	});

	it('does not recreate a missing event during a presentation-only sync', async () => {
		const calls: string[] = [];
		const gateway = createGateway([], calls);

		const result = await syncManagedPresentation(gateway, 'calendar-261', [localEvent]);

		assert.deepEqual(calls, ['list:calendar-261']);
		assert.deepEqual(result, {
			patched: 0,
			unchanged: 0,
			missing: 1,
			failed: []
		});
	});
});

function createGateway(existing: ManagedGoogleEvent[], calls: string[]): GoogleCalendarGateway {
	return {
		async listManagedEvents(calendarId) {
			calls.push(`list:${calendarId}`);
			return existing;
		},
		async insertEvent() {
			calls.push('insert');
			throw new Error('presentation sync must not insert');
		},
		async patchEvent(_calendarId, eventId, event) {
			calls.push(`patch:${eventId}`);
			return remote(eventId, event);
		},
		async deleteEvent() {
			calls.push('delete');
			throw new Error('presentation sync must not delete');
		}
	};
}

function remote(id: string, event: ManagedEvent): ManagedGoogleEvent {
	return {
		id,
		stableKey: event.stableKey,
		fingerprint: event.fingerprint ?? '',
		...(event.sourceFingerprint ? { sourceFingerprint: event.sourceFingerprint } : {}),
		...(event.colorId ? { colorId: event.colorId } : {}),
		...(event.icon ? { icon: event.icon } : {})
	};
}
