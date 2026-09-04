import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('timetable source selector', () => {
	it('exposes all timetable types supported by the original BKalendar flow', async () => {
		const source = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');

		assert.match(source, /id="schedule-source"/);
		assert.match(source, /sinh viên \(mybk\.hcmut\.edu\.vn\/app\)/i);
		assert.match(source, /sinh viên \(mybk\.hcmut\.edu\.vn\/stinfo\)/i);
		assert.match(source, /giảng viên \(tkb\.hcmut\.edu\.vn\)/i);
		assert.match(source, /sau đại học \(grad\.hcmut\.edu\.vn\)/i);
		assert.match(source, /sourceKind/);
	});
});
