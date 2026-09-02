import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	TableNotFoundError,
	detectTimetableSourceKind,
	parseTimetableSource
} from '../src/index.ts';

const currentStudent = `20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Ngày cập nhật gần nhất của HK này: 28/08/2026 14:57:54
HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
20261\tMT1003\tGiải tích 1\t4\t4\tL11\t2\t2 - 4\t7:00 - 9:50\tH1-GĐH1\tBK-CS2\t35|--|37|`;

describe('timetable source dispatcher', () => {
	it('detects every supported timetable source from its table header', () => {
		assert.equal(detectTimetableSourceKind(currentStudent), 'student-2024');
		assert.equal(
			detectTimetableSourceKind(
				'MÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM-TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC'
			),
			'student-legacy'
		);
		assert.equal(
			detectTimetableSourceKind('Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND'),
			'lecturer'
		);
		assert.equal(
			detectTimetableSourceKind(
				'Cán bộ giảng dạy\tMôn học\tLớp/DS lớp\tThứ\tTiết bắt đầu\tTiết kết thúc\tPhòng\tTuần\tGhi chú'
			),
			'postgraduate'
		);
	});

	it('parses an automatically detected source with its matching parser', () => {
		const parsed = parseTimetableSource(currentStudent);

		assert.equal(parsed.sourceKind, 'student-2024');
		assert.equal(parsed.timetable.semester, 261);
		assert.equal(parsed.timetable.rows[0]?.extras.courseCode, 'MT1003');
	});

	it('fails closed when no supported timetable header is present', () => {
		assert.throws(() => detectTimetableSourceKind('not a timetable'), TableNotFoundError);
	});
});
