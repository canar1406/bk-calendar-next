import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	extractMyBkTableFromDocument,
	extractTimetableFromDocument,
	isLikelyExpiredSession
} from '../src/content/extract.ts';
import { parseTimetableSource } from '../../../packages/core/src/index.ts';

const html = `
<h3>20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)</h3>
<p>Ngày cập nhật gần nhất của HK này: 28/08/2026 14:57:54</p>
<table>
  <thead><tr><th>HỌC KỲ</th><th>MÃ MH</th><th>TÊN MÔN HỌC</th><th>TÍN CHỈ</th><th>TC HỌC PHÍ</th><th>NHÓM - TỔ</th><th>THỨ</th><th>TIẾT</th><th>GIỜ HỌC</th><th>PHÒNG</th><th>CƠ SỞ</th><th>TUẦN HỌC</th></tr></thead>
  <tbody>
    <tr><td>20261</td><td>MT1003</td><td>Giải tích 1</td><td>4</td><td>4</td><td>L11</td><td>2</td><td>2 - 4</td><td>7:00 - 9:50</td><td>H1-GĐH1</td><td>BK-CS2</td><td>35|--|37|38|</td></tr>
    <tr><td>20261</td><td>AS1001</td><td>Nhập môn kỹ thuật</td><td>3</td><td>3</td><td>L02</td><td>3</td><td>4 - 5</td><td>9:00 - 10:50</td><td>H6-411</td><td>BK-CS2</td><td>35|--|37|38|</td></tr>
  </tbody>
</table>
<div>Trình bày từ dòng 1 đến 2 / 11 dòng</div>`;

describe('MyBK DOM extractor', () => {
	it('maps table cells into the tab-delimited format understood by core', () => {
		const result = extractMyBkTableFromDocument(html);
		assert.match(result.raw, /HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC/);
		assert.match(result.raw, /20261\tMT1003\tGiải tích 1/);
		assert.equal(result.sourceUpdatedAt, '2026-08-28T14:57:54+07:00');
	});

	it('marks a paginated capture incomplete so removals cannot be applied', () => {
		const result = extractMyBkTableFromDocument(html);
		assert.deepEqual(result.completeness, { state: 'incomplete', parsedRows: 2, expectedRows: 11 });
	});

	it('recognizes live DataTables headers that include sorting controls', () => {
		const decorated = html.replaceAll(
			'</th>',
			'<span class="sorting-control" aria-hidden="true">⇅</span></th>'
		);
		const result = extractMyBkTableFromDocument(decorated);

		assert.match(result.raw, /20261\tMT1003\tGiải tích 1/);
		assert.equal(result.completeness.parsedRows, 2);
	});

	it('throws when the timetable table is absent instead of accepting an empty schedule', () => {
		assert.throws(
			() => extractMyBkTableFromDocument('<p>Phiên đăng nhập đã hết hạn</p>'),
			/không tìm thấy bảng thời khóa biểu/i
		);
	});

	it('recognizes an expired MyBK session even when the browser URL is still the TKB URL', () => {
		assert.equal(
			isLikelyExpiredSession(`
				<div class="alert">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.</div>
				<a href="/app/login?type=cas">Đăng nhập</a>
			`),
			true
		);
		assert.equal(
			isLikelyExpiredSession('<div>Học kỳ hiện tại</div><table><tr><td>TKB</td></tr></table>'),
			false
		);
	});

	it('extracts legacy student, lecturer, and postgraduate tables for background tracking', () => {
		const legacy = extractTimetableFromDocument(`
			<h3>Học kỳ 1 Năm học 2020 - 2021</h3>
			<table><tr><th>MÃ MH</th><th>TÊN MÔN HỌC</th><th>TÍN CHỈ</th><th>TC HỌC PHÍ</th><th>NHÓM-TỔ</th><th>THỨ</th><th>TIẾT</th><th>GIỜ HỌC</th><th>PHÒNG</th><th>CƠ SỞ</th><th>TUẦN HỌC</th></tr>
			<tr><td>MT1003</td><td>Giải tích 1</td><td>4</td><td>4</td><td>L25</td><td>3</td><td>2-4</td><td>7:00 - 9:50</td><td>H1-304</td><td>BK-DAn</td><td>--|42|43|</td></tr></table>`);
		const lecturer = extractTimetableFromDocument(`
			<p>Năm học 2022 · Học kỳ 1</p>
			<table><tr><th>Lớp</th><th>Tên MH</th><th>Phòng</th><th>Dãy</th><th>Thứ</th><th>Số tiết</th><th>Tiết</th><th>Giờ</th><th>Tuần học</th><th>% ND</th></tr>
			<tr><td>20221_CO1006_L11</td><td>Nhập môn điện toán</td><td>H6-707</td><td>H6</td><td>5</td><td>5</td><td>7-11</td><td>12:00 - 16:50</td><td>--|43|</td><td>0%</td></tr></table>
			<p>Đang xem 1 đến 1 trong tổng số 1 mục</p>`);
		const postgraduate = extractTimetableFromDocument(`
			<p>Học kỳ 1/2023-2024: 04/09/2023 (Tuần 1)</p>
			<table><tr><th>Cán bộ giảng dạy</th><th>Môn học</th><th>Lớp/DS lớp</th><th>Thứ</th><th>Tiết bắt đầu</th><th>Tiết kết thúc</th><th>Phòng</th><th>Tuần</th><th>Ghi chú</th></tr>
			<tr><td>GS.TS Phan Thị Tươi</td><td>(CO5143) - Xử lý ngôn ngữ tự nhiên</td><td>1 /</td><td>CN</td><td>4</td><td>6</td><td>Trực tuyến</td><td>|1|2|</td><td>Học trực tuyến</td></tr></table>`);

		assert.equal(legacy.sourceKind, 'student-legacy');
		assert.match(legacy.raw, /MT1003\tGiải tích 1/);
		assert.equal(parseTimetableSource(legacy.raw, 'student-legacy').timetable.rows.length, 1);
		assert.equal(lecturer.sourceKind, 'lecturer');
		assert.match(lecturer.raw, /20221_CO1006_L11\tNhập môn điện toán/);
		assert.equal(lecturer.completeness.state, 'complete');
		assert.equal(postgraduate.sourceKind, 'postgraduate');
		assert.match(postgraduate.raw, /CO5143/);
		assert.equal(parseTimetableSource(postgraduate.raw, 'postgraduate').timetable.rows.length, 1);
	});
});
