import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('automatic course appearance tracking', () => {
	it('patches presentation directly after a web appearance save', async () => {
		const source = await readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8');

		assert.match(source, /void syncCourseAppearanceToGoogle\(profileId\)/);
		assert.match(source, /syncManagedPresentation/);
		assert.match(source, /prepareEventsWithCourseAppearance/);
		assert.match(source, /if \(\(await readTrackingMode\(\)\) !== 'auto-safe'\) return/);
	});

	it('does not publish appearance again while hydrating extension state in the web app', async () => {
		const source = await readFile(
			new URL('../../web/src/routes/+page.svelte', import.meta.url),
			'utf8'
		);

		assert.match(source, /loadCourseAppearance\(result, false\)/);
		assert.match(source, /function loadCourseAppearance\(prepared: Prepared, publish = true\)/);
	});
});
