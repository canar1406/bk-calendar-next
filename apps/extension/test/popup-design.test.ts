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

	it('lets the user choose a polling interval and explains startup tracking', async () => {
		const [html, main] = await Promise.all([
			readFile(htmlPath, 'utf8'),
			readFile(mainPath, 'utf8')
		]);

		assert.match(html, /id="polling-interval"/);
		assert.match(html, /Mỗi 5 phút/);
		assert.match(html, /Mỗi 10 phút/);
		assert.match(html, /ngay khi trình duyệt khởi động/);
		assert.match(main, /bkalendar:polling:set-interval/);
	});

	it('lets the user inspect every supported timetable source without pretending all are tracked', async () => {
		const [html, main] = await Promise.all([
			readFile(htmlPath, 'utf8'),
			readFile(mainPath, 'utf8')
		]);

		assert.match(html, /id="source-kind"/);
		assert.match(html, /value="student-2024"/);
		assert.match(html, /value="student-legacy"/);
		assert.match(html, /value="lecturer"/);
		assert.match(html, /value="postgraduate"/);
		assert.match(html, /id="source-capability"/);
		assert.match(main, /SELECTED_SOURCE_KIND_KEY/);
		assert.match(main, /selectCurrentProfile\(profiles,\s*selectedSourceKind\)/);
		assert.match(main, /statusForSource/);
	});

	it('shows whether the local bridge to the BKalendar website is active', async () => {
		const [html, main] = await Promise.all([
			readFile(htmlPath, 'utf8'),
			readFile(mainPath, 'utf8')
		]);

		assert.match(html, /id="web-sync-section"/);
		assert.match(html, /id="web-bridge-state"/);
		assert.match(html, /Kết nối BKalendar Web/);
		assert.match(html, /Web → Extension/);
		assert.match(html, /Màu môn học · Icon sự kiện · Hồ sơ lịch và Calendar ID/);
		assert.match(html, /Extension → Web/);
		assert.match(html, /Hồ sơ lịch theo từng nguồn · Diff thay đổi · Trạng thái đồng bộ/);
		assert.match(html, /id="web-sync-courses"/);
		assert.match(html, /id="open-web"/);
		assert.match(main, /bkalendar:web-bridge:status:get/);
		assert.match(main, /--course-color/);
		assert.match(main, /summarizeCourseAppearances/);
		assert.ok(
			html.indexOf('id="web-sync-section"') < html.indexOf('id="settings-disclosure"'),
			'web connection must be a standalone section before automation settings'
		);
	});
});
