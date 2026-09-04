import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractMyBkTableFromDocument } from '../src/content/extract.ts';

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
});
