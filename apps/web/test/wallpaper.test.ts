import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSourceSnapshot } from '../../../packages/core/src/index.ts';
import {
	buildWallpaperModel,
	wrapWallpaperText,
	WALLPAPER_FORMATS,
	WALLPAPER_MASCOTS,
	WALLPAPER_THEMES
} from '../src/lib/wallpaper.ts';
import { readFile } from 'node:fs/promises';
import { courseIdentity } from '../src/lib/course-colors.ts';

describe('schedule wallpaper export', () => {
	it('wraps long room identifiers instead of truncating an otherwise fitting location', () => {
		const room = 'CS2-NHATHIDAU-SAN1';
		const lines = wrapWallpaperText(room, 10, (value) => value.length, 2);
		assert.equal(lines.join(''), room);
		assert.ok(lines.every((line) => line.length <= 10));
		assert.ok(
			wrapWallpaperText('Tên môn học rất dài', 5, (value) => value.length, 1)[0]?.endsWith('…')
		);
	});

	it('uses exact wallpaper dimensions and only the explicitly selected class week', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-student-20261-week36.txt', import.meta.url),
			'utf8'
		);
		const snapshot = await createSourceSnapshot(source, 'student-2024');
		const model = buildWallpaperModel(snapshot, {
			format: 'phone',
			theme: 'dark',
			weekKey: '2026-08-31'
		});
		assert.equal(model.width, 1080);
		assert.equal(model.height, 2400);
		assert.deepEqual(model.events.map((event) => event.courseCode).sort(), ['AS1002', 'PE1013']);
		assert.match(model.subtitle, /36/u);
		assert.match(model.filename, /\.png$/u);
		assert.ok(WALLPAPER_FORMATS.desktop.width > WALLPAPER_FORMATS.desktop.height);
	});

	it('includes all dated exams rather than silently exporting only one week', async () => {
		const snapshot = await createSourceSnapshot(
			'Học kỳ 1 Năm học 2026 - 2027\nMã MH\tTên môn học\tNgày thi\tGiờ thi\tSố phút\tPhòng thi\nMT1003\tGiải tích\t20/12/2026\t07:30\t90\tH1\nPH1003\tVật lý\t30/12/2026\t13:00\t120\tH3',
			'auto'
		);
		const model = buildWallpaperModel(snapshot, { format: 'desktop', theme: 'light' });
		assert.equal(model.events.length, 2);
		assert.match(model.title, /LỊCH THI/u);
		assert.equal(model.width, 2560);
		assert.equal(model.height, 1440);
	});

	it('keeps configured course colors and icons without mutating the source snapshot', async () => {
		const snapshot = await createSourceSnapshot(
			'Tên môn học\tMã MH\tNgày thi\tGiờ thi\tSố phút\nGiải tích\tMT1003\t20/12/2026\t07:30\t90',
			'auto',
			{ semester: 261 }
		);
		const identity = courseIdentity(snapshot.events[0]!);
		const original = structuredClone(snapshot);
		const model = buildWallpaperModel(snapshot, {
			format: 'phone',
			colorAssignments: { [identity]: '11' },
			courseIcons: { [identity]: '📘' }
		});
		assert.equal(model.events[0]?.colorId, '11');
		assert.equal(model.events[0]?.icon, '📘');
		assert.deepEqual(snapshot, original);
	});

	it('refuses sample and empty snapshots instead of downloading a misleading image', async () => {
		const snapshot = {
			schemaVersion: 1 as const,
			sourceKind: 'student-2024' as const,
			semester: 261,
			capturedAt: '',
			fingerprint: '',
			warnings: [],
			events: []
		};
		assert.throws(
			() => buildWallpaperModel({ ...snapshot, provenance: 'sample' }, { format: 'phone' }),
			/mẫu/iu
		);
		assert.throws(() => buildWallpaperModel(snapshot, { format: 'phone' }), /chưa có|không có/iu);
	});

	it('never silently substitutes a different week or includes a cancelled occurrence', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-student-20261-week36.txt', import.meta.url),
			'utf8'
		);
		const snapshot = await createSourceSnapshot(source, 'student-2024');
		assert.throws(
			() => buildWallpaperModel(snapshot, { format: 'phone', weekKey: '2026-01-01' }),
			/tuần/iu
		);
		const excluded = {
			...snapshot,
			events: snapshot.events.map((event) => ({
				...event,
				activeWeekIndexes: [0],
				excludedStarts: [event.start]
			}))
		};
		assert.throws(() => buildWallpaperModel(excluded, { format: 'phone' }), /không có|chưa có/iu);
	});

	it('supports Wibu anime themes, mascots, mottos and bounded custom background overlay', async () => {
		const source = await readFile(
			new URL('../../../fixtures/mybk-exams-20261.md', import.meta.url),
			'utf8'
		);
		const snapshot = await createSourceSnapshot(source, 'student-2024');
		const model = buildWallpaperModel(snapshot, {
			format: 'desktop',
			theme: 'sakura',
			mascot: 'neko',
			motto: 'Quyết tâm qua môn A+!',
			examPhase: 'final',
			overlayOpacity: 0.99
		});
		assert.equal(model.theme, 'sakura');
		assert.equal(model.mascot, 'neko');
		assert.equal(model.motto, 'Quyết tâm qua môn A+!');
		assert.equal(model.examPhase, 'final');
		assert.equal(model.title, 'LỊCH THI CUỐI KỲ');
		assert.equal(model.events.length, 5);
		assert.ok(model.events.every((event) => event.metadata?.examType === 'CK'));
		assert.equal(model.overlayOpacity, 0.88);
		assert.match(model.filename, /sakura\.png$/u);

		const midtermModel = buildWallpaperModel(snapshot, {
			format: 'phone',
			theme: 'attackontitan',
			examPhase: 'midterm'
		});
		assert.equal(midtermModel.examPhase, 'midterm');
		assert.equal(midtermModel.title, 'LỊCH THI GIỮA KỲ');
		assert.equal(midtermModel.events.length, 4);
		assert.ok(midtermModel.events.every((event) => event.metadata?.examType === 'GK'));
		assert.ok(
			'naruto' in WALLPAPER_THEMES &&
				'dragonball' in WALLPAPER_THEMES &&
				'onepiece' in WALLPAPER_THEMES &&
				'kimetsu' in WALLPAPER_THEMES &&
				'jujutsu' in WALLPAPER_THEMES &&
				'attackontitan' in WALLPAPER_THEMES &&
				'doraemon' in WALLPAPER_THEMES &&
				'conan' in WALLPAPER_THEMES &&
				'pokemon' in WALLPAPER_THEMES &&
				'sailormoon' in WALLPAPER_THEMES &&
				'shinkai' in WALLPAPER_THEMES &&
				'akihabara' in WALLPAPER_THEMES
		);
		assert.ok(
			'auto' in WALLPAPER_MASCOTS &&
				'kitsune' in WALLPAPER_MASCOTS &&
				'magic-circle' in WALLPAPER_MASCOTS
		);
	});
});
