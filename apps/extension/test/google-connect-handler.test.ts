import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('Google connect popup handler', () => {
	it('does not trigger a MyBK tracking run while completing OAuth', async () => {
		const source = await readFile(new URL('../src/background/index.ts', import.meta.url), 'utf8');
		const block = source.match(
			/if \(message\.type === 'bkalendar:google:connect'\) \{([\s\S]*?)\n\t\}/
		)?.[1];

		assert.ok(block);
		assert.match(block, /requestGoogleToken/);
		assert.doesNotMatch(block, /runBackgroundTracking/);
	});
});
