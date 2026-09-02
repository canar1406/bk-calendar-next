import type { ResolvedTimetable, Timetable, Timerow } from './timetable.ts';

const DAY_MS = 24 * 60 * 60 * 1_000;
const WEEK_MS = 7 * DAY_MS;

export class InvalidSemesterError extends Error {
	readonly semester: number;

	constructor(semester: number) {
		super(`Invalid semester ${String(semester)}: expected YYT with term 1, 2, or 3`);
		this.name = new.target.name;
		this.semester = semester;
	}
}

export class UnresolvedTimetableError extends Error {
	constructor() {
		super('Timetable cannot be resolved because no row contains a usable week');
		this.name = new.target.name;
	}
}

export class MixedSemesterError extends Error {
	readonly firstStartMondayUTC: Date;
	readonly secondStartMondayUTC: Date;

	constructor(firstStartMondayUTC: Date, secondStartMondayUTC: Date) {
		super(
			`Semester ambiguity: rows imply both ${firstStartMondayUTC.toISOString()} and ${secondStartMondayUTC.toISOString()}`
		);
		this.name = new.target.name;
		this.firstStartMondayUTC = firstStartMondayUTC;
		this.secondStartMondayUTC = secondStartMondayUTC;
	}
}

/**
 * Resolve the calendar date represented by week-array index zero.
 *
 * Resolution is transactional: this function calculates and validates every
 * candidate before returning a new object, and never writes to `timetable`.
 */
export function resolveTimetable(timetable: Timetable): ResolvedTimetable {
	const { academicYear, term } = decodeSemester(timetable.semester);

	if (timetable.startMondayUTC !== undefined) {
		return {
			...timetable,
			startMondayUTC: new Date(timetable.startMondayUTC.getTime())
		};
	}

	const candidates: Date[] = [];
	for (const row of timetable.rows) {
		const candidate = inferStartMondayUTC(row, academicYear, term);
		if (candidate !== undefined) candidates.push(candidate);
	}

	const first = candidates[0];
	if (first === undefined) {
		throw new UnresolvedTimetableError();
	}

	for (let index = 1; index < candidates.length; index += 1) {
		const candidate = candidates[index];
		if (candidate !== undefined && candidate.getTime() !== first.getTime()) {
			throw new MixedSemesterError(new Date(first.getTime()), new Date(candidate.getTime()));
		}
	}

	return {
		...timetable,
		startMondayUTC: new Date(first.getTime())
	};
}

function decodeSemester(semester: number): { academicYear: number; term: 1 | 2 | 3 } {
	if (!Number.isInteger(semester) || semester < 100 || semester > 999) {
		throw new InvalidSemesterError(semester);
	}

	const term = semester % 10;
	if (term !== 1 && term !== 2 && term !== 3) {
		throw new InvalidSemesterError(semester);
	}

	return { academicYear: 2000 + Math.trunc(semester / 10), term };
}

function inferStartMondayUTC(
	row: Timerow,
	academicYear: number,
	term: 1 | 2 | 3
): Date | undefined {
	if (!Number.isInteger(row.weekday) || row.weekday < 2 || row.weekday > 8) {
		return undefined;
	}

	let weekAtIndexZero: number | undefined;
	let indexOfWeekOne: number | undefined;

	for (let index = 0; index < row.weeks.length; index += 1) {
		const week = row.weeks[index];
		if (week === undefined || week === null || !Number.isInteger(week) || week < 1 || week > 53)
			continue;

		// Once a row crosses New Year, week N at index I means week 1 is
		// located at I - N + 1. That rollover is the strongest year signal.
		if (week - index <= 0) {
			indexOfWeekOne = index - week + 1;
			break;
		}

		weekAtIndexZero ??= week - index;
	}

	if (indexOfWeekOne !== undefined) {
		const weekOne = isoWeekMondayUTC(academicYear + 1, 1);
		return new Date(weekOne.getTime() - indexOfWeekOne * WEEK_MS);
	}

	if (weekAtIndexZero === undefined) {
		return undefined;
	}

	const isoYear =
		term === 1
			? academicYear
			: term === 2 && weekAtIndexZero >= 26
				? academicYear
				: academicYear + 1;
	return isoWeekMondayUTC(isoYear, weekAtIndexZero);
}

function isoWeekMondayUTC(year: number, week: number): Date {
	const januaryFourth = Date.UTC(year, 0, 4);
	const utcDay = new Date(januaryFourth).getUTCDay();
	const daysSinceMonday = (utcDay + 6) % 7;
	return new Date(januaryFourth - daysSinceMonday * DAY_MS + (week - 1) * WEEK_MS);
}
