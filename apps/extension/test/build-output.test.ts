import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('extension build outputs', () => {
	it('emits classic scripts for MV3 content scripts', async () => {
		const content = await readFile(new URL('../dist/content.js', import.meta.url), 'utf8');
		const webReview = await readFile(new URL('../dist/web-review.js', import.meta.url), 'utf8');

		assert.doesNotMatch(content, /\bimport\s*[{('""]/);
		assert.doesNotMatch(webReview, /\bimport\s*[{('""]/);
		assert.doesNotMatch(content, /\bexport\s*(?:default\s+)?[{(]/);
		assert.doesNotMatch(webReview, /\bexport\s*(?:default\s+)?[{(]/);
	});
});
