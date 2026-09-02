export type HourMinute = [hour: number, minute: number];

export type Timerow = {
	name: string;
	weekday: number;
	/** Local wall-clock time in Vietnam (UTC+07:00). */
	startHm: HourMinute;
	/** Local wall-clock time in Vietnam (UTC+07:00). */
	endHm: HourMinute;
	weeks: Array<number | null>;
	location: string;
	extras: Record<string, string>;
};

export type Timetable = {
	/** Academic semester encoded as YYT, for example 261. */
	semester: number;
	rows: Timerow[];
	sourceUpdatedAt?: string;
	startMondayUTC?: Date;
};

export type ResolvedTimetable = Omit<Timetable, 'startMondayUTC'> & {
	startMondayUTC: Date;
};
