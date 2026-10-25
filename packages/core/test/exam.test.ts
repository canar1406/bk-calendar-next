import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { createSourceSnapshot } from '../src/index.ts';
import { diffSnapshots } from '../../timetable/src/index.ts';
import { createProfileStore, stageSnapshot } from '../../timetable/src/storage.ts';

const source = `Học kỳ 1 Năm học 2026 - 2027
STT\tMã MH\tTên môn học\tNhóm - tổ\tNgày thi\tGiờ thi\tSố phút\tPhòng thi\tCơ sở\tLoại thi
1\tMT1003\tGiải tích 1\tL11\t20/12/2026\t07:30\t90\tH1-101\tBK-CS2\tCuối kỳ
2\tPH1003\tVật lý 1\tL12\t22/12/2026\t13:00 - 15:00\t\tH3-301\tBK-CS2\tCuối kỳ
Trình bày từ dòng 1 đến 2 / 2 dòng`;

describe('exam schedule import', () => {
	it('auto-detects dated exams and creates non-recurring Vietnam-time events', async () => {
		const snapshot = await createSourceSnapshot(source, 'auto');
		assert.equal(snapshot.scheduleKind, 'exams');
		assert.equal(snapshot.semester, 261);
		assert.equal(snapshot.events.length, 2);
		const math = snapshot.events.find((event) => event.courseCode === 'MT1003')!;
		assert.equal(math.start, '2026-12-20T00:30:00.000Z');
		assert.equal(math.end, '2026-12-20T02:00:00.000Z');
		assert.equal(math.location, 'H1-101');
		assert.equal(math.metadata.examType, 'Cuối kỳ');
		assert.deepEqual(math.activeWeekIndexes, [0]);
		assert.deepEqual(math.excludedStarts, []);
	});

	it('accepts reordered headers, ISO dates and an explicit semester for table-only copies', async () => {
		const snapshot = await createSourceSnapshot(
			'Môn học\tNgày thi\tPhòng\tGiờ bắt đầu\tThời lượng\tMã môn học\nVẽ kỹ thuật\t2026-12-24\tH6-411\t9h30\t120 phút\tAS1001',
			'student-2024',
			{ scheduleKind: 'exams', semester: 261 }
		);
		assert.equal(snapshot.events[0]?.start, '2026-12-24T02:30:00.000Z');
		assert.equal(snapshot.events[0]?.end, '2026-12-24T04:30:00.000Z');
	});

	it('keeps an exam identity when its date, weekday, time or room changes', async () => {
		const before = await createSourceSnapshot(source, 'auto');
		const after = await createSourceSnapshot(
			source.replace('20/12/2026\t07:30', '21/12/2026\t08:00').replace('H1-101', 'H1-202'),
			'auto'
		);
		const diff = diffSnapshots(before, after);
		assert.equal(diff.changed.length, 1);
		assert.equal(diff.added.length, 0);
		assert.equal(diff.removed.length, 0);
	});

	it('rejects impossible dates and never guesses an exam duration', async () => {
		await assert.rejects(
			createSourceSnapshot(source.replace('20/12/2026', '31/11/2026'), 'auto'),
			/ngày thi|date/iu
		);
		await assert.rejects(
			createSourceSnapshot(source.replace('07:30\t90', '07:30\t'), 'auto'),
			/thời lượng|giờ kết thúc/iu
		);
	});

	it('reads all nine real MyBK exams with their own dates, types and durations', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-exams-20261.md', import.meta.url),
			'utf8'
		);
		const snapshot = await createSourceSnapshot(source, 'student-2024');
		assert.equal(snapshot.scheduleKind, 'exams');
		assert.equal(snapshot.semester, 261);
		assert.equal(snapshot.events.length, 9);
		const exam = snapshot.events.find(
			(event) => event.courseCode === 'MT1003' && event.metadata?.examType === 'GK'
		);
		assert.ok(exam);
		assert.equal(exam.start, '2026-10-13T02:00:00.000Z');
		assert.equal(exam.end, '2026-10-13T02:50:00.000Z');
		assert.equal(exam.title, 'GK · Giải tích 1');
		assert.equal(exam.location, 'H6-802');
		assert.equal(exam.metadata?.campus, 'BK-CS2');
		const cntt = snapshot.events.find((event) => event.courseCode === 'CNTTCB');
		assert.ok(cntt);
		assert.equal(cntt.title, 'CK · Kỹ năng ứng dụng Công nghệ Thông tin cơ bản');
		assert.equal(cntt.group, 'L18_D_Thi');
		assert.ok(snapshot.events.some((event) => event.metadata?.examType === 'CK'));
	});

	it('reads the same MyBK exam columns copied directly as tab-separated text', async () => {
		const markdown = await readFile(
			new URL('../../../fixtures/mybk-exams-20261.md', import.meta.url),
			'utf8'
		);
		const source = markdown
			.trim()
			.split('\n')
			.filter((_, index) => index !== 1)
			.map((line) =>
				line
					.slice(1, -1)
					.split('|')
					.map((cell) => cell.trim())
					.join('\t')
			)
			.join('\n');
		const snapshot = await createSourceSnapshot(source, 'student-2024');
		assert.equal(snapshot.scheduleKind, 'exams');
		assert.equal(snapshot.semester, 261);
		assert.equal(snapshot.events.length, 9);
		assert.ok(snapshot.events.some((event) => event.start === '2026-10-13T02:00:00.000Z'));
	});

	it('distinguishes start and end columns even when the end is first', async () => {
		const snapshot = await createSourceSnapshot(
			'Tên môn học\tNgày thi\tGiờ kết thúc\tGiờ\tPhòng thi\nGiải tích\t20/12/2026\t09:00\t07:30\tH1',
			'auto',
			{ semester: 261 }
		);
		assert.equal(snapshot.events[0]?.start, '2026-12-20T00:30:00.000Z');
		assert.equal(snapshot.events[0]?.end, '2026-12-20T02:00:00.000Z');
		await assert.rejects(createSourceSnapshot(source.replace('07:30', '07:'), 'auto'), /giờ thi/iu);
	});

	it('keeps duplicate-session ordering deterministic and blocks unsafe deletes', async () => {
		const header = 'Tên môn học\tMã MH\tNgày thi\tGiờ thi\tSố phút';
		const rows = [
			'Giải tích\tMT1003\t20/12/2026\t07:30\t90',
			'Giải tích\tMT1003\t22/12/2026\t13:00\t90'
		];
		const options = {
			semester: 261,
			completeness: { state: 'complete' as const, parsedRows: 2, expectedRows: 2 }
		};
		const before = await createSourceSnapshot([header, ...rows].join('\n'), 'auto', options);
		const after = await createSourceSnapshot(
			[header, ...rows.reverse()].join('\n'),
			'auto',
			options
		);
		assert.equal(before.fingerprint, after.fingerprint);
		assert.equal(diffSnapshots(before, after).canDelete, false);
		assert.ok(after.warnings.length > 0);
	});

	it('warns about undated exams and never authorizes deletes for that capture', async () => {
		const snapshot = await createSourceSnapshot(source.replace('20/12/2026', '--'), 'auto', {
			completeness: { state: 'complete', parsedRows: 2, expectedRows: 2 }
		});
		assert.equal(snapshot.events.length, 1);
		assert.match(snapshot.warnings.join(' '), /chưa có ngày thi/iu);
		assert.equal(diffSnapshots(undefined, snapshot).canDelete, false);
	});

	it('stores exams separately from classes in the same source and semester', async () => {
		const values = new Map<string, unknown>();
		const store = createProfileStore({
			async get<T>(key: string) {
				return structuredClone(values.get(key)) as T | undefined;
			},
			async set(key, value) {
				values.set(key, structuredClone(value));
			},
			async remove(key) {
				values.delete(key);
			}
		});
		const exams = await createSourceSnapshot(source, 'auto');
		const staged = await stageSnapshot(store, exams);
		assert.equal(staged.profileId, 'student-2024:261:exams');
		assert.match(staged.profile.calendarName, /lịch thi/iu);
		assert.equal(staged.diff.canDelete, false);
	});
});
