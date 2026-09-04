import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('website footer credit', () => {
	it('credits Heavn and links to the developer website', async () => {
		const source = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');

		assert.match(source, /Dev by/);
		assert.match(source, />Heavn<\/a>/);
		assert.match(source, /href="https:\/\/home\.heavietnam\.com"/);
	});
});
