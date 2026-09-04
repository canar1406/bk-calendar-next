import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	DEFAULT_POLLING_INTERVAL_MINUTES,
	POLLING_INTERVAL_OPTIONS,
	isPollingIntervalMinutes,
	normalizePollingIntervalMinutes
} from '../src/background/polling.ts';

describe('MyBK polling preference', () => {
	it('offers practical polling intervals and a stable default', () => {
		assert.deepEqual(POLLING_INTERVAL_OPTIONS, [5, 10, 15, 30, 60]);
		assert.equal(DEFAULT_POLLING_INTERVAL_MINUTES, 10);
	});

	it('normalizes only supported persisted intervals', () => {
		assert.equal(normalizePollingIntervalMinutes(5), 5);
		assert.equal(normalizePollingIntervalMinutes('15'), 15);
		assert.equal(normalizePollingIntervalMinutes(30), 30);
		assert.equal(normalizePollingIntervalMinutes(1), DEFAULT_POLLING_INTERVAL_MINUTES);
		assert.equal(normalizePollingIntervalMinutes(undefined), DEFAULT_POLLING_INTERVAL_MINUTES);
		assert.equal(isPollingIntervalMinutes(60), true);
		assert.equal(isPollingIntervalMinutes(7), false);
	});
});
