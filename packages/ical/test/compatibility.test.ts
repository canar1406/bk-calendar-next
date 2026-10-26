import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ICAL from 'ical.js';
import { formatIcalendar } from '../src/index.ts';
import type { ManagedEvent } from '../../timetable/src/index.ts';

const event: ManagedEvent = {
	stableKey: 'bk2_calendar_compatibility',
	sourceKind: 'student-2024',
	semester: 261,
	courseCode: 'MT1003',
	group: 'L11',
	sessionOrdinal: 0,
	weekday: 2,
	title: 'Giải tích 1; nhóm A, B',
	location: 'H1-101',
	start: '2026-08-24T00:30:00.000Z',
	end: '2026-08-24T02:00:00.000Z',
	timeZone: 'Asia/Ho_Chi_Minh',
	activeWeekIndexes: [0, 2, 3],
	excludedStarts: ['2026-09-14T00:30:00.000Z'],
	metadata: { note: 'Dòng một\nDòng hai' }
};

describe('portable calendar file compatibility', () => {
	it('emits independent UTC occurrences that an external iCalendar parser can read', () => {
		const text = formatIcalendar(
			{ events: [event] },
			{
				calendarName: 'Lịch học của tôi',
				generatedAt: new Date('2026-10-24T00:00:00Z'),
				recurrenceMode: 'expanded'
			}
		);
		assert.doesNotMatch(text, /(?:RRULE|EXDATE|TZID=|METHOD:)/u);
		const calendar = new ICAL.Component(ICAL.parse(text));
		const events = calendar.getAllSubcomponents('vevent').map((item) => new ICAL.Event(item));
		assert.equal(events.length, 2);
		assert.equal(events[0]?.startDate.toJSDate().toISOString(), event.start);
		assert.equal(events[1]?.startDate.toJSDate().toISOString(), '2026-09-07T00:30:00.000Z');
		assert.equal(events[0]?.summary, '[MT1003] Giải tích 1; nhóm A, B (L11)');
		assert.equal(events[0]?.location, event.location);
		assert.equal(new Set(events.map((item) => item.uid)).size, 2);
	});

	it('rejects broken event times instead of producing a file Calendar cannot import', () => {
		assert.throws(
			() =>
				formatIcalendar(
					{ events: [{ ...event, end: event.start }] },
					{ calendarName: 'BKalendar', generatedAt: new Date(), recurrenceMode: 'expanded' }
				),
			/kết thúc|end/iu
		);
	});
});
