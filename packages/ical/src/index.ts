const CALENDAR_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const UTF8_ENCODER = new TextEncoder();
const WEEK_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1_000;

interface CalendarEvent {
	readonly stableKey: string;
	readonly title: string;
	readonly icon?: string;
	readonly location: string;
	readonly start: string;
	readonly end: string;
	readonly timeZone: string;
	readonly activeWeekIndexes: readonly number[];
	readonly excludedStarts: readonly string[];
	readonly metadata: Readonly<Record<string, unknown>>;
}

interface CalendarSnapshot {
	readonly events: readonly CalendarEvent[];
}

export interface IcalendarFormatOptions {
	readonly calendarName: string;
	readonly generatedAt: Date;
}

/** Format a timetable snapshot as an RFC 5545 iCalendar document. */
export function formatIcalendar(
	snapshot: CalendarSnapshot,
	options: IcalendarFormatOptions
): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'PRODID:-//BKalendar//Timetable//EN',
		'VERSION:2.0',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(options.calendarName)}`,
		`X-WR-TIMEZONE:${CALENDAR_TIME_ZONE}`,
		...timeZoneLines(),
		...snapshot.events.flatMap((event) => eventLines(event, options.generatedAt)),
		'END:VCALENDAR'
	];

	return `${lines.flatMap(foldLine).join('\r\n')}\r\n`;
}

function eventLines(event: CalendarEvent, generatedAt: Date): string[] {
	const lines = [
		'BEGIN:VEVENT',
		`UID:${escapeText(`${event.stableKey}@bkalendar-next`)}`,
		`DTSTAMP:${formatUtcDateTime(generatedAt)}`,
		`DTSTART;TZID=${event.timeZone}:${formatZonedDateTime(event.start, event.timeZone)}`,
		`DTEND;TZID=${event.timeZone}:${formatZonedDateTime(event.end, event.timeZone)}`,
		...recurrenceLines(event),
		`SUMMARY:${escapeText(event.icon ? `${event.icon} ${event.title}` : event.title)}`,
		`LOCATION:${escapeText(event.location)}`
	];
	const description = formatMetadata(event.metadata);
	if (description !== '') lines.push(`DESCRIPTION:${escapeText(description)}`);
	lines.push('END:VEVENT');
	return lines;
}

function timeZoneLines(): string[] {
	return [
		'BEGIN:VTIMEZONE',
		`TZID:${CALENDAR_TIME_ZONE}`,
		`X-LIC-LOCATION:${CALENDAR_TIME_ZONE}`,
		'BEGIN:STANDARD',
		'DTSTART:19700101T000000',
		'TZOFFSETFROM:+0700',
		'TZOFFSETTO:+0700',
		'TZNAME:ICT',
		'END:STANDARD',
		'END:VTIMEZONE'
	];
}

function recurrenceLines(event: CalendarEvent): string[] {
	const activeWeeks = [...new Set(event.activeWeekIndexes)]
		.filter((week) => Number.isSafeInteger(week) && week >= 0)
		.sort((left, right) => left - right);
	const lastWeek = activeWeeks.at(-1);
	if (lastWeek === undefined || lastWeek === 0) return [];

	const startTime = parseDate(event.start).getTime();
	const lines = [
		`RRULE:FREQ=WEEKLY;UNTIL=${formatUtcDateTime(new Date(startTime + lastWeek * WEEK_IN_MILLISECONDS))}`
	];
	const activeWeekSet = new Set(activeWeeks);
	const excludedTimes = new Set<number>();

	for (let week = 0; week <= lastWeek; week += 1) {
		if (!activeWeekSet.has(week)) excludedTimes.add(startTime + week * WEEK_IN_MILLISECONDS);
	}
	for (const excludedStart of event.excludedStarts) {
		excludedTimes.add(parseDate(excludedStart).getTime());
	}

	const exclusions = [...excludedTimes]
		.sort((left, right) => left - right)
		.map((time) => formatZonedDateTime(new Date(time), event.timeZone));
	if (exclusions.length > 0) {
		lines.push(`EXDATE;TZID=${event.timeZone}:${exclusions.join(',')}`);
	}
	return lines;
}

function formatMetadata(metadata: Readonly<Record<string, unknown>>): string {
	const entries = Object.entries(metadata).filter(
		(entry): entry is [string, string] => typeof entry[1] === 'string'
	);
	entries.sort(([left], [right]) => {
		if (left === 'note') return -1;
		if (right === 'note') return 1;
		return left.localeCompare(right);
	});
	return entries.map(([key, value]) => `${key}: ${value}`).join('\n');
}

function escapeText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/\r\n|\r|\n/g, '\\n')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,');
}

function formatUtcDateTime(value: Date): string {
	const date = parseDate(value);
	return [
		pad(date.getUTCFullYear(), 4),
		pad(date.getUTCMonth() + 1),
		pad(date.getUTCDate()),
		'T',
		pad(date.getUTCHours()),
		pad(date.getUTCMinutes()),
		pad(date.getUTCSeconds()),
		'Z'
	].join('');
}

function formatZonedDateTime(value: string | Date, timeZone: string): string {
	const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(parseDate(value));
	const part = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((candidate) => candidate.type === type)?.value ?? '';
	return `${part('year')}${part('month')}${part('day')}T${part('hour')}${part('minute')}${part('second')}`;
}

function parseDate(value: string | Date): Date {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid calendar date: ${String(value)}`);
	return date;
}

function pad(value: number, length = 2): string {
	return String(value).padStart(length, '0');
}

function foldLine(line: string): string[] {
	const physicalLines: string[] = [];
	let content = '';
	let contentOctets = 0;
	let capacity = 75;
	let prefix = '';

	for (const character of line) {
		const characterOctets = UTF8_ENCODER.encode(character).length;
		if (contentOctets + characterOctets > capacity) {
			physicalLines.push(`${prefix}${content}`);
			prefix = ' ';
			capacity = 74;
			content = '';
			contentOctets = 0;
		}
		content += character;
		contentOctets += characterOctets;
	}
	physicalLines.push(`${prefix}${content}`);
	return physicalLines;
}
