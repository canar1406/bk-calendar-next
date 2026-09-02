import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	TableNotFoundError,
	parseStudent,
	resolveTimetable,
	toTimetableSnapshot
} from '../src/index.ts';

const header =
	'MÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM-TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC';

const source = `Học kỳ 1 Năm học 2020 - 2021
Ngày cập nhật:2021-01-14 13:44:46.0
${header}
PE1023\tVõ (Vovinam, Karate, Taewondo) (học phần 1)\t--\t1.5\tL262\t2\t10-12\t15:00 - 17:50\tCS2-NHATHIDAU-SAN1\tBK-DAn\t--|--|--|42|43|44|--|49|50|
MT1003\tGiải tích 1\t4\t4\tL25\t3\t2-4\t7:00 - 9:50\tH1-304\tBK-DAn\t--|42|43|44|
Tổng số tín chỉ đăng ký: 4`;

describe('legacy student parser', () => {
	it('parses the pre-2024 student table into the existing timetable model', () => {
		const timetable = parseStudent(source);

		assert.equal(timetable.semester, 201);
		assert.equal(timetable.rows.length, 2);
		assert.deepEqual(timetable.rows[0], {
			name: 'Võ (Vovinam, Karate, Taewondo) (học phần 1)',
			weekday: 2,
			startHm: [15, 0],
			endHm: [17, 50],
			weeks: [null, null, null, 42, 43, 44, null, 49, 50],
			location: 'CS2-NHATHIDAU-SAN1',
			extras: {
				courseCode: 'PE1023',
				group: 'L262',
				credits: '--',
				tuitionCredits: '1.5',
				campus: 'BK-DAn'
			}
		});
	});

	it('accepts a case-insensitive header and a table without the credit footer', () => {
		const timetable = parseStudent(
			`Học kỳ 2 Năm học 2023 - 2024
Ngày cập nhật:2024-01-14 13:44:46.0
${header.toLocaleLowerCase('vi-VN')}
MT1003\tGiải tích 1\t4\t4\tL25\t3\t2-4\t7:00 - 9:50\tH1-304\tBK-DAn\t--|01|02|`
		);

		assert.equal(timetable.semester, 232);
		assert.equal(timetable.rows.length, 1);
		assert.deepEqual(timetable.rows[0]?.weeks, [null, 1, 2]);
	});

	it('preserves the legacy dashed-time placeholder as midnight', () => {
		const timetable = parseStudent(
			`Học kỳ 1 Năm học 2020 - 2021
Ngày cập nhật:2021-01-14 13:44:46.0
${header}
MI1003\tGiáo dục quốc phòng\t--\t1\tL02\t--\t---\t- - -\t------\tBK\t--|--|45|46|`
		);

		assert.deepEqual(timetable.rows[0]?.startHm, [0, 0]);
		assert.deepEqual(timetable.rows[0]?.endHm, [0, 0]);
	});

	it('normalizes legacy metadata for stable event identity', async () => {
		const singleCourseSource = `Học kỳ 1 Năm học 2020 - 2021
Ngày cập nhật:2021-01-14 13:44:46.0
${header}
MT1003\tGiải tích 1\t4\t4\tL25\t3\t2-4\t7:00 - 9:50\tH1-304\tBK-DAn\t--|42|43|44|`;
		const snapshot = await toTimetableSnapshot(resolveTimetable(parseStudent(singleCourseSource)), {
			sourceKind: 'student-legacy',
			capturedAt: '2026-09-02T00:00:00.000Z'
		});
		const event = snapshot.events.find((candidate) => candidate.title === 'Giải tích 1');

		assert.equal(event?.courseCode, 'MT1003');
		assert.equal(event?.group, 'L25');
		assert.equal(event?.metadata.campus, 'BK-DAn');
	});

	it('throws the current table-not-found error when the legacy header is absent', () => {
		assert.throws(() => parseStudent('not a timetable'), TableNotFoundError);
	});

	it('throws the current semester error when the legacy preamble is missing', () => {
		assert.throws(
			() =>
				parseStudent(
					`${header}
MT1003\tGiải tích 1\t4\t4\tL25\t3\t2-4\t7:00 - 9:50\tH1-304\tBK-DAn\t--|01|02|`
				),
			SemesterNotFoundError
		);
	});

	it('throws the current column-count error for a malformed row', () => {
		assert.throws(
			() =>
				parseStudent(
					`Học kỳ 1 Năm học 2020 - 2021
Ngày cập nhật:2021-01-14 13:44:46.0
${header}
MT1003\tGiải tích 1`
				),
			(error: unknown) =>
				error instanceof ColumnCountError && error.expected === 11 && error.actual === 2
		);
	});

	it('throws the current parse error for a malformed time range', () => {
		assert.throws(
			() =>
				parseStudent(
					`Học kỳ 1 Năm học 2020 - 2021
Ngày cập nhật:2021-01-14 13:44:46.0
${header}
MT1003\tGiải tích 1\t4\t4\tL25\t3\t2-4\t7:00–9:50\tH1-304\tBK-DAn\t--|01|02|`
				),
			ParseError
		);
	});
});
