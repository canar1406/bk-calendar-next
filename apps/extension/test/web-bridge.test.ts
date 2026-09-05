import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	PROFILE_STORAGE_KEY,
	REVIEW_ORIGIN,
	REVIEW_PATH_PREFIX,
	createLocalExtensionState,
	handleExtensionTransferMessage,
	selectNewestPendingSnapshot
} from '../src/bridge/web-review.ts';
import type {
	ExtensionStateReply,
	ExtensionTransferResponse,
	TimetableSnapshot
} from '../../../packages/timetable/src/index.ts';

const olderSnapshot = snapshot('2026-09-01T01:00:00.000Z', 'older');
const newerSnapshot = snapshot('2026-09-03T01:00:00.000Z', 'newer');

describe('extension-to-web review bridge', () => {
	it('selects the newest profile that has a pending snapshot', () => {
		const selected = selectNewestPendingSnapshot([
			{
				profileId: 'without-pending',
				lastCheckedAt: '2026-09-04T01:00:00.000Z'
			},
			{
				profileId: 'older',
				lastCheckedAt: '2026-09-01T01:00:00.000Z',
				pendingSnapshot: olderSnapshot
			},
			{
				profileId: 'newer',
				lastCheckedAt: '2026-09-03T01:00:00.000Z',
				pendingSnapshot: {
					...newerSnapshot,
					accessToken: 'nested-token-must-never-be-exposed'
				},
				accessToken: 'must-never-be-exposed'
			}
		]);

		assert.deepEqual(selected, newerSnapshot);
		assert.equal(JSON.stringify(selected).includes('must-never-be-exposed'), false);
	});

	it('responds to a valid page request with the matching nonce and newest snapshot', async () => {
		const source = {} as MessageEventSource;
		const responses: Array<ExtensionTransferResponse | ExtensionStateReply> = [];
		let storageReads = 0;

		const handled = await handleExtensionTransferMessage(
			{
				source,
				origin: REVIEW_ORIGIN,
				data: {
					source: 'bkalendar-web',
					type: 'bkalendar:request-pending-snapshot',
					version: 1,
					requestId: 'nonce-123'
				}
			},
			{
				windowSource: source,
				origin: REVIEW_ORIGIN,
				pathname: `${REVIEW_PATH_PREFIX}review`,
				async readProfiles() {
					storageReads += 1;
					return [
						{ lastCheckedAt: '2026-09-01T01:00:00.000Z', pendingSnapshot: olderSnapshot },
						{ lastCheckedAt: '2026-09-03T01:00:00.000Z', pendingSnapshot: newerSnapshot }
					];
				},
				postResponse(response) {
					responses.push(response);
				}
			}
		);

		assert.equal(handled, true);
		assert.equal(storageReads, 1);
		assert.deepEqual(responses, [
			{
				source: 'bkalendar-extension',
				type: 'bkalendar:pending-snapshot',
				version: 1,
				requestId: 'nonce-123',
				status: 'ready',
				snapshot: newerSnapshot
			}
		]);
	});

	it('responds with the complete sanitized extension state', async () => {
		const source = {} as MessageEventSource;
		const responses: Array<ExtensionTransferResponse | ExtensionStateReply> = [];
		const state = createLocalExtensionState(
			[
				{
					schemaVersion: 1,
					profileId: 'student-2024:261',
					sourceKind: 'student-2024',
					semester: 261,
					calendarName: 'BKalendar • HK 261',
					acceptedSnapshot: snapshot('2026-09-04T01:00:00.000Z', 'accepted'),
					accessToken: 'must-not-reach-state'
				}
			],
			{ state: 'idle' },
			'2026-09-04T01:00:00.000Z'
		);

		const handled = await handleExtensionTransferMessage(
			{
				source,
				origin: REVIEW_ORIGIN,
				data: {
					source: 'bkalendar-web',
					type: 'bkalendar:request-state',
					version: 1,
					requestId: 'state-123'
				}
			},
			{
				windowSource: source,
				origin: REVIEW_ORIGIN,
				pathname: REVIEW_PATH_PREFIX,
				async readProfiles() {
					return [];
				},
				async readExtensionState() {
					return state;
				},
				postResponse(response) {
					responses.push(response);
				}
			}
		);

		assert.equal(handled, true);
		assert.deepEqual(responses, [
			{
				source: 'bkalendar-extension',
				type: 'bkalendar:state',
				version: 1,
				requestId: 'state-123',
				status: 'ready',
				state
			}
		]);
		assert.equal(JSON.stringify(responses).includes('must-not-reach-state'), false);
	});

	it('hydrates the synchronized theme from trusted local extension storage', () => {
		const state = createLocalExtensionState([], { state: 'idle' }, '2026-09-04T01:00:00.000Z', {
			'bkalendar-next:theme': 'system',
			'bkalendar-next:theme-resolved': 'dark'
		});

		assert.equal(state.theme, 'system');
		assert.equal(state.resolvedTheme, 'dark');
	});

	it('includes only course appearance records from extension storage', () => {
		const preferences = {
			schemaVersion: 1,
			mode: 'course',
			seed: 2,
			monoColorId: '7',
			overrides: { MT1003: '5' },
			icons: { MT1003: '🧮' }
		};
		const state = createLocalExtensionState([], { state: 'idle' }, '2026-09-04T16:00:00.000Z', {
			'bkalendar-next:course-colors:student-2024%3A261': preferences,
			'bkalendar-next:mybk-credentials': { ciphertext: 'secret' }
		});

		assert.deepEqual(state.appearances, {
			'bkalendar-next:course-colors:student-2024%3A261': preferences
		});
		assert.equal(JSON.stringify(state).includes('ciphertext'), false);
	});

	it('accepts a newer web profile without allowing token fields into extension storage', async () => {
		const source = {} as MessageEventSource;
		const writes: unknown[] = [];
		const profile = {
			schemaVersion: 1 as const,
			profileId: 'student-2024:261',
			sourceKind: 'student-2024' as const,
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			lastCheckedAt: '2026-09-05T01:00:00.000Z',
			accessToken: 'must-not-be-written'
		};

		const handled = await handleExtensionTransferMessage(
			{
				source,
				origin: REVIEW_ORIGIN,
				data: {
					source: 'bkalendar-web',
					type: 'bkalendar:sync-profile',
					version: 1,
					profile
				}
			},
			{
				windowSource: source,
				origin: REVIEW_ORIGIN,
				pathname: REVIEW_PATH_PREFIX,
				async readProfiles() {
					return [];
				},
				async writeProfile(value) {
					writes.push(value);
				},
				postResponse() {}
			}
		);

		assert.equal(handled, true);
		assert.deepEqual(writes, [
			{
				schemaVersion: 1,
				profileId: 'student-2024:261',
				sourceKind: 'student-2024',
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-05T01:00:00.000Z'
			}
		]);
	});

	it('returns an explicit empty response when no pending snapshot exists', async () => {
		const source = {} as MessageEventSource;
		const responses: Array<ExtensionTransferResponse | ExtensionStateReply> = [];

		const handled = await handleExtensionTransferMessage(
			{
				source,
				origin: REVIEW_ORIGIN,
				data: {
					source: 'bkalendar-web',
					type: 'bkalendar:request-pending-snapshot',
					version: 1,
					requestId: 'empty-nonce'
				}
			},
			{
				windowSource: source,
				origin: REVIEW_ORIGIN,
				pathname: REVIEW_PATH_PREFIX,
				async readProfiles() {
					return [{ profileId: 'no-pending', accessToken: 'secret' }];
				},
				postResponse(response) {
					responses.push(response);
				}
			}
		);

		assert.equal(handled, true);
		assert.deepEqual(responses, [
			{
				source: 'bkalendar-extension',
				type: 'bkalendar:pending-snapshot',
				version: 1,
				requestId: 'empty-nonce',
				status: 'empty'
			}
		]);
	});

	it('stores valid course appearance settings posted by the official web app', async () => {
		const source = {} as MessageEventSource;
		const writes: Array<{ profileId: string; preferences: unknown }> = [];
		const preferences = {
			schemaVersion: 1,
			mode: 'course',
			seed: 2,
			monoColorId: '7',
			overrides: { MT1003: '5' },
			icons: { MT1003: '🧮' }
		};

		const handled = await handleExtensionTransferMessage(
			{
				source,
				origin: REVIEW_ORIGIN,
				data: {
					source: 'bkalendar-web',
					type: 'bkalendar:course-appearance',
					version: 1,
					profileId: 'student-2024:261',
					preferences
				}
			},
			{
				windowSource: source,
				origin: REVIEW_ORIGIN,
				pathname: REVIEW_PATH_PREFIX,
				async readProfiles() {
					throw new Error('course appearance transfer must not read timetable profiles');
				},
				async writeCourseAppearance(profileId, value) {
					writes.push({ profileId, preferences: value });
				},
				postResponse() {}
			}
		);

		assert.equal(handled, true);
		assert.deepEqual(writes, [{ profileId: 'student-2024:261', preferences }]);
	});

	it('ignores requests from another window, origin, path, or invalid protocol envelope', async () => {
		const source = {} as MessageEventSource;
		const otherSource = {} as MessageEventSource;
		const validRequest = {
			source: 'bkalendar-web',
			type: 'bkalendar:request-pending-snapshot',
			version: 1,
			requestId: 'secure-nonce'
		};
		let storageReads = 0;
		let responseCount = 0;
		const baseContext = {
			windowSource: source,
			origin: REVIEW_ORIGIN,
			pathname: REVIEW_PATH_PREFIX,
			async readProfiles() {
				storageReads += 1;
				return [];
			},
			postResponse() {
				responseCount += 1;
			}
		};

		assert.equal(
			await handleExtensionTransferMessage(
				{ source: otherSource, origin: REVIEW_ORIGIN, data: validRequest },
				baseContext
			),
			false
		);
		assert.equal(
			await handleExtensionTransferMessage(
				{ source, origin: 'https://evil.example', data: validRequest },
				baseContext
			),
			false
		);
		assert.equal(
			await handleExtensionTransferMessage(
				{ source, origin: REVIEW_ORIGIN, data: validRequest },
				{ ...baseContext, origin: 'https://evil.example' }
			),
			false
		);
		assert.equal(
			await handleExtensionTransferMessage(
				{ source, origin: REVIEW_ORIGIN, data: validRequest },
				{ ...baseContext, pathname: '/bk-calendar-next-evil/' }
			),
			false
		);
		assert.equal(
			await handleExtensionTransferMessage(
				{ source, origin: REVIEW_ORIGIN, data: { ...validRequest, requestId: '' } },
				baseContext
			),
			false
		);
		assert.equal(storageReads, 0);
		assert.equal(responseCount, 0);
	});

	it('uses only the local profile storage key', () => {
		assert.equal(PROFILE_STORAGE_KEY, 'bkalendar-next:profiles');
	});
});

function snapshot(capturedAt: string, fingerprint: string): TimetableSnapshot {
	return {
		schemaVersion: 1,
		sourceKind: 'student-2024',
		semester: 261,
		capturedAt,
		fingerprint,
		events: [],
		warnings: []
	};
}
