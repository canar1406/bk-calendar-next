import type { HourMinute, Timerow, Timetable } from '../timetable.ts';
import {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError
} from './errors.ts';
import { parseTime } from './utils.ts';

const HEADER =
	'mã mh\ttên môn học\ttín chỉ\ttc học phí\tnhóm-tổ\tthứ\ttiết\tgiờ học\tphòng\tcơ sở\ttuần học';
const COLUMN_COUNT = HEADER.split('\t').length;

type LegacyStudentColumns = [
	courseCode: string,
	name: string,
	credits: string,
	tuitionCredits: string,
	group: string,
	weekday: string,
	periods: string,
	time: string,
	location: string,
	campus: string,
	weeks: string
];

/** Parse a timetable copied from the pre-2024 MyBK student page. */
export function parseStudent(source: string): Timetable {
	const normalizedSource = source.replace(/^﻿/, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	const lines = normalizedSource.trim().split('\n');
	const headerIndex = lines.findIndex((line) => line.trim().toLocaleLowerCase('vi-VN') === HEADER);

	if (headerIndex < 0) {
		throw new TableNotFoundError(source);
	}

	const semester = parseSemester(lines[headerIndex - 2] ?? '');
	const rows: Timerow[] = [];

	for (let index = headerIndex + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		if (line.startsWith('Tổng số tín chỉ đăng ký:')) break;

		const columns = line.split('\t');
		if (columns.length !== COLUMN_COUNT) {
			throw new ColumnCountError(line, COLUMN_COUNT, columns.length);
		}

		rows.push(parseRow(columns as LegacyStudentColumns));
	}

	return { semester, rows };
}

function parseSemester(source: string): number {
	const match = /^Học kỳ ([123]) Năm học (\d+) - (\d+)$/u.exec(source.trim());
	if (match === null) {
		throw new SemesterNotFoundError(source);
	}

	return (Number(match[2]) % 100) * 10 + Number(match[1]);
}

function parseRow(columns: LegacyStudentColumns): Timerow {
	const [
		courseCode,
		name,
		credits,
		tuitionCredits,
		group,
		weekdaySource,
		,
		timeSource,
		location,
		campus,
		weeksSource
	] = columns;
	const times = timeSource.split(' - ');
	if (times.length !== 2 || times[0] === undefined || times[1] === undefined) {
		throw new ParseError(timeSource, 'Expected a time range separated by " - "');
	}

	return {
		name,
		weekday: Number(weekdaySource),
		startHm: parseLegacyTime(times[0]),
		endHm: parseLegacyTime(times[1]),
		weeks: parseWeeks(weeksSource),
		location,
		extras: {
			courseCode,
			group,
			credits,
			tuitionCredits,
			campus
		}
	};
}

function parseLegacyTime(source: string): HourMinute {
	return source.trim() === '-' ? [0, 0] : parseTime(source);
}

function parseWeeks(source: string): Array<number | null> {
	const components = source.split('|');
	if (components.at(-1) === '') components.pop();
	return components.map((component) => (component === '--' ? null : Number(component)));
}
