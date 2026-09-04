import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createCaptureStatus,
	createErrorStatus,
	type ExtensionStatus
} from '../src/background/status.ts';
import type { MyBkCapture } from '../src/content/extract.ts';

describe('extension capture status', () => {
	it('stores a privacy-minimized summary instead of raw timetable text', () => {
		const capture: MyBkCapture = {
			raw: '20261\tMT1003\tGiải tích 1',
			sourceUpdatedAt: '2026-08-28T14:57:54+07:00',
			completeness: { state: 'incomplete', parsedRows: 2, expectedRows: 11 }
		};

		const status = createCaptureStatus(capture, '2026-09-03T01:00:00.000Z');

		assert.deepEqual(status, {
			state: 'captured',
			capturedAt: '2026-09-03T01:00:00.000Z',
			sourceUpdatedAt: '2026-08-28T14:57:54+07:00',
			completeness: { state: 'incomplete', parsedRows: 2, expectedRows: 11 }
		});
		assert.equal('raw' in status, false);
	});

	it('normalizes extraction failures into a user-safe status', () => {
		const status: ExtensionStatus = createErrorStatus(
			new Error('MyBK không chuyển đến trang đăng nhập HCMUT CAS.'),
			'2026-09-03T01:00:00.000Z'
		);

		assert.deepEqual(status, {
			state: 'error',
			checkedAt: '2026-09-03T01:00:00.000Z',
			message: 'MyBK không chuyển đến trang đăng nhập HCMUT CAS.'
		});
	});

	it('does not expose low-level fetch details or credentials in an error status', () => {
		const status = createErrorStatus(
			new TypeError('Failed to fetch password=secret'),
			'2026-09-03T01:00:00.000Z'
		);

		assert.deepEqual(status, {
			state: 'error',
			checkedAt: '2026-09-03T01:00:00.000Z',
			message:
				'Không thể kết nối MyBK trong nền. Hãy kiểm tra mạng và quyền truy cập của extension.'
		});
	});

	it('stores only safe change counts for the popup review', () => {
		const capture: MyBkCapture = {
			raw: 'raw timetable that must not enter status',
			completeness: { state: 'complete', parsedRows: 2, expectedRows: 2 }
		};
		const status = createCaptureStatus(capture, '2026-09-02T01:00:00.000Z', {
			added: 1,
			changed: 1,
			removed: 0,
			unchanged: 3,
			canDelete: true
		});

		assert.deepEqual(status, {
			state: 'captured',
			capturedAt: '2026-09-02T01:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 2, expectedRows: 2 },
			changes: {
				added: 1,
				changed: 1,
				removed: 0,
				unchanged: 3,
				canDelete: true
			}
		});
		assert.equal(JSON.stringify(status).includes(capture.raw), false);
	});

	it('records when a complete diff was already applied automatically', () => {
		const capture: MyBkCapture = {
			raw: 'never persist this raw value',
			completeness: { state: 'complete', parsedRows: 1, expectedRows: 1 }
		};
		const status = createCaptureStatus(
			capture,
			'2026-09-03T01:00:00.000Z',
			{ added: 1, changed: 0, removed: 0, unchanged: 7, canDelete: true },
			'applied'
		);

		assert.equal(status.state, 'captured');
		assert.equal(status.syncState, 'applied');
		assert.equal(JSON.stringify(status).includes(capture.raw), false);
	});
});
