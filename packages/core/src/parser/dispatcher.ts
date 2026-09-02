import type { SourceKind } from '../../../timetable/src/index.ts';
import type { Timetable } from '../timetable.ts';
import { TableNotFoundError } from './errors.ts';
import { parseLecturer } from './lecturer.ts';
import { parsePostgraduate } from './postgraduate.ts';
import { parseStudent2024 } from './student-2024.ts';
import { parseStudent } from './student.ts';

const HEADERS: Array<{ sourceKind: SourceKind; header: string }> = [
	{
		sourceKind: 'student-2024',
		header:
			'học kỳ\tmã mh\ttên môn học\ttín chỉ\ttc học phí\tnhóm - tổ\tthứ\ttiết\tgiờ học\tphòng\tcơ sở\ttuần học'
	},
	{
		sourceKind: 'student-legacy',
		header:
			'mã mh\ttên môn học\ttín chỉ\ttc học phí\tnhóm-tổ\tthứ\ttiết\tgiờ học\tphòng\tcơ sở\ttuần học'
	},
	{
		sourceKind: 'lecturer',
		header: 'lớp\ttên mh\tphòng\tdãy\tthứ\tsố tiết\ttiết\tgiờ\ttuần học\t% nd'
	},
	{
		sourceKind: 'postgraduate',
		header:
			'cán bộ giảng dạy\tmôn học\tlớp/ds lớp\tthứ\ttiết bắt đầu\ttiết kết thúc\tphòng\ttuần\tghi chú'
	}
];

export interface ParsedTimetableSource {
	sourceKind: SourceKind;
	timetable: Timetable;
}

export function detectTimetableSourceKind(source: string): SourceKind {
	const normalized = normalize(source);
	const detected = HEADERS.find(({ header }) => normalized.includes(normalize(header)));
	if (!detected) throw new TableNotFoundError(source);
	return detected.sourceKind;
}

export function parseTimetableSource(
	source: string,
	requestedSourceKind: SourceKind | 'auto' = 'auto'
): ParsedTimetableSource {
	const sourceKind =
		requestedSourceKind === 'auto' ? detectTimetableSourceKind(source) : requestedSourceKind;
	const timetable = parserFor(sourceKind)(source);
	return { sourceKind, timetable };
}

function parserFor(sourceKind: SourceKind): (source: string) => Timetable {
	switch (sourceKind) {
		case 'student-2024':
			return parseStudent2024;
		case 'student-legacy':
			return parseStudent;
		case 'lecturer':
			return parseLecturer;
		case 'postgraduate':
			return parsePostgraduate;
	}
}

function normalize(value: string): string {
	return value
		.replace(/^﻿/u, '')
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n')
		.normalize('NFD')
		.toLocaleLowerCase('vi-VN');
}
