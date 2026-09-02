import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError
} from '../src/parser/errors.ts';
import { parseLecturer } from '../src/parser/lecturer.ts';

const header = 'Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND';

const source = `Năm học 2022

Học kỳ 1

Tìm:
${header}
20221_CO1006_L11\tNHẬP MÔN ĐIỆN TOÁN (TH)\tH6-707\tH6\t5\t5\t7-11\t12:00 - 16:50\t--|--|--|--|--|--|--|--|43|\t0%
20221_CO1006_L23\tNHẬP MÔN ĐIỆN TOÁN (TH)\tHANGOUT_TUONGTAC\tLIVE_HOME\t5\t5\t7-11\t12:00 - 16:50\t--|--|--|--|--|--|--|--|--|--|45|--|47|\t
Đang xem 1 đến 2 trong tổng số 2 mục`;

describe('lecturer parser', () => {
	it('exports the lecturer parser from its direct module', () => {
		assert.equal(typeof parseLecturer, 'function');
	});

	it('parses lecturer rows and derives stable structured identity metadata', () => {
		const timetable = parseLecturer(source);

		assert.equal(timetable.semester, 221);
		assert.equal(timetable.rows.length, 2);
		assert.deepEqual(timetable.rows[0], {
			name: 'NHẬP MÔN ĐIỆN TOÁN (TH)',
			weekday: 5,
			startHm: [12, 0],
			endHm: [16, 50],
			weeks: [null, null, null, null, null, null, null, null, 43],
			location: 'H6-707',
			extras: {
				classCode: '20221_CO1006_L11',
				courseCode: 'CO1006',
				group: 'L11'
			}
		});
	});

	it('accepts a case-insensitive header, CRLF input, and no pagination footer', () => {
		const timetable = parseLecturer(
			`﻿Năm học 2023\r\nHọc kỳ 2\r\n${header.toLocaleLowerCase('vi-VN')}\r\n20232_MT1003_L01\tGiải tích 1\tH1-101\tH1\t2\t3\t1-3\t7:00 - 9:50\t35|--|37|\t100%`
		);

		assert.equal(timetable.semester, 232);
		assert.equal(timetable.rows.length, 1);
		assert.deepEqual(timetable.rows[0]?.weeks, [35, null, 37]);
		assert.deepEqual(timetable.rows[0]?.extras, {
			classCode: '20232_MT1003_L01',
			courseCode: 'MT1003',
			group: 'L01'
		});
	});

	it('throws the current table error when the lecturer header is absent', () => {
		assert.throws(
			() => parseLecturer('Năm học 2022\nHọc kỳ 1\nnot a timetable'),
			TableNotFoundError
		);
	});

	it('throws the current semester error when the preamble is incomplete', () => {
		assert.throws(
			() =>
				parseLecturer(
					`${header}\n20221_CO1006_L11\tMôn học\tH6-707\tH6\t5\t5\t7-11\t12:00 - 16:50\t--|43|\t0%`
				),
			SemesterNotFoundError
		);
	});

	it('throws the current column-count error for a malformed row', () => {
		assert.throws(
			() => parseLecturer(`Năm học 2022\nHọc kỳ 1\n${header}\n20221_CO1006_L11\tMôn học`),
			(error: unknown) =>
				error instanceof ColumnCountError && error.expected === 10 && error.actual === 2
		);
	});

	it('throws the current parse error for a malformed time range', () => {
		assert.throws(
			() =>
				parseLecturer(
					`Năm học 2022\nHọc kỳ 1\n${header}\n20221_CO1006_L11\tMôn học\tH6-707\tH6\t5\t5\t7-11\t12:00–16:50\t--|43|\t0%`
				),
			ParseError
		);
	});

	it('throws the current parse error for an invalid week token', () => {
		assert.throws(
			() =>
				parseLecturer(
					`Năm học 2022\nHọc kỳ 1\n${header}\n20221_CO1006_L11\tMôn học\tH6-707\tH6\t5\t5\t7-11\t12:00 - 16:50\t--|week-43|\t0%`
				),
			ParseError
		);
	});
});
