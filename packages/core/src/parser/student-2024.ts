import type { Timerow, Timetable } from '../timetable.ts';
import {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	SourceUpdatedAtNotFoundError,
	TableNotFoundError
} from './errors.ts';
import { parseTime } from './utils.ts';

const HEADER =
	'học kỳ\tmã mh\ttên môn học\ttín chỉ\ttc học phí\tnhóm - tổ\tthứ\ttiết\tgiờ học\tphòng\tcơ sở\ttuần học';
const COLUMN_COUNT = HEADER.split('\t').length;
const VIETNAM_OFFSET = '+07:00';

type StudentColumns = [
	semester: string,
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

/** Parse a timetable copied from the current (2024+) MyBK student page. */
export function parseStudent2024(source: string): Timetable {
	const normalizedSource = source.replace(/^﻿/, '').replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	const lines = normalizedSource.trim().split('\n');
	const headerIndex = lines.findIndex(
		(line) => normalizeLabel(line.trim()) === normalizeLabel(HEADER)
	);

	if (headerIndex < 0) {
		throw new TableNotFoundError(source);
	}

	const preamble = lines.slice(0, headerIndex + 1);
	const semester = parseSemester(preamble);
	const sourceUpdatedAt = parseSourceUpdatedAt(preamble);
	const rows: Timerow[] = [];

	for (let index = headerIndex + 1; index < lines.length; index += 1) {
		const line = lines[index]?.trim() ?? '';
		if (line === '') continue;
		if (normalizeLabel(line).startsWith(normalizeLabel('Trình bày từ dòng'))) break;

		const columns = line.split('\t');
		if (columns.length !== COLUMN_COUNT) {
			throw new ColumnCountError(line, COLUMN_COUNT, columns.length);
		}

		rows.push(...parseRow(columns as StudentColumns));
	}

	return { semester, sourceUpdatedAt, rows };
}

function normalizeLabel(value: string): string {
	return value.normalize('NFD').toLocaleLowerCase('vi-VN');
}

function parseSemester(lines: string[]): number {
	const semesterPattern = /Học kỳ\s+([123])\s+Năm học\s+(\d{4})\s*-\s*(\d{4})/iu;

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index];
		if (line === undefined) continue;
		const match = semesterPattern.exec(line);
		if (match === null) continue;

		const term = Number(match[1]);
		const startYear = Number(match[2]);
		const endYear = Number(match[3]);
		if (endYear !== startYear + 1) {
			throw new ParseError(line, 'Academic year must span consecutive years');
		}
		return (startYear % 100) * 10 + term;
	}

	throw new SemesterNotFoundError(lines.join('\n'));
}

function parseSourceUpdatedAt(lines: string[]): string {
	const marker = normalizeLabel('Ngày cập nhật gần nhất của HK này:');
	const timestampPattern = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/u;

	for (const line of lines) {
		if (!normalizeLabel(line).includes(marker)) continue;
		const match = timestampPattern.exec(line);
		if (match === null) {
			throw new ParseError(line, 'Expected update timestamp in DD/MM/YYYY HH:mm:ss format');
		}

		const day = Number(match[1]);
		const month = Number(match[2]);
		const year = Number(match[3]);
		const hour = Number(match[4]);
		const minute = Number(match[5]);
		const second = Number(match[6]);
		const candidate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
		if (
			candidate.getUTCFullYear() !== year ||
			candidate.getUTCMonth() !== month - 1 ||
			candidate.getUTCDate() !== day ||
			candidate.getUTCHours() !== hour ||
			candidate.getUTCMinutes() !== minute ||
			candidate.getUTCSeconds() !== second
		) {
			throw new ParseError(line, 'Update timestamp is outside the valid range');
		}

		return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${VIETNAM_OFFSET}`;
	}

	throw new SourceUpdatedAtNotFoundError(lines.join('\n'));
}

function parseRow(columns: StudentColumns): Timerow[] {
	const [
		,
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

	// MyBK uses this for courses without a scheduled meeting.
	if (timeSource.trim() === '--') return [];

	const weekday =
		weekdaySource.trim().toLocaleUpperCase('vi-VN') === 'CN' ? 8 : Number(weekdaySource);
	if (!Number.isInteger(weekday) || weekday < 2 || weekday > 8) {
		throw new ParseError(weekdaySource, 'Weekday must be 2-7 or CN');
	}

	const times = timeSource.split(/\s+-\s+/u);
	if (times.length !== 2 || times[0] === undefined || times[1] === undefined) {
		throw new ParseError(timeSource, 'Expected a time range separated by " - "');
	}

	return [
		{
			name,
			weekday,
			startHm: parseTime(times[0]),
			endHm: parseTime(times[1]),
			weeks: parseWeeks(weeksSource),
			location,
			extras: { courseCode, group, credits, tuitionCredits, campus }
		}
	];
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

function pad(value: number, width = 2): string {
	return String(value).padStart(width, '0');
}
