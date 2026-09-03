import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferCaptureCompleteness, prepareTimetable } from '../src/lib/workflow.ts';

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
});
