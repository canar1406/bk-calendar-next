import { ParseError } from './errors.ts';
import type { HourMinute } from '../timetable.ts';

export function parseTime(source: string): HourMinute {
	const match = /^(\d{1,2}):(\d{2})$/.exec(source.trim());
	if (match === null) {
		throw new ParseError(source, 'Expected a time in H:mm format');
	}

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour > 23 || minute > 59) {
		throw new ParseError(source, 'Time is outside the valid range');
	}

	return [hour, minute];
}
