import type { ManagedEvent } from '../../../../packages/timetable/src/index.ts';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const CALENDAR_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export interface ScheduleWeek {
	key: string;
	isoWeek: number;
	label: string;
	events: ManagedEvent[];
}

export function buildScheduleWeeks(events: ManagedEvent[]): ScheduleWeek[] {
	const groups = new Map<string, ManagedEvent[]>();

	for (const event of events) {
		const start = Date.parse(event.start);
		const end = Date.parse(event.end);
		for (const weekIndex of event.activeWeekIndexes) {
			const occurrenceStart = start + weekIndex * WEEK_MS;
			const occurrenceEnd = end + weekIndex * WEEK_MS;
			const mondayKey = mondayKeyForOccurrence(
				new Date(occurrenceStart),
				event.weekday,
				event.timeZone
			);
			const weekEvents = groups.get(mondayKey) ?? [];
			weekEvents.push({
				...event,
				start: new Date(occurrenceStart).toISOString(),
				end: new Date(occurrenceEnd).toISOString()
			});
			groups.set(mondayKey, weekEvents);
		}
	}

	return [...groups.entries()]
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, weekEvents]) => ({
			key,
			isoWeek: isoWeekNumber(key),
			label: weekLabel(key),
			events: weekEvents.sort(
				(left, right) => left.weekday - right.weekday || left.start.localeCompare(right.start)
			)
		}));
}

export function selectDefaultScheduleWeek(
	weeks: ScheduleWeek[],
	now: Date = new Date()
): ScheduleWeek | undefined {
	const currentKey = mondayKeyForDate(now, CALENDAR_TIME_ZONE);
	return weeks.find((week) => week.key === currentKey) ?? weeks[0];
}

function mondayKeyForOccurrence(date: Date, weekday: number, timeZone: string): string {
	const localDate = zonedDateParts(date, timeZone);
	const monday =
		Date.UTC(localDate.year, localDate.month - 1, localDate.day) - (weekday - 2) * DAY_MS;
	return new Date(monday).toISOString().slice(0, 10);
}

function mondayKeyForDate(date: Date, timeZone: string): string {
	const localDate = zonedDateParts(date, timeZone);
	const localDateUtc = Date.UTC(localDate.year, localDate.month - 1, localDate.day);
	const day = new Date(localDateUtc).getUTCDay();
	const monday = localDateUtc - ((day + 6) % 7) * DAY_MS;
	return new Date(monday).toISOString().slice(0, 10);
}

function zonedDateParts(
	date: Date,
	timeZone: string
): { year: number; month: number; day: number } {
	const parts = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value);
	return { year: value('year'), month: value('month'), day: value('day') };
}

function isoWeekNumber(mondayKey: string): number {
	const date = new Date(`${mondayKey}T00:00:00.000Z`);
	const thursday = new Date(date);
	thursday.setUTCDate(date.getUTCDate() + 3);
	const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
	return Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7);
}

function weekLabel(mondayKey: string): string {
	const monday = new Date(`${mondayKey}T00:00:00.000Z`);
	const sunday = new Date(monday.getTime() + 6 * DAY_MS);
	const formatter = new Intl.DateTimeFormat('vi-VN', {
		timeZone: 'UTC',
		day: '2-digit',
		month: '2-digit'
	});
	return `Tuần ${isoWeekNumber(mondayKey)} · ${formatter.format(monday)}–${formatter.format(sunday)}`;
}
