import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ManagedEvent } from '../../../packages/timetable/src/index.ts';
import {
	COURSE_COLOR_PALETTES,
	COURSE_ICONS,
	GOOGLE_EVENT_COLORS,
	buildCourseColorAssignments,
	colorizeEventsForSync,
	createCourseColorStore,
	defaultCourseColorPreferences,
	randomizeCourseColors,
	summarizeCourseAppearances,
	type CourseColorPreferences
} from '../src/lib/course-colors.ts';

function event(courseCode: string, sessionOrdinal = 0): ManagedEvent {
	return {
		stableKey: `${courseCode}-${sessionOrdinal}`,
		fingerprint: `fingerprint-${courseCode}-${sessionOrdinal}`,
		sourceKind: 'student-2024',
		semester: 261,
		courseCode,
		group: 'L01',
		sessionOrdinal,
		weekday: 2 + sessionOrdinal,
		title: courseCode,
		location: 'H1',
		start: '2026-08-31T00:00:00.000Z',
		end: '2026-08-31T01:00:00.000Z',
		timeZone: 'Asia/Ho_Chi_Minh',
		activeWeekIndexes: [0],
		excludedStarts: [],
		metadata: {}
	};
}

describe('course color preferences', () => {
	it('offers several curated palettes using only official Google event colors', () => {
		assert.ok(COURSE_COLOR_PALETTES.length >= 8);
		const officialIds = new Set(GOOGLE_EVENT_COLORS.map((color) => color.id));
		for (const palette of COURSE_COLOR_PALETTES) {
			assert.equal(palette.colorIds.length, GOOGLE_EVENT_COLORS.length);
			assert.ok(palette.colorIds.every((colorId) => officialIds.has(colorId)));
		}
	});

	it('offers a broad preset icon library', () => {
		assert.ok(COURSE_ICONS.length >= 120);
		assert.ok(new Set(COURSE_ICONS.map((icon) => icon.category)).size >= 14);
		assert.equal(new Set(COURSE_ICONS.map((icon) => icon.value)).size, COURSE_ICONS.length);
	});

	it('assigns one stable Google color to every session of the same course', () => {
		const assignments = buildCourseColorAssignments(
			[event('MT1003'), event('MT1003', 1), event('PH1003')],
			defaultCourseColorPreferences()
		);

		assert.equal(assignments.MT1003, assignments.MT1003);
		assert.notEqual(assignments.MT1003, assignments.PH1003);
	});

	it('changes the generated palette when the user rerolls it', () => {
		const events = [event('MT1003'), event('PH1003'), event('LA1003')];
		const first = buildCourseColorAssignments(events, {
			...defaultCourseColorPreferences(),
			seed: 0
		});
		const second = buildCourseColorAssignments(events, {
			...defaultCourseColorPreferences(),
			seed: 1
		});

		assert.notDeepEqual(first, second);
	});

	it('creates a true random per-course override while keeping every session stable', () => {
		const preferences = randomizeCourseColors(
			[event('MT1003'), event('MT1003', 1), event('PH1003'), event('LA1003')],
			defaultCourseColorPreferences(),
			() => 0
		);

		assert.equal(preferences.mode, 'course');
		assert.deepEqual(Object.keys(preferences.overrides).sort(), ['LA1003', 'MT1003', 'PH1003']);
		assert.equal(new Set(Object.values(preferences.overrides)).size, 3);
		assert.ok(
			Object.values(preferences.overrides).every((colorId) =>
				GOOGLE_EVENT_COLORS.some((color) => color.id === colorId)
			)
		);
	});

	it('honors individual course colors and monochrome mode', () => {
		const events = [event('MT1003'), event('PH1003')];
		const custom = buildCourseColorAssignments(events, {
			...defaultCourseColorPreferences(),
			overrides: { MT1003: '11' }
		});
		const mono = buildCourseColorAssignments(events, {
			...defaultCourseColorPreferences(),
			mode: 'mono',
			monoColorId: '7'
		});

		assert.equal(custom.MT1003, '11');
		assert.deepEqual(mono, { MT1003: '7', PH1003: '7' });
	});

	it('describes the actual color and icon synchronized for each course', () => {
		const summaries = summarizeCourseAppearances(
			[
				{ ...event('MT1003'), title: 'Giải tích 1' },
				{ ...event('MT1003', 1), title: 'Giải tích 1' },
				{ ...event('PH1003'), title: 'Vật lý 1' }
			],
			{
				...defaultCourseColorPreferences(),
				overrides: { MT1003: '5', PH1003: '7' },
				icons: { MT1003: '🧮', PH1003: '⚛️' }
			}
		);

		assert.deepEqual(
			summaries.map(({ courseCode, title, colorId, colorName, background, icon }) => ({
				courseCode,
				title,
				colorId,
				colorName,
				background,
				icon
			})),
			[
				{
					courseCode: 'MT1003',
					title: 'Giải tích 1',
					colorId: '5',
					colorName: 'Vàng',
					background: '#f6bf26',
					icon: '🧮'
				},
				{
					courseCode: 'PH1003',
					title: 'Vật lý 1',
					colorId: '7',
					colorName: 'Xanh trời',
					background: '#039be5',
					icon: '⚛️'
				}
			]
		);
	});

	it('includes the chosen color in the sync fingerprint without mutating source events', () => {
		const source = [event('MT1003')];
		const colored = colorizeEventsForSync(source, { MT1003: '5' }, { MT1003: '🧮' });

		assert.equal(source[0]?.fingerprint, 'fingerprint-MT1003-0');
		assert.equal(source[0]?.title, 'MT1003');
		assert.equal(colored[0]?.title, 'MT1003');
		assert.equal(colored[0]?.icon, '🧮');
		assert.equal(colored[0]?.colorId, '5');
		assert.equal(colored[0]?.fingerprint, 'fingerprint-MT1003-0:color:5:icon:🧮');
	});

	it('accepts a custom single emoji outside the preset icon library', () => {
		const colored = colorizeEventsForSync([event('MT1003')], { MT1003: '5' }, { MT1003: '🛰️' });
		assert.equal(colored[0]?.title, 'MT1003');
		assert.equal(colored[0]?.icon, '🛰️');
	});

	it('persists preferences per timetable profile and rejects malformed stored data', () => {
		const values = new Map<string, string>();
		const storage = {
			getItem(key: string) {
				return values.get(key) ?? null;
			},
			setItem(key: string, value: string) {
				values.set(key, value);
			}
		};
		const store = createCourseColorStore(storage);
		const preference: CourseColorPreferences = {
			schemaVersion: 1,
			mode: 'course',
			seed: 4,
			monoColorId: '7',
			overrides: { MT1003: '9' },
			icons: { MT1003: '🧮' }
		};

		store.save('student-2024:261', preference);
		assert.deepEqual(store.load('student-2024:261'), preference);

		values.set('bkalendar-next:course-colors:broken', '{"mode":"rainbow"}');
		assert.deepEqual(store.load('broken'), defaultCourseColorPreferences());
	});
});
