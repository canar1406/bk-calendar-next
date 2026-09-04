import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
	SOURCE_OPTIONS,
	normalizeSelectedSourceKind,
	sourceCapabilityText,
	supportsBackgroundTracking
} from '../src/popup/source-selection.ts';

describe('extension timetable source selection', () => {
	it('offers every source supported by the original BKalendar parser flow', () => {
		assert.deepEqual(
			SOURCE_OPTIONS.map(({ sourceKind }) => sourceKind),
			['student-2024', 'student-legacy', 'lecturer', 'postgraduate']
		);
	});

	it('claims background tracking for every source with a concrete configured URL', () => {
		assert.equal(supportsBackgroundTracking('student-2024'), true);
		assert.equal(supportsBackgroundTracking('student-legacy'), true);
		assert.equal(supportsBackgroundTracking('lecturer'), true);
		assert.equal(supportsBackgroundTracking('postgraduate'), true);
		assert.match(sourceCapabilityText('student-2024'), /tự theo dõi.+trong nền/i);
		assert.match(sourceCapabilityText('lecturer'), /tkb\.hcmut\.edu\.vn.+trong nền/i);
		assert.deepEqual(
			SOURCE_OPTIONS.map(({ url }) => url),
			[
				'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb',
				'https://mybk.hcmut.edu.vn/stinfo',
				'https://tkb.hcmut.edu.vn/',
				'https://grad.hcmut.edu.vn/'
			]
		);
	});

	it('falls back safely when persisted source data is invalid', () => {
		assert.equal(normalizeSelectedSourceKind('postgraduate'), 'postgraduate');
		assert.equal(normalizeSelectedSourceKind('unsupported'), 'student-2024');
		assert.equal(normalizeSelectedSourceKind(undefined), 'student-2024');
	});

	it('makes the background runner use the selected source URL instead of a hard-coded MyBK route', async () => {
		const background = await readFile(
			new URL('../src/background/index.ts', import.meta.url),
			'utf8'
		);

		assert.match(background, /const sourceKind = await readSelectedSourceKind\(\)/);
		assert.match(background, /const source = sourceOptionFor\(sourceKind\)/);
		assert.match(background, /url: source\.url/);
		assert.doesNotMatch(background, /url: MYBK_TIMETABLE_URL/);
	});
});
