import type { Timerow, Timetable } from '../timetable.ts';
import {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError
} from './errors.ts';
import { parseTime } from './utils.ts';

const HEADER = 'lớp\ttên mh\tphòng\tdãy\tthứ\tsố tiết\ttiết\tgiờ\ttuần học\t% nd';
const COLUMN_COUNT = HEADER.split('\t').length;

type LecturerColumns = [
	classCode: string,
	name: string,
	location: string,
	building: string,
	weekday: string,
	periodCount: string,
	periods: string,
	time: string,
	weeks: string,
	contentPercentage: string
];

/** Parse a timetable copied from the legacy MyBK lecturer page. */
export function parseLecturer(source: string): Timetable {
	const normalizedSource = source.replace(/^﻿/, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	const lines = normalizedSource.trim().split('\n');
	const headerIndex = lines.findIndex(
		(line) => normalizeLabel(line.trim()) === normalizeLabel(HEADER)
	);

	if (headerIndex < 0) {
		throw new TableNotFoundError(source);
	}

	const semester = parseSemester(lines.slice(0, headerIndex));
	const rows: Timerow[] = [];

	for (let index = headerIndex + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		if (line.trim() === '') continue;
		if (normalizeLabel(line.trim()).startsWith(normalizeLabel('Đang xem'))) break;

		const columns = line.split('\t');
		if (columns.length !== COLUMN_COUNT) {
			throw new ColumnCountError(line, COLUMN_COUNT, columns.length);
		}

		rows.push(parseRow(columns as LecturerColumns));
	}

	return { semester, rows };
}

function normalizeLabel(value: string): string {
	return value.normalize('NFD').toLocaleLowerCase('vi-VN');
}

function parseSemester(lines: string[]): number {
	const preamble = lines.join('\n');
	const yearMatch = /Năm học\s+(\d{4})(?:\s*-\s*\d{4})?/iu.exec(preamble);
	const termMatch = /Học kỳ\s+([123])/iu.exec(preamble);

	if (yearMatch === null || termMatch === null) {
		throw new SemesterNotFoundError(preamble);
	}

	return (Number(yearMatch[1]) % 100) * 10 + Number(termMatch[1]);
}

function parseRow(columns: LecturerColumns): Timerow {
	const [classCode, name, location, , weekdaySource, , , timeSource, weeksSource] = columns;
	const weekday =
		weekdaySource.trim().toLocaleUpperCase('vi-VN') === 'CN' ? 8 : Number(weekdaySource);
	if (!Number.isInteger(weekday) || weekday < 2 || weekday > 8) {
		throw new ParseError(weekdaySource, 'Weekday must be 2-7 or CN');
	}

	const times = timeSource.split(/\s+-\s+/u);
	if (times.length !== 2 || times[0] === undefined || times[1] === undefined) {
		throw new ParseError(timeSource, 'Expected a time range separated by " - "');
	}

	return {
		name,
		weekday,
		startHm: parseTime(times[0]),
		endHm: parseTime(times[1]),
		weeks: parseWeeks(weeksSource),
		location,
		extras: parseClassIdentity(classCode)
	};
}

function parseClassIdentity(classCode: string): Record<string, string> {
	const match = /^\d{4,5}_([^_]+)_(.+)$/u.exec(classCode.trim());
	if (match === null) {
		return { classCode, courseCode: classCode, group: '' };
	}

	return {
		classCode,
		courseCode: match[1] ?? classCode,
		group: match[2] ?? ''
	};
}

function parseWeeks(source: string): Array<number | null> {
	const components = source.trim().split('|');
	if (components.at(-1) === '') components.pop();
	if (components.length === 0) {
		throw new ParseError(source, 'Week list is empty');
	}

	return components.map((component) => {
		const value = component.trim();
		if (value === '--') return null;

		const week = Number(value);
		if (!/^\d{1,2}$/u.test(value) || !Number.isInteger(week) || week < 1 || week > 53) {
			throw new ParseError(component, 'Week must be 1-53 or --');
		}
		return week;
	});
}
