import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const pagePath = new URL('../src/routes/+page.svelte', import.meta.url);

describe('web extension introduction', () => {
	it('explains the background tracker and links to the installation source', async () => {
		const source = await readFile(pagePath, 'utf8');

		assert.match(source, /id="extension-intro"/);
		assert.match(source, /Theo dõi MyBK tự động/);
		assert.match(source, /Tự động cập nhật Google Calendar/);
		assert.match(source, /Không gửi mật khẩu lên máy chủ BKalendar/);
		assert.match(source, /github\.com\/canar1406\/bk-calendar-next/);
		assert.match(source, /Chrome · Edge · MV3/);
		assert.match(source, /Bạn luôn kiểm soát/);
	});
});
