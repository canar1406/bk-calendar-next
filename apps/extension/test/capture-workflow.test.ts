import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createProfileStore,
	type KeyValueStorage
} from '../../../packages/timetable/src/storage.ts';
import { stageMyBkCapture } from '../src/background/capture-workflow.ts';
import type { MyBkCapture } from '../src/content/extract.ts';

class MemoryStorage implements KeyValueStorage {
	private values = new Map<string, unknown>();

	async get<T>(key: string): Promise<T | undefined> {
		return this.values.get(key) as T | undefined;
	}

	async set<T>(key: string, value: T): Promise<void> {
		this.values.set(key, structuredClone(value));
	}

	async remove(key: string): Promise<void> {
		this.values.delete(key);
	}
}

const capture: MyBkCapture = {
	raw: `20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Ngày cập nhật gần nhất của HK này: 28/08/2026 14:57:54
HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
20261\tMT1003\tGiải tích 1\t4\t4\tL11\t2\t2 - 4\t7:00 - 9:50\tH1-GĐH1\tBK-CS2\t35|--|37|
Trình bày từ dòng 1 đến 1 / 1 dòng`,
	sourceUpdatedAt: '2026-08-28T14:57:54+07:00',
	completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
};

describe('extension capture workflow', () => {
	it('stores a normalized pending snapshot without persisting raw timetable text', async () => {
		const store = createProfileStore(new MemoryStorage());
		const staged = await stageMyBkCapture(store, capture, '2026-09-02T01:00:00.000Z');
		const profile = await store.get('student-2024:261');

		assert.equal(staged.snapshot.events[0]?.courseCode, 'MT1003');
		assert.equal(profile?.pendingSnapshot?.fingerprint, staged.snapshot.fingerprint);
		assert.equal(JSON.stringify(profile).includes(capture.raw), false);
		assert.equal(staged.diff.canDelete, true);
	});

	it('keeps different MyBK semesters in separate profiles', async () => {
		const store = createProfileStore(new MemoryStorage());
		await stageMyBkCapture(store, capture, '2026-09-02T01:00:00.000Z');
		await stageMyBkCapture(
			store,
			{
				...capture,
				raw: capture.raw
					.replaceAll('20261', '20262')
					.replace('Học kỳ 1', 'Học kỳ 2')
					.replace('MT1003', 'PH1004')
					.replace('Giải tích 1', 'Thí nghiệm Vật lý')
			},
			'2027-01-15T01:00:00.000Z'
		);

		const firstSemester = await store.get('student-2024:261');
		const secondSemester = await store.get('student-2024:262');

		assert.equal(firstSemester?.pendingSnapshot?.events[0]?.courseCode, 'MT1003');
		assert.equal(secondSemester?.pendingSnapshot?.events[0]?.courseCode, 'PH1004');
		assert.equal(firstSemester?.pendingSnapshot?.semester, 261);
		assert.equal(secondSemester?.pendingSnapshot?.semester, 262);
	});

	it('stages a non-current timetable source under its own source profile', async () => {
		const store = createProfileStore(new MemoryStorage());
		const staged = await stageMyBkCapture(
			store,
			{
				sourceKind: 'lecturer',
				raw: `Năm học 2022
Học kỳ 1
Lớp\tTên MH\tPhòng\tDãy\tThứ\tSố tiết\tTiết\tGiờ\tTuần học\t% ND
20221_CO1006_L11\tNhập môn điện toán\tH6-707\tH6\t5\t5\t7-11\t12:00 - 16:50\t--|43|\t0%
Đang xem 1 đến 1 trong tổng số 1 mục`,
				completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
			},
			'2026-09-04T01:00:00.000Z'
		);

		assert.equal(staged.snapshot.sourceKind, 'lecturer');
		assert.equal(staged.snapshot.semester, 221);
		assert.equal(
			(await store.get('lecturer:221'))?.pendingSnapshot?.events[0]?.courseCode,
			'CO1006'
		);
	});
});
