import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

describe('course color picker UI', () => {
	it('restores the original color modes and adds per-course controls', async () => {
		const source = await readFile(
			new URL('../src/lib/components/CourseColorPicker.svelte', import.meta.url),
			'utf8'
		);

		assert.match(source, /Màu môn học/);
		assert.match(source, /Một màu/);
		assert.match(source, /Mỗi môn một màu/);
		assert.match(source, /Ngẫu nhiên/);
		assert.match(source, /Chọn bảng phối/);
		assert.match(source, /Google hỗ trợ 11 màu sự kiện/);
		assert.match(source, /palette-library/);
		assert.match(source, /aria-label=.*Đổi màu/);
		assert.match(source, /course-color-swatch/);
		assert.match(source, /Tìm icon/);
		assert.match(source, /Dán emoji bất kỳ/);
	});
});
