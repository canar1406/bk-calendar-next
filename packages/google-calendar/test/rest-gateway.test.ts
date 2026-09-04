import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	GoogleCalendarRestGateway,
	MANAGED_BY,
	createManagedCalendar,
	findLegacyCalendars,
	findManagedCalendars,
	isGoogleCalendarAuthError,
	toGoogleEventResource
} from '../src/rest.ts';
import type { ManagedEvent } from '../../timetable/src/index.ts';

const managedEvent: ManagedEvent = {
	stableKey: 'bk2_abc123',
	fingerprint: 'fingerprint-1',
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
	activeWeekIndexes: [0, 2],
	excludedStarts: ['2026-08-31T00:00:00.000Z'],
	metadata: { courseCode: 'MT1003', group: 'L11' }
};

function response(body: unknown, status = 200): Response {
	return new Response(status === 204 ? null : JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' }
	});
}

describe('Google Calendar REST payload', () => {
	it('finds calendars created by the original BKalendar names', async () => {
		const fetcher: typeof fetch = async () =>
			response({
				items: [
					{ id: 'primary', primary: true, summary: 'SV261' },
					{ id: 'legacy-student', summary: 'SV261' },
					{ id: 'unrelated', summary: 'SV262' }
				]
			});

		assert.deepEqual(await findLegacyCalendars(fetcher, 'token', 'student-2024', 261), [
			{ id: 'legacy-student' }
		]);
	});

	it('identifies expired or unauthorized Google tokens without classifying ordinary API errors', () => {
		assert.equal(
			isGoogleCalendarAuthError(new Error('Google Calendar API 401: Invalid Credentials')),
			true
		);
		assert.equal(
			isGoogleCalendarAuthError(new Error('Google Calendar API 403: quota exceeded')),
			false
		);
	});

	it('marks events and emits recurring master data', () => {
		const resource = toGoogleEventResource({
			...managedEvent,
			colorId: '5',
			icon: '🧮',
			sourceFingerprint: 'source-fingerprint'
		});
		assert.equal(resource.summary, '🧮 Giải tích 1');
		assert.deepEqual(resource.start, {
			dateTime: managedEvent.start,
			timeZone: 'Asia/Ho_Chi_Minh'
		});
		assert.deepEqual(resource.extendedProperties?.private, {
			managedBy: MANAGED_BY,
			schemaVersion: '1',
			stableKey: 'bk2_abc123',
			fingerprint: 'fingerprint-1',
			sourceFingerprint: 'source-fingerprint',
			courseIcon: '🧮'
		});
		assert.equal(resource.colorId, '5');
		assert.ok(resource.recurrence?.some((line) => line.startsWith('RRULE:FREQ=WEEKLY;')));
		assert.ok(resource.recurrence?.includes('EXDATE;TZID=Asia/Ho_Chi_Minh:20260831T070000'));
	});

	it('creates one dedicated managed calendar', async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetcher: typeof fetch = async (input, init) => {
			calls.push(init === undefined ? { url: String(input) } : { url: String(input), init });
			return response({ id: 'calendar-id', summary: 'BKalendar • HK 261' });
		};
		const calendar = await createManagedCalendar(fetcher, 'token', 'BKalendar • HK 261');
		assert.equal(calendar.id, 'calendar-id');
		assert.equal(calls[0]?.url, 'https://www.googleapis.com/calendar/v3/calendars');
		assert.equal(calls[0]?.init?.method, 'POST');
		assert.equal((calls[0]?.init?.headers as Record<string, string>).Authorization, 'Bearer token');
	});

	it('finds an existing managed semester calendar and excludes personal calendars', async () => {
		const fetcher: typeof fetch = async (input) => {
			assert.match(String(input), /calendarList/);
			return response({
				items: [
					{
						id: 'primary',
						primary: true,
						summary: 'BKalendar • HK 261',
						description: `Managed by ${MANAGED_BY}.`
					},
					{
						id: 'managed-calendar-id',
						summary: 'BKalendar • HK 261',
						description: `Managed by ${MANAGED_BY}. Các sự kiện trong lịch này được BKalendar cập nhật.`
					},
					{
						id: 'personal-calendar-id',
						summary: 'BKalendar • HK 261',
						description: 'Lịch cá nhân có tên giống BKalendar'
					}
				]
			});
		};

		assert.deepEqual(await findManagedCalendars(fetcher, 'token', 'BKalendar • HK 261'), [
			{ id: 'managed-calendar-id' }
		]);
	});

	it('falls back when the narrow app-created scope cannot list the user calendar list', async () => {
		const fetcher: typeof fetch = async () =>
			response(
				{
					error: {
						code: 403,
						message: 'Request had insufficient authentication scopes.',
						status: 'PERMISSION_DENIED',
						details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }]
					}
				},
				403
			);

		assert.deepEqual(await findManagedCalendars(fetcher, 'token', 'BKalendar • HK 261'), []);
	});

	it('does not hide unrelated calendar-list failures', async () => {
		const fetcher: typeof fetch = async () =>
			response({ error: { code: 403, message: 'Account policy denied access.' } }, 403);

		await assert.rejects(
			() => findManagedCalendars(fetcher, 'token', 'BKalendar • HK 261'),
			/Account policy denied access/
		);
	});
});

describe('Google Calendar REST gateway', () => {
	it('lists legacy events without requiring the new managed metadata marker', async () => {
		const fetcher: typeof fetch = async (input) => {
			assert.match(String(input), /events/);
			assert.doesNotMatch(String(input), /privateExtendedProperty/);
			return response({
				items: [
					{
						id: 'legacy-event',
						etag: 'legacy-etag',
						summary: 'Giải tích 1',
						description: 'courseCode: MT1003',
						location: 'H1-304',
						start: { dateTime: '2026-08-24T00:00:00.000Z', timeZone: 'Asia/Ho_Chi_Minh' },
						end: { dateTime: '2026-08-24T02:50:00.000Z', timeZone: 'Asia/Ho_Chi_Minh' }
					}
				]
			});
		};
		const gateway = new GoogleCalendarRestGateway('token', fetcher);
		assert.deepEqual(await gateway.listCalendarEvents('legacy-calendar'), [
			{
				id: 'legacy-event',
				etag: 'legacy-etag',
				stableKey: 'legacy:legacy-event',
				fingerprint: 'legacy:legacy-event',
				summary: 'Giải tích 1',
				description: 'courseCode: MT1003',
				location: 'H1-304',
				start: '2026-08-24T00:00:00.000Z',
				end: '2026-08-24T02:50:00.000Z'
			}
		]);
	});

	it('paginates and returns only well-formed managed events', async () => {
		const urls: string[] = [];
		const fetcher: typeof fetch = async (input) => {
			const url = String(input);
			urls.push(url);
			if (!url.includes('pageToken='))
				return response({
					items: [
						{
							id: 'a',
							etag: 'ea',
							extendedProperties: { private: { stableKey: 'key-a', fingerprint: 'fa' } }
						},
						{ id: 'manual-event' }
					],
					nextPageToken: 'next token'
				});
			return response({
				items: [
					{
						id: 'b',
						etag: 'eb',
						extendedProperties: { private: { stableKey: 'key-b', fingerprint: 'fb' } }
					}
				]
			});
		};
		const gateway = new GoogleCalendarRestGateway('token', fetcher);
		const events = await gateway.listManagedEvents('calendar/id');
		assert.deepEqual(events, [
			{ id: 'a', etag: 'ea', stableKey: 'key-a', fingerprint: 'fa' },
			{ id: 'b', etag: 'eb', stableKey: 'key-b', fingerprint: 'fb' }
		]);
		assert.ok(urls[0]?.includes('singleEvents=false'));
		assert.ok(urls[0]?.includes('privateExtendedProperty=managedBy%3Dbkalendar-next'));
		assert.ok(urls[1]?.includes('pageToken=next+token'));
	});

	it('forwards ETags for safe patch and delete', async () => {
		const calls: Array<{ url: string; init?: RequestInit }> = [];
		const fetcher: typeof fetch = async (input, init) => {
			calls.push(init === undefined ? { url: String(input) } : { url: String(input), init });
			return init?.method === 'DELETE'
				? response({}, 204)
				: response({
						id: 'event-id',
						etag: 'new-etag',
						extendedProperties: {
							private: { stableKey: 'bk2_abc123', fingerprint: 'fingerprint-1' }
						}
					});
		};
		const gateway = new GoogleCalendarRestGateway('token', fetcher);
		await gateway.patchEvent('calendar/id', 'event/id', managedEvent, 'old-etag');
		await gateway.deleteEvent('calendar/id', 'event/id', 'new-etag');
		assert.equal(calls[0]?.init?.method, 'PATCH');
		assert.equal((calls[0]?.init?.headers as Record<string, string>)['If-Match'], 'old-etag');
		assert.equal(calls[1]?.init?.method, 'DELETE');
		assert.equal((calls[1]?.init?.headers as Record<string, string>)['If-Match'], 'new-etag');
	});
});
