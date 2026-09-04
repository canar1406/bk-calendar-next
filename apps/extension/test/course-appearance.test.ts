import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ManagedEvent } from '../../../packages/timetable/src/index.ts';
import { prepareEventsWithCourseAppearance } from '../src/shared/course-appearance.ts';

const event: ManagedEvent = {
	stableKey: 'bk2_event',
	fingerprint: 'source-fingerprint',
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

describe('extension course appearance settings', () => {
	it('applies a web-saved course color and icon before automatic Google sync', () => {
		const prepared = prepareEventsWithCourseAppearance([event], {
			schemaVersion: 1,
			mode: 'course',
			seed: 0,
			monoColorId: '7',
			overrides: { MT1003: '5' },
			icons: { MT1003: '🧮' }
		});

		assert.equal(prepared[0]?.colorId, '5');
		assert.equal(prepared[0]?.icon, '🧮');
		assert.equal(prepared[0]?.sourceFingerprint, 'source-fingerprint');
		assert.equal(prepared[0]?.fingerprint, 'source-fingerprint:color:5:icon:🧮');
	});

	it('leaves events untouched when no valid web setting has been stored', () => {
		assert.deepEqual(prepareEventsWithCourseAppearance([event], undefined), [event]);
		assert.deepEqual(
			prepareEventsWithCourseAppearance([event], {
				schemaVersion: 1,
				mode: 'rainbow'
			}),
			[event]
		);
	});
});
