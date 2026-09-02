import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDebouncedTask, type DebounceScheduler } from '../src/content/observe.ts';

describe('content capture scheduling', () => {
	it('collapses rapid DOM changes into one capture', () => {
		let nextHandle = 0;
		const callbacks = new Map<number, () => void>();
		const scheduler: DebounceScheduler = {
			set(callback) {
				nextHandle += 1;
				callbacks.set(nextHandle, callback);
				return nextHandle;
			},
			clear(handle) {
				callbacks.delete(handle);
			}
		};
		let captures = 0;
		const task = createDebouncedTask(
			() => {
				captures += 1;
			},
			250,
			scheduler
		);

		task.schedule();
		task.schedule();
		task.schedule();

		assert.equal(callbacks.size, 1);
		callbacks.values().next().value?.();
		assert.equal(captures, 1);
	});

	it('cancels a pending capture during teardown', () => {
		const callbacks = new Map<number, () => void>();
		const scheduler: DebounceScheduler = {
			set(callback) {
				callbacks.set(1, callback);
				return 1;
			},
			clear(handle) {
				callbacks.delete(handle);
			}
		};
		let captures = 0;
		const task = createDebouncedTask(
			() => {
				captures += 1;
			},
			250,
			scheduler
		);

		task.schedule();
		task.cancel();

		assert.equal(callbacks.size, 0);
		assert.equal(captures, 0);
	});
});
