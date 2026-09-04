import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('automatic course appearance tracking', () => {
	it('reacts to course color and icon storage changes', async () => {
		const source = await readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8');

		assert.match(source, /hasAppearanceChange\(changes\)/);
		assert.match(source, /void runAutomaticPresentationCheck\(\)/);
		assert.match(source, /if \(\(await readTrackingMode\(\)\) !== 'auto-safe'\) return/);
		assert.match(source, /await runBackgroundTracking\(\)/);
	});
});
