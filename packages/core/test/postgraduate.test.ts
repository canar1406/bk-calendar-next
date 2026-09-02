import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError
} from '../src/parser/errors.ts';
import { parsePostgraduate } from '../src/parser/postgraduate.ts';

const header =
	'Cán bộ giảng dạy\tMôn học\tLớp/DS lớp\tThứ\tTiết bắt đầu\tTiết kết thúc\tPhòng\tTuần\tGhi chú';

const source = `Học kỳ 1/2023-2024: 04/09/2023 (Tuần 1)
Ngành: Khoa Học Máy Tính

Mã : 2010206 Du Thành Đạt Khóa: 2022
${header}
GS.TS Phan Thị Tươi\t(CO5143) - Xử lý ngôn ngữ tự nhiên\t1 / \tCN\t4\t6\tTrực tuyến\t|1|2|3|4|5|\tHọc trực tuyến
TS. Phan Trọng Nhân\t(CO5240) - Kỹ thuật dữ liệu\t2 / 22KHMT\tSáu\t13\t15\t305B4\t|--|--|--|--|--|6|7|8|9|10|\t
Tối`;

describe('postgraduate parser', () => {
	it('parses postgraduate rows into the current timetable model with structured extras', () => {
		const timetable = parsePostgraduate(source);

		assert.equal(timetable.semester, 231);
		assert.equal(timetable.startMondayUTC?.toISOString(), '2023-09-04T00:00:00.000Z');
		assert.deepEqual(timetable.rows, [
			{
				name: 'Xử lý ngôn ngữ tự nhiên',
				weekday: 8,
				startHm: [9, 0],
				endHm: [11, 50],
				weeks: [1, 2, 3, 4, 5],
				location: 'Trực tuyến',
				extras: {
					courseCode: 'CO5143',
					classCode: '1 /',
					lecturer: 'GS.TS Phan Thị Tươi',
					note: 'Học trực tuyến'
				}
			},
			{
				name: 'Kỹ thuật dữ liệu',
				weekday: 6,
				startHm: [18, 0],
				endHm: [20, 30],
				weeks: [null, null, null, null, null, 6, 7, 8, 9, 10],
				location: '305B4',
				extras: {
					courseCode: 'CO5240',
					classCode: '2 / 22KHMT',
					lecturer: 'TS. Phan Trọng Nhân',
					note: ''
				}
			}
		]);
	});

	it('accepts a case-insensitive header and a table without the footer', () => {
		const timetable = parsePostgraduate(
			`Học kỳ 2/2024-2025: 13/01/2025 (Tuần 1)
Ngành: Khoa Học Máy Tính

Mã: 123
${header.toLocaleLowerCase('vi-VN')}
PG1001\t(PG1001) - Chuyên đề\tL01\tHai\t1\t1\tB1\t|1|--|3|\t`
		);

		assert.equal(timetable.semester, 242);
		assert.deepEqual(timetable.rows[0]?.weeks, [1, null, 3]);
		assert.deepEqual(timetable.rows[0]?.startHm, [6, 0]);
		assert.deepEqual(timetable.rows[0]?.endHm, [6, 50]);
	});

	it('throws the current table-not-found error when the header is absent', () => {
		assert.throws(() => parsePostgraduate('not a timetable'), TableNotFoundError);
	});

	it('throws the current semester error when the semester preamble is absent', () => {
		assert.throws(
			() =>
				parsePostgraduate(
					`${header}
GS.TS A\t(CO5000) - Môn học\tL01\tHai\t1\t2\tB1\t|1|2|\t`
				),
			SemesterNotFoundError
		);
	});

	it('throws the current column-count error for a malformed row', () => {
		assert.throws(
			() =>
				parsePostgraduate(
					`Học kỳ 1/2023-2024: 04/09/2023 (Tuần 1)
${header}
GS.TS A\t(CO5000) - Môn học`
				),
			(error: unknown) =>
				error instanceof ColumnCountError && error.expected === 9 && error.actual === 2
		);
	});

	it('rejects an unknown weekday', () => {
		assert.throws(
			() =>
				parsePostgraduate(
					`Học kỳ 1/2023-2024: 04/09/2023 (Tuần 1)
${header}
GS.TS A\t(CO5000) - Môn học\tL01\tThứ 2\t1\t2\tB1\t|1|2|\t`
				),
			ParseError
		);
	});

	it('rejects periods outside the postgraduate period table', () => {
		assert.throws(
			() =>
				parsePostgraduate(
					`Học kỳ 1/2023-2024: 04/09/2023 (Tuần 1)
${header}
GS.TS A\t(CO5000) - Môn học\tL01\tHai\t18\t18\tB1\t|1|2|\t`
				),
			ParseError
		);
	});

	it('rejects malformed week values', () => {
		assert.throws(
			() =>
				parsePostgraduate(
					`Học kỳ 1/2023-2024: 04/09/2023 (Tuần 1)
${header}
GS.TS A\t(CO5000) - Môn học\tL01\tHai\t1\t2\tB1\t|1|week 2|\t`
				),
			ParseError
		);
	});
});
