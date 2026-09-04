import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GoogleCalendarApiError } from '../../../packages/google-calendar/src/index.ts';
import {
	syncPresentationWithCalendarRecovery,
	throwIfCalendarMissing
} from '../src/background/presentation-recovery.ts';

describe('presentation sync calendar recovery', () => {
	it('recovers a stale calendar ID after a 404 and retries once', async () => {
		const calls: string[] = [];
		const synced = await syncPresentationWithCalendarRecovery({
			calendarId: 'old-calendar',
			async sync(calendarId) {
				calls.push(`sync:${calendarId}`);
				if (calendarId === 'old-calendar') throw new GoogleCalendarApiError(404, 'Not Found');
				return { patched: 3 };
			},
			async recover() {
				calls.push('recover');
				return 'new-calendar';
			}
		});

		assert.deepEqual(calls, ['sync:old-calendar', 'recover', 'sync:new-calendar']);
		assert.deepEqual(synced, {
			calendarId: 'new-calendar',
			result: { patched: 3 }
		});
	});

	it('does not retry non-404 Google failures', async () => {
		let recoverCalls = 0;
		await assert.rejects(
			syncPresentationWithCalendarRecovery({
				calendarId: 'calendar',
				async sync() {
					throw new GoogleCalendarApiError(403, 'Permission denied');
				},
				async recover() {
					recoverCalls += 1;
					return 'unused';
				}
			}),
			/403/
		);
		assert.equal(recoverCalls, 0);
	});

	it('turns a caught per-event 404 into a recoverable calendar error', () => {
		assert.throws(
			() =>
				throwIfCalendarMissing([
					{ message: 'Google Calendar API 404: {"error":{"message":"Not Found"}}' }
				]),
			(error: unknown) => error instanceof GoogleCalendarApiError && error.status === 404
		);
		assert.doesNotThrow(() =>
			throwIfCalendarMissing([{ message: 'Google Calendar API 403: Permission denied' }])
		);
	});
});
