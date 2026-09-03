import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { createStudent2024Snapshot } from '../../../packages/core/src/index.ts';
import { toGoogleEventResource } from '../../../packages/google-calendar/src/index.ts';

const WEEK_MS = 7 * 86_400_000;
const WEEK_36_START = Date.parse('2026-08-31T00:00:00.000Z');
const WEEK_37_START = Date.parse('2026-09-07T00:00:00.000Z');

describe('real MyBK 20261 week 36 regression', () => {
	it('includes only the two rows that explicitly contain week 36', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-student-20261-week36.txt', import.meta.url),
			'utf8'
		);
		const snapshot = await createStudent2024Snapshot(source, {
			capturedAt: '2026-09-03T08:03:21.000Z',
			completeness: { state: 'complete', parsedRows: 9, expectedRows: 9 },
			provenance: 'user'
		});
		const week36 = snapshot.events
			.filter((event) =>
				event.activeWeekIndexes.some((index) => {
					const occurrence = Date.parse(event.start) + index * WEEK_MS;
					return occurrence >= WEEK_36_START && occurrence < WEEK_37_START;
				})
			)
			.map((event) => `${event.courseCode}:${event.location}`)
			.sort();

		assert.equal(snapshot.events.length, 8);
		assert.deepEqual(week36, ['AS1002:H3-502', 'PE1013:CS2-NHATHIDAU-SAN1']);
		assert.equal(
			snapshot.events.some((event) => event.courseCode === 'CO1027'),
			false
		);
	});

	it('emits Google EXDATE values for week 36 classes that contain --', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-student-20261-week36.txt', import.meta.url),
			'utf8'
		);
		const snapshot = await createStudent2024Snapshot(source, {
			capturedAt: '2026-09-03T08:03:21.000Z'
		});
		const calculus = snapshot.events.find(
			(event) => event.courseCode === 'MT1003' && event.weekday === 2
		);
		const physics = snapshot.events.find((event) => event.courseCode === 'PH1003');

		assert.ok(
			toGoogleEventResource(calculus!).recurrence?.includes(
				'EXDATE;TZID=Asia/Ho_Chi_Minh:20260831T070000,20261012T070000'
			)
		);
		assert.ok(
			toGoogleEventResource(physics!).recurrence?.includes(
				'EXDATE;TZID=Asia/Ho_Chi_Minh:20260901T120000,20261013T120000'
			)
		);
	});
});
