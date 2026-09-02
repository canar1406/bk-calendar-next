import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatIcalendar } from '../src/index.ts';
import type { ManagedEvent, TimetableSnapshot } from '../../timetable/src/index.ts';

const event: ManagedEvent = {
	stableKey: 'student-2024-261-mt1003-l11-mon-0',
	fingerprint: 'fingerprint-1',
	sourceKind: 'student-2024',
	semester: 261,
	courseCode: 'MT1003',
	group: 'L11',
	sessionOrdinal: 0,
	weekday: 2,
	title: 'Giải tích 1, đại cương; A\\B',
	location: 'H1; GĐH1',
	start: '2026-08-31T00:00:00.000Z',
	end: '2026-08-31T02:50:00.000Z',
	timeZone: 'Asia/Ho_Chi_Minh',
	activeWeekIndexes: [0, 2],
	excludedStarts: ['2026-09-07T00:00:00.000Z'],
	metadata: { note: 'Dòng một\nDòng hai', lecturer: 'Giảng viên có tên rất dài '.repeat(5) }
};
const snapshot: TimetableSnapshot = {
	schemaVersion: 1,
	sourceKind: 'student-2024',
	semester: 261,
	capturedAt: '2026-09-02T00:00:00.000Z',
	fingerprint: 'snapshot-1',
	events: [event],
	warnings: []
};
const options = {
	calendarName: 'BKalendar 261',
	generatedAt: new Date('2026-09-02T00:00:00.000Z')
};

describe('iCalendar formatter', () => {
	it('uses deterministic UID and escapes RFC 5545 text', () => {
		const first = formatIcalendar(snapshot, options);
		const second = formatIcalendar(snapshot, {
			...options,
			generatedAt: new Date('2026-09-03T00:00:00.000Z')
		});
		const uid = first.match(/^UID:(.+)$/m)?.[1]?.replace(/\r$/, '');
		assert.ok(uid);
		assert.ok(second.includes(`UID:${uid}`));
		assert.ok(first.includes('SUMMARY:Giải tích 1\\, đại cương\\; A\\\\B'));
		assert.ok(first.includes('LOCATION:H1\\; GĐH1'));
		assert.ok(first.includes('Dòng một\\nDòng hai'));
	});

	it('folds every physical line to at most 75 UTF-8 octets', () => {
		for (const line of formatIcalendar(snapshot, options).split('\r\n')) {
			assert.ok(new TextEncoder().encode(line).length <= 75, `${line} exceeded 75 octets`);
		}
	});

	it('ends with CRLF and emits recurrence exclusions', () => {
		const value = formatIcalendar(snapshot, options);
		assert.ok(value.endsWith('\r\n'));
		assert.ok(value.includes('RRULE:FREQ=WEEKLY;UNTIL=20260914T000000Z'));
		assert.ok(value.includes('EXDATE;TZID=Asia/Ho_Chi_Minh:20260907T070000'));
	});
});
