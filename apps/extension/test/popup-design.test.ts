import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const htmlPath = new URL('../src/popup/index.html', import.meta.url);
const cssPath = new URL('../src/popup/style.css', import.meta.url);
const mainPath = new URL('../src/popup/main.ts', import.meta.url);

describe('extension popup visual structure', () => {
	it('uses a compact topbar and a collapsible automation settings section', async () => {
		const html = await readFile(htmlPath, 'utf8');

		assert.match(html, /class="popup-header"[\s\S]*class="brand"[\s\S]*class="theme-control"/);
		assert.match(html, /<details[^>]*class="settings-disclosure">/);
		assert.match(html, /<summary>[\s\S]*Thiết lập tự động/);
		assert.match(html, /<section class="settings-card"/);
	});

	it('uses layered dark surfaces and readable semantic diff cards', async () => {
		const css = await readFile(cssPath, 'utf8');

		assert.match(css, /--popup-surface-raised:/);
		assert.match(css, /body[\s\S]*width:\s*400px/);
		assert.match(css, /\.diff-details ul[\s\S]*max-height:/);
		assert.match(
			css,
			/:root\[data-theme='dark'\]\s+\.diff-details li\[data-kind='added'\][\s\S]*background:/
		);
		assert.match(css, /:root\[data-theme='dark'\]\s+\.local-badge[\s\S]*background:/);
	});

	it('retries MyBK in the background instead of opening a visible MyBK tab', async () => {
		const [html, main] = await Promise.all([
			readFile(htmlPath, 'utf8'),
			readFile(mainPath, 'utf8')
		]);

		assert.match(html, /<button[^>]*id="primary-action"/);
		assert.equal(/href="https:\/\/mybk\.hcmut\.edu\.vn/.test(html), false);
		assert.equal(/Mở MyBK/.test(html), false);
		assert.match(main, /bkalendar:tracking:run-now/);
	});
});
