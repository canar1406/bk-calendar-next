import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	InvalidSemesterError,
	MixedSemesterError,
	UnresolvedTimetableError,
	parseStudent2024,
	resolveTimetable,
	toTimetableSnapshot,
	type Timetable
} from '../src/index.ts';

const source = `20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Ngày cập nhật gần nhất của HK này: 28/08/2026 14:57:54
Trình bày
10
 dòng/trang
Tìm kiếm:
HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
20261\tMT1003\tGiải tích 1\t4\t4\tL11\t2\t2 - 4\t7:00 - 9:50\tH1-GĐH1\tBK-CS2\t35|--|37|38|39|40|41|--|43|44|45|46|47|48|49|50|
20261\tAS1001\tNhập môn Vẽ kỹ thuật\t3\t3\tL02\t3\t4 - 5\t9:00 - 10:50\tH6-411\tBK-CS2\t35|--|37|38|39|40|41|--|43|44|45|46|47|48|49|50|
Trình bày từ dòng 1 đến 2 / 2 dòng`;

describe('student 2024 parser', () => {
	it('parses current MyBK table and source update timestamp', () => {
		const timetable = parseStudent2024(source);
		assert.equal(timetable.semester, 261);
		assert.equal(timetable.sourceUpdatedAt, '2026-08-28T14:57:54+07:00');
		assert.equal(timetable.rows.length, 2);
		assert.deepEqual(
			{
				name: timetable.rows[0]?.name,
				weekday: timetable.rows[0]?.weekday,
				location: timetable.rows[0]?.location,
				extras: timetable.rows[0]?.extras
			},
			{
				name: 'Giải tích 1',
				weekday: 2,
				location: 'H1-GĐH1',
				extras: {
					courseCode: 'MT1003',
					group: 'L11',
					credits: '4',
					tuitionCredits: '4',
					campus: 'BK-CS2'
				}
			}
		);
	});
});

describe('snapshot conversion', () => {
	it('normalizes resolved rows into deterministic managed events', async () => {
		const timetable = resolveTimetable(parseStudent2024(source));
		const snapshot = await toTimetableSnapshot(timetable, {
			sourceKind: 'student-2024',
			capturedAt: '2026-09-02T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 2, expectedRows: 2 }
		});

		assert.equal(snapshot.events.length, 2);
		assert.equal(snapshot.events[0]?.start, '2026-08-24T00:00:00.000Z');
		assert.equal(snapshot.events[0]?.end, '2026-08-24T02:50:00.000Z');
		assert.deepEqual(
			snapshot.events[0]?.activeWeekIndexes,
			[0, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15]
		);
		assert.ok(snapshot.events.every((event) => event.stableKey.startsWith('bk2_')));
		assert.ok(snapshot.events.every((event) => event.fingerprint?.length === 64));
	});

	it('keeps session identities stable when same-course rows are reordered', async () => {
		const timetable: Timetable = {
			semester: 261,
			startMondayUTC: new Date('2026-08-24T00:00:00.000Z'),
			rows: [
				{
					name: 'Thí nghiệm Vật lý',
					weekday: 2,
					startHm: [7, 0],
					endHm: [9, 50],
					weeks: [35, 36],
					location: 'A1',
					extras: { courseCode: 'PH1003', group: 'L01' }
				},
				{
					name: 'Thí nghiệm Vật lý',
					weekday: 2,
					startHm: [13, 0],
					endHm: [15, 50],
					weeks: [35, 36],
					location: 'B2',
					extras: { courseCode: 'PH1003', group: 'L01' }
				}
			]
		};
		const first = await toTimetableSnapshot(resolveTimetable(timetable), {
			sourceKind: 'student-2024',
			capturedAt: '2026-09-02T00:00:00.000Z'
		});
		const reordered = await toTimetableSnapshot(
			resolveTimetable({ ...timetable, rows: [...timetable.rows].reverse() }),
			{
				sourceKind: 'student-2024',
				capturedAt: '2026-09-03T00:00:00.000Z'
			}
		);

		const identityByStart = (snapshot: typeof first) =>
			Object.fromEntries(snapshot.events.map((event) => [event.start, event.stableKey]));
		assert.deepEqual(identityByStart(reordered), identityByStart(first));
	});
});

describe('timetable resolver', () => {
	it('returns immutable UTC Monday independent of local timezone', () => {
		const previousTimezone = process.env.TZ;
		process.env.TZ = 'America/Los_Angeles';
		try {
			const timetable = parseStudent2024(source);
			const resolved = resolveTimetable(timetable);
			assert.equal(resolved.startMondayUTC.toISOString(), '2026-08-24T00:00:00.000Z');
			assert.equal(resolved.startMondayUTC.getUTCDay(), 1);
			assert.equal(timetable.startMondayUTC, undefined);
		} finally {
			process.env.TZ = previousTimezone;
		}
	});

	it('rejects all-null weeks with a domain error', () => {
		const timetable: Timetable = {
			semester: 261,
			rows: [
				{
					name: 'Không có lịch',
					weekday: 2,
					startHm: [7, 0],
					endHm: [8, 0],
					weeks: [null, null],
					location: '',
					extras: {}
				}
			]
		};
		assert.throws(() => resolveTimetable(timetable), UnresolvedTimetableError);
	});

	it('does not mutate input when rows imply mixed semester starts', () => {
		const timetable: Timetable = {
			semester: 261,
			rows: [
				{
					name: 'A',
					weekday: 2,
					startHm: [7, 0],
					endHm: [8, 0],
					weeks: [35],
					location: '',
					extras: {}
				},
				{
					name: 'B',
					weekday: 3,
					startHm: [7, 0],
					endHm: [8, 0],
					weeks: [36],
					location: '',
					extras: {}
				}
			]
		};
		assert.throws(() => resolveTimetable(timetable), MixedSemesterError);
		assert.equal(timetable.startMondayUTC, undefined);
	});

	it('rejects semester values outside YYT encoding', () => {
		const timetable = parseStudent2024(source);
		timetable.semester = 20261;
		assert.throws(() => resolveTimetable(timetable), InvalidSemesterError);
	});
});
