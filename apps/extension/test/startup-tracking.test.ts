import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('background startup tracking', () => {
	it('checks MyBK immediately when the browser starts', async () => {
		const source = await readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8');
		const startupBlock = source.match(
			/chrome\.runtime\.onStartup\.addListener\(\(\) => \{([\s\S]*?)\n\}\);/
		)?.[1];
		const handlerBlock = source.match(
			/async function handleStartup\(\): Promise<void> \{([\s\S]*?)\n\}/
		)?.[1];

		assert.ok(startupBlock);
		assert.match(startupBlock, /handleStartup/);
		assert.ok(handlerBlock);
		assert.match(handlerBlock, /initializeExtension/);
		assert.match(handlerBlock, /runBackgroundTracking/);
	});
});
