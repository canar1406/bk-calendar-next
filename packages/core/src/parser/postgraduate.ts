import type { HourMinute, Timerow, Timetable } from '../timetable.ts';
import {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError
} from './errors.ts';

const HEADER =
	'cán bộ giảng dạy\tmôn học\tlớp/ds lớp\tthứ\ttiết bắt đầu\ttiết kết thúc\tphòng\ttuần\tghi chú';
const COLUMN_COUNT = HEADER.split('\t').length;

type PostgraduateColumns = [
	lecturer: string,
	course: string,
	classCode: string,
	weekday: string,
	startPeriod: string,
	endPeriod: string,
	location: string,
	weeks: string,
	note: string
];

/** Parse a timetable copied from the MyBK postgraduate page. */
export function parsePostgraduate(source: string): Timetable {
	const normalizedSource = source.replace(/^﻿/, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	const lines = normalizedSource.split('\n');
	const headerIndex = lines.findIndex(
		(line) => normalizeLabel(line.trim()) === normalizeLabel(HEADER)
	);

	if (headerIndex < 0) {
		throw new TableNotFoundError(source);
	}

	const { semester, startMondayUTC } = parseSemester(lines.slice(0, headerIndex));
	const rows: Timerow[] = [];

	for (let index = headerIndex + 1; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		if (line.trim() === '' || normalizeLabel(line.trim()).startsWith(normalizeLabel('Tối'))) break;

		const columns = line.split('\t');
		if (columns.length !== COLUMN_COUNT) {
			throw new ColumnCountError(line, COLUMN_COUNT, columns.length);
		}

		rows.push(parseRow(columns as PostgraduateColumns));
	}

	return { semester, startMondayUTC, rows };
}

function normalizeLabel(value: string): string {
	return value.normalize('NFD').toLocaleLowerCase('vi-VN');
}

function parseSemester(lines: string[]): { semester: number; startMondayUTC: Date } {
	const pattern = /^Học kỳ\s+([123])\/(\d{4})-(\d{4})\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/iu;

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index]?.trim();
		if (line === undefined) continue;
		const match = pattern.exec(line);
		if (match === null) continue;

		const term = Number(match[1]);
		const startYear = Number(match[2]);
		const endYear = Number(match[3]);
		if (endYear !== startYear + 1) {
			throw new ParseError(line, 'Academic year must span consecutive years');
		}

		const day = Number(match[4]);
		const month = Number(match[5]);
		const year = Number(match[6]);
		const startMondayUTC = new Date(Date.UTC(year, month - 1, day));
		if (
			startMondayUTC.getUTCFullYear() !== year ||
			startMondayUTC.getUTCMonth() !== month - 1 ||
			startMondayUTC.getUTCDate() !== day
		) {
			throw new ParseError(line, 'Semester start date is outside the valid range');
		}

		return {
			semester: (startYear % 100) * 10 + term,
			startMondayUTC
		};
	}

	throw new SemesterNotFoundError(lines.join('\n'));
}

function parseRow(columns: PostgraduateColumns): Timerow {
	const [
		lecturer,
		courseSource,
		classCode,
		weekdaySource,
		startPeriodSource,
		endPeriodSource,
		location,
		weeksSource,
		note
	] = columns;
	const course = /^\s*\(([^)]+)\)\s*-\s*(.+?)\s*$/u.exec(courseSource);
	const courseCode = course?.[1];
	const name = course?.[2];
	if (courseCode === undefined || name === undefined) {
		throw new ParseError(courseSource, 'Expected a course in "(CODE) - Name" format');
	}

	return {
		name,
		weekday: parseWeekday(weekdaySource),
		startHm: periodTime(startPeriodSource, 'start'),
		endHm: periodTime(endPeriodSource, 'end'),
		weeks: parseWeeks(weeksSource),
		location: location.trim(),
		extras: {
			courseCode: courseCode.trim(),
			classCode: classCode.trim(),
			lecturer: lecturer.trim(),
			note: note.trim()
		}
	};
}

function parseWeekday(source: string): number {
	const weekdays: Record<string, number> = {
		hai: 2,
		ba: 3,
		tư: 4,
		năm: 5,
		sáu: 6,
		bảy: 7,
		cn: 8
	};
	const weekday = weekdays[normalizeLabel(source.trim())];
	if (weekday === undefined) {
		throw new ParseError(source, 'Weekday must be Hai, Ba, Tư, Năm, Sáu, Bảy, or CN');
	}
	return weekday;
}

function periodTime(source: string, boundary: 'start' | 'end'): HourMinute {
	const period = Number(source.trim());
	if (!Number.isInteger(period) || period < 0 || period > 17) {
		throw new ParseError(source, 'Period must be an integer from 0 to 17');
	}
	if (period === 0) return [0, 0];
	if (period <= 13) return [period + 5, boundary === 'start' ? 0 : 50];

	const eveningStarts: Record<number, HourMinute> = {
		14: [18, 50],
		15: [19, 40],
		16: [20, 30],
		17: [21, 20]
	};
	const start = eveningStarts[period];
	if (start === undefined) {
		throw new ParseError(source, 'Period must be an integer from 0 to 17');
	}
	if (boundary === 'start') return start;

	const [hour, minute] = start;
	const totalMinutes = hour * 60 + minute + 50;
	return [Math.floor(totalMinutes / 60), totalMinutes % 60];
}

function parseWeeks(source: string): Array<number | null> {
	const components = source.trim().replace(/^\|/u, '').replace(/\|$/u, '').split('|');
	if (components.length === 0 || components.every((component) => component.trim() === '')) {
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
