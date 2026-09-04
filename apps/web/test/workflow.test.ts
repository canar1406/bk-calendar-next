import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferCaptureCompleteness, prepareTimetable } from '../src/lib/workflow.ts';
import type { SourceKind } from '../../../packages/timetable/src/index.ts';

const source = `20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Ngày cập nhật gần nhất của HK này: 28/08/2026 14:57:54
HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
20261\tMT1003\tGiải tích 1\t4\t4\tL11\t2\t2 - 4\t7:00 - 9:50\tH1-GĐH1\tBK-CS2\t35|--|37|
Trình bày từ dòng 1 đến 1 / 1 dòng`;

describe('web import workflow', () => {
	it('parses MyBK text and reports first import as additions', async () => {
		const result = await prepareTimetable(source, undefined, {
			capturedAt: '2026-09-02T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});
		assert.equal(result.snapshot.semester, 261);
		assert.equal(result.snapshot.events.length, 1);
		assert.equal(result.diff.added.length, 1);
		assert.equal(result.diff.changed.length, 0);
		assert.equal(result.profileId, 'student-2024:261');
	});

	it('reports no changes when the same timetable is imported again', async () => {
		const first = await prepareTimetable(source, undefined, {
			capturedAt: '2026-09-02T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});
		const second = await prepareTimetable(source, first.snapshot, {
			capturedAt: '2026-09-03T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});
		assert.equal(second.diff.unchanged.length, 1);
		assert.equal(
			second.diff.added.length + second.diff.changed.length + second.diff.removed.length,
			0
		);
	});

	it('blocks removals when capture is incomplete', async () => {
		const first = await prepareTimetable(source, undefined, {
			capturedAt: '2026-09-02T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		});
		const empty = source.replace(/20261\tMT1003[^\n]+\n/, '');
		const second = await prepareTimetable(empty, first.snapshot, {
			capturedAt: '2026-09-03T00:00:00.000Z',
			completeness: { state: 'incomplete', parsedRows: 0, expectedRows: 1 }
		});
		assert.equal(second.diff.removed.length, 1);
		assert.equal(second.diff.canDelete, false);
	});

	it('recognizes a full MyBK footer as a complete capture', () => {
		assert.deepEqual(inferCaptureCompleteness(source), {
			state: 'complete',
			parsedRows: 1,
			expectedRows: 1
		});
	});

	it('keeps paginated and footerless paste captures deletion-safe', () => {
		assert.deepEqual(inferCaptureCompleteness(source.replace('1 đến 1 / 1', '1 đến 1 / 2')), {
			state: 'incomplete',
			parsedRows: 1,
			expectedRows: 2
		});
		assert.deepEqual(inferCaptureCompleteness(source.replace(/\nTrình bày từ dòng.+$/u, '')), {
			state: 'unknown',
			parsedRows: 1
		});
	});

	it('uses the lecturer result count to distinguish complete and paginated captures', () => {
		const lecturerSource = `Năm học 2022
Học kỳ 1
Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND
20221_CO1006_L11\tNHẬP MÔN ĐIỆN TOÁN (TH)\tH6-707\tH6\t5\t5\t7-11\t12:00 - 16:50\t--|43|\t0%
Đang xem 1 đến 1 trong tổng số 1 mục`;

		assert.deepEqual(inferCaptureCompleteness(lecturerSource, 'lecturer'), {
			state: 'complete',
			parsedRows: 1,
			expectedRows: 1
		});
		assert.deepEqual(
			inferCaptureCompleteness(
				lecturerSource.replace('1 đến 1 trong tổng số 1', '1 đến 1 trong tổng số 2'),
				'lecturer'
			),
			{
				state: 'incomplete',
				parsedRows: 1,
				expectedRows: 2
			}
		);
	});

	it('keeps legacy and postgraduate captures deletion-safe without a reliable total count', () => {
		const legacySource = `MÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM-TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
MT1003\tGiải tích 1\t4\t4\tL25\t3\t2-4\t7:00 - 9:50\tH1-304\tBK-DAn\t--|42|43|44|`;
		const postgraduateSource = `Cán bộ giảng dạy\tMôn học\tLớp/DS lớp\tThứ\tTiết bắt đầu\tTiết kết thúc\tPhòng\tTuần\tGhi chú
GS.TS Phan Thị Tươi\t(CO5143) - Xử lý ngôn ngữ tự nhiên\t1 /\tCN\t4\t6\tTrực tuyến\t|1|2|3|4|5|\tHọc trực tuyến`;

		assert.deepEqual(inferCaptureCompleteness(legacySource, 'student-legacy'), {
			state: 'unknown',
			parsedRows: 1
		});
		assert.deepEqual(inferCaptureCompleteness(postgraduateSource, 'postgraduate'), {
			state: 'unknown',
			parsedRows: 1
		});
	});

	it('uses the explicitly selected lecturer parser instead of assuming a student table', async () => {
		const lecturerSource = `20261 - Học kỳ 1 Năm học 2026 - 2027
Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND
20261_MT1003_L01\tGiải tích 1\tH1-GĐH1\tH1\t2\t3\t2 - 4\t7:00 - 9:50\t35|--|37|\t100`;

		const result = await prepareTimetable(lecturerSource, undefined, {
			sourceKind: 'lecturer' satisfies SourceKind,
			capturedAt: '2026-09-04T00:00:00.000Z',
			completeness: { state: 'unknown', parsedRows: 1 }
		});

		assert.equal(result.snapshot.sourceKind, 'lecturer');
		assert.equal(result.snapshot.events[0]?.courseCode, 'MT1003');
		assert.equal(result.snapshot.events[0]?.title, 'Giải tích 1');
		assert.equal(result.profileId, 'lecturer:261');
	});

	it('fails closed when the selected timetable type does not match the pasted source', async () => {
		const lecturerSource = `Năm học 2022
Học kỳ 1
Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND
20221_CO1006_L11\tNHẬP MÔN ĐIỆN TOÁN (TH)\tH6-707\tH6\t5\t5\t7-11\t12:00 - 16:50\t--|43|\t0%`;

		await assert.rejects(
			prepareTimetable(lecturerSource, undefined, {
				sourceKind: 'student-2024',
				capturedAt: '2026-09-05T00:00:00.000Z'
			}),
			/table/i
		);
	});

	it('keeps legacy student and postgraduate imports in separate source profiles', async () => {
		const legacySource = `Học kỳ 1 Năm học 2020 - 2021
Ngày cập nhật:2021-01-14 13:44:46.0
MÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM-TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
MT1003\tGiải tích 1\t4\t4\tL25\t3\t2-4\t7:00 - 9:50\tH1-304\tBK-DAn\t--|42|43|44|
Tổng số tín chỉ đăng ký: 4`;
		const postgraduateSource = `Học kỳ 1/2023-2024: 04/09/2023 (Tuần 1)
Ngành: Khoa Học Máy Tính
Cán bộ giảng dạy\tMôn học\tLớp/DS lớp\tThứ\tTiết bắt đầu\tTiết kết thúc\tPhòng\tTuần\tGhi chú
GS.TS Phan Thị Tươi\t(CO5143) - Xử lý ngôn ngữ tự nhiên\t1 /\tCN\t4\t6\tTrực tuyến\t|1|2|3|4|5|\tHọc trực tuyến
Tối`;

		const legacy = await prepareTimetable(legacySource, undefined, {
			sourceKind: 'student-legacy',
			capturedAt: '2026-09-04T00:00:00.000Z',
			completeness: { state: 'unknown', parsedRows: 1 }
		});
		const postgraduate = await prepareTimetable(postgraduateSource, undefined, {
			sourceKind: 'postgraduate',
			capturedAt: '2026-09-04T00:00:00.000Z',
			completeness: { state: 'unknown', parsedRows: 1 }
		});

		assert.equal(legacy.profileId, 'student-legacy:201');
		assert.equal(legacy.snapshot.events[0]?.courseCode, 'MT1003');
		assert.equal(postgraduate.profileId, 'postgraduate:231');
		assert.equal(postgraduate.snapshot.events[0]?.courseCode, 'CO5143');
		assert.equal(postgraduate.snapshot.events[0]?.metadata.lecturer, 'GS.TS Phan Thị Tươi');
	});
});
