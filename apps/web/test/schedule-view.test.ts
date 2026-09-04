import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { createStudent2024Snapshot } from '../../../packages/core/src/index.ts';
import { buildScheduleWeeks, selectDefaultScheduleWeek } from '../src/lib/schedule-view.ts';

describe('semester schedule week view', () => {
	it('exposes an accessible weekly preview for the semester schedule', async () => {
		const component = await readFile(
			new URL('../src/lib/components/ScheduleBoard.svelte', import.meta.url),
			'utf8'
		);

		assert.match(component, /Lịch học cả học kỳ/);
		assert.match(component, /Xem trước theo từng tuần/);
		assert.match(component, /<details[^>]+class="week-picker"/);
		assert.match(component, /<summary[^>]+aria-label="Chọn tuần hiển thị"/);
		assert.match(component, /role="listbox"/);
		assert.match(component, /role="option"/);
		assert.match(component, /aria-selected=/);
		assert.doesNotMatch(component, /<select[^>]+id="schedule-week"/);
		assert.match(component, /aria-label="Xem tuần trước"/);
		assert.match(component, /aria-label="Xem tuần sau"/);
		assert.doesNotMatch(component, /var\(--navy\)/);
		assert.doesNotMatch(
			component,
			/\.week-navigation button,[\s\S]*?\.week-picker select[\s\S]*?background:\s*white/
		);
		assert.match(component, /\.week-menu-panel[\s\S]*background:\s*var\(--surface-raised\)/);
		assert.match(component, /\.week-menu-option\[aria-selected='true'\]/);
	});

	it('shows only active occurrences in each selected week', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-student-20261-week36.txt', import.meta.url),
			'utf8'
		);
		const snapshot = await createStudent2024Snapshot(source, {
			capturedAt: '2026-09-03T08:03:21.000Z',
			completeness: { state: 'complete', parsedRows: 9, expectedRows: 9 }
		});
		const weeks = buildScheduleWeeks(snapshot.events);
		const week35 = weeks.find((week) => week.isoWeek === 35);
		const week36 = weeks.find((week) => week.isoWeek === 36);
		const week37 = weeks.find((week) => week.isoWeek === 37);

		assert.deepEqual(week36?.events.map((event) => event.courseCode).sort(), ['AS1002', 'PE1013']);
		assert.equal(
			week35?.events.some((event) => event.courseCode === 'MT1003'),
			true
		);
		assert.equal(
			week35?.events.some((event) => event.courseCode === 'AS1002'),
			false
		);
		assert.equal(week37?.events.length, 8);
	});

	it('defaults to the current week when it exists in the semester', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-student-20261-week36.txt', import.meta.url),
			'utf8'
		);
		const snapshot = await createStudent2024Snapshot(source, {
			capturedAt: '2026-09-03T08:03:21.000Z'
		});
		const weeks = buildScheduleWeeks(snapshot.events);

		assert.equal(
			selectDefaultScheduleWeek(weeks, new Date('2026-09-03T12:00:00+07:00'))?.isoWeek,
			36
		);
	});

	it('uses the first semester week when today is outside the timetable range', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-student-20261-week36.txt', import.meta.url),
			'utf8'
		);
		const snapshot = await createStudent2024Snapshot(source, {
			capturedAt: '2026-09-03T08:03:21.000Z'
		});
		const weeks = buildScheduleWeeks(snapshot.events);

		assert.equal(
			selectDefaultScheduleWeek(weeks, new Date('2030-01-01T00:00:00.000Z'))?.isoWeek,
			35
		);
	});
});
