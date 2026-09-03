import {
	createSnapshot,
	type CaptureCompleteness,
	type ManagedEvent,
	type SourceKind,
	type TimetableSnapshot
} from '../../timetable/src/index.ts';
import type { ResolvedTimetable, Timerow } from './timetable.ts';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;
const VIETNAM_OFFSET_HOURS = 7;

export interface SnapshotOptions {
	sourceKind: SourceKind;
	capturedAt?: string;
	completeness?: CaptureCompleteness;
	provenance?: 'user' | 'sample';
}

export async function toTimetableSnapshot(
	timetable: ResolvedTimetable,
	options: SnapshotOptions
): Promise<TimetableSnapshot> {
	const warnings: string[] = [];
	const drafts: Array<{
		anchor: string;
		event: Omit<ManagedEvent, 'stableKey' | 'fingerprint'>;
	}> = [];

	for (const row of timetable.rows) {
		const activeIndexes = row.weeks.flatMap((week, index) => (week === null ? [] : [index]));
		if (!isScheduled(row) || activeIndexes.length === 0) {
			warnings.push(`${row.name}: thiếu thứ, giờ hoặc tuần học nên chưa được đưa vào lịch.`);
			continue;
		}

		const firstIndex = activeIndexes[0]!;
		const activeWeekIndexes = activeIndexes.map((index) => index - firstIndex);
		const anchor = [
			options.sourceKind,
			timetable.semester,
			row.extras.courseCode ?? row.name,
			row.extras.group ?? row.extras.classCode ?? '',
			row.weekday
		].join('|');
		const start = eventDate(timetable.startMondayUTC, firstIndex, row.weekday, row.startHm);
		let end = eventDate(timetable.startMondayUTC, firstIndex, row.weekday, row.endHm);
		if (+end <= +start) end = new Date(+end + DAY_MS);
		const excludedStarts: string[] = [];
		for (let index = 0; index <= activeWeekIndexes.at(-1)!; index++) {
			if (!activeWeekIndexes.includes(index))
				excludedStarts.push(new Date(+start + index * WEEK_MS).toISOString());
		}

		drafts.push({
			anchor,
			event: {
				sourceKind: options.sourceKind,
				semester: timetable.semester,
				courseCode: row.extras.courseCode ?? row.name,
				group: row.extras.group ?? row.extras.classCode ?? '',
				sessionOrdinal: 0,
				weekday: row.weekday,
				title: row.name,
				location: row.location,
				start: start.toISOString(),
				end: end.toISOString(),
				timeZone: 'Asia/Ho_Chi_Minh',
				activeWeekIndexes,
				excludedStarts,
				metadata: { ...row.extras }
			}
		});
	}

	const events = assignSessionOrdinals(drafts);
	return await createSnapshot({
		sourceKind: options.sourceKind,
		semester: timetable.semester,
		capturedAt: options.capturedAt ?? new Date().toISOString(),
		...(options.provenance ? { provenance: options.provenance } : {}),
		...(timetable.sourceUpdatedAt ? { sourceUpdatedAt: timetable.sourceUpdatedAt } : {}),
		warnings,
		...(options.completeness ? { completeness: options.completeness } : {}),
		events
	});
}

function assignSessionOrdinals(
	drafts: Array<{
		anchor: string;
		event: Omit<ManagedEvent, 'stableKey' | 'fingerprint'>;
	}>
): Array<Omit<ManagedEvent, 'stableKey' | 'fingerprint'>> {
	const groups = new Map<string, typeof drafts>();
	for (const draft of drafts) {
		const group = groups.get(draft.anchor) ?? [];
		group.push(draft);
		groups.set(draft.anchor, group);
	}

	const events: Array<Omit<ManagedEvent, 'stableKey' | 'fingerprint'>> = [];
	for (const group of groups.values()) {
		group.sort((left, right) =>
			sessionOrderKey(left.event).localeCompare(sessionOrderKey(right.event))
		);
		group.forEach((draft, sessionOrdinal) => {
			events.push({ ...draft.event, sessionOrdinal });
		});
	}
	return events;
}

function sessionOrderKey(event: Omit<ManagedEvent, 'stableKey' | 'fingerprint'>): string {
	return JSON.stringify({
		start: event.start,
		end: event.end,
		location: event.location.normalize('NFKC'),
		title: event.title.normalize('NFKC'),
		activeWeekIndexes: event.activeWeekIndexes,
		excludedStarts: event.excludedStarts,
		metadata: Object.fromEntries(
			Object.entries(event.metadata).sort(([left], [right]) => left.localeCompare(right))
		)
	});
}

function isScheduled(row: Timerow): boolean {
	return (
		Number.isInteger(row.weekday) &&
		row.weekday >= 2 &&
		row.weekday <= 8 &&
		validHourMinute(row.startHm) &&
		validHourMinute(row.endHm)
	);
}

function validHourMinute([hour, minute]: [number, number]): boolean {
	return (
		Number.isInteger(hour) &&
		hour >= 0 &&
		hour <= 23 &&
		Number.isInteger(minute) &&
		minute >= 0 &&
		minute <= 59
	);
}

function eventDate(
	startMondayUTC: Date,
	weekIndex: number,
	weekday: number,
	[hour, minute]: [number, number]
): Date {
	return new Date(
		+startMondayUTC +
			weekIndex * WEEK_MS +
			(weekday - 2) * DAY_MS +
			(hour - VIETNAM_OFFSET_HOURS) * HOUR_MS +
			minute * MINUTE_MS
	);
}
