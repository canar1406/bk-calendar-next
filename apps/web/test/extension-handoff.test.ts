import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createExtensionTransferEmptyResponse,
	createExtensionTransferResponse,
	createExtensionStateResponse,
	createExtensionStateUpdate,
	createSnapshot
} from '../../../packages/timetable/src/index.ts';
import {
	publishCourseAppearanceToExtension,
	publishProfileToExtension,
	requestExtensionStateFromExtension,
	requestPendingSnapshotFromExtension,
	subscribeToExtensionState,
	type ExtensionMessageEvent,
	type ExtensionMessageWindow,
	type ExtensionTransferTimers
} from '../src/lib/extension-handoff.ts';
import { defaultCourseColorPreferences } from '../src/lib/course-colors.ts';

class FakeWindow implements ExtensionMessageWindow {
	readonly location: { origin: string; search: string };
	readonly posted: Array<{ message: unknown; targetOrigin: string }> = [];
	private readonly listeners = new Set<(event: ExtensionMessageEvent) => void>();

	constructor(search = '?from=extension', origin = 'https://canar1406.github.io') {
		this.location = { origin, search };
	}

	addEventListener(_type: 'message', listener: (event: ExtensionMessageEvent) => void): void {
		this.listeners.add(listener);
	}

	removeEventListener(_type: 'message', listener: (event: ExtensionMessageEvent) => void): void {
		this.listeners.delete(listener);
	}

	postMessage(message: unknown, targetOrigin: string): void {
		this.posted.push({ message, targetOrigin });
	}

	emit(data: unknown, options: { origin?: string; source?: unknown } = {}): void {
		const event: ExtensionMessageEvent = {
			data,
			origin: options.origin ?? this.location.origin,
			source: options.source ?? this
		};
		for (const listener of [...this.listeners]) listener(event);
	}

	get listenerCount(): number {
		return this.listeners.size;
	}
}

class FakeTimers implements ExtensionTransferTimers {
	private now = 0;
	private nextId = 1;
	private readonly tasks = new Map<number, { at: number; callback: () => void }>();

	setTimeout(callback: () => void, delayMs: number): number {
		const id = this.nextId++;
		this.tasks.set(id, { at: this.now + delayMs, callback });
		return id;
	}

	clearTimeout(handle: unknown): void {
		this.tasks.delete(handle as number);
	}

	advanceBy(delayMs: number): void {
		const target = this.now + delayMs;
		while (true) {
			const next = [...this.tasks.entries()]
				.filter(([, task]) => task.at <= target)
				.sort(([, a], [, b]) => a.at - b.at)[0];
			if (!next) break;
			const [id, task] = next;
			this.tasks.delete(id);
			this.now = task.at;
			task.callback();
		}
		this.now = target;
	}

	get pendingCount(): number {
		return this.tasks.size;
	}
}

describe('extension-to-web browser handoff', () => {
	it('requests the complete local extension state without requiring an extension URL flag', async () => {
		const targetWindow = new FakeWindow('?semester=261');
		const timers = new FakeTimers();
		const state = extensionState();

		const pending = requestExtensionStateFromExtension({
			targetWindow,
			timers,
			requestId: 'state-request',
			retryIntervalMs: 10,
			timeoutMs: 30
		});

		assert.deepEqual(targetWindow.posted[0], {
			message: {
				source: 'bkalendar-web',
				type: 'bkalendar:request-state',
				version: 1,
				requestId: 'state-request'
			},
			targetOrigin: 'https://canar1406.github.io'
		});
		targetWindow.emit(createExtensionStateResponse('state-request', state));

		assert.deepEqual(await pending, { status: 'ready', state });
		assert.equal(targetWindow.listenerCount, 0);
		assert.equal(timers.pendingCount, 0);
	});

	it('subscribes to same-window extension state updates and ignores untrusted events', () => {
		const targetWindow = new FakeWindow();
		const received: string[] = [];
		const unsubscribe = subscribeToExtensionState(targetWindow, (state) => {
			received.push(state.updatedAt);
		});
		const state = extensionState();

		targetWindow.emit(createExtensionStateUpdate(state), { origin: 'https://evil.example' });
		targetWindow.emit(createExtensionStateUpdate(state), { source: {} });
		targetWindow.emit(createExtensionStateUpdate(state));
		assert.deepEqual(received, [state.updatedAt]);

		unsubscribe();
		targetWindow.emit(createExtensionStateUpdate({ ...state, updatedAt: 'later' }));
		assert.deepEqual(received, [state.updatedAt]);
	});

	it('publishes profile-specific course appearance settings to the installed extension', () => {
		const targetWindow = new FakeWindow('?semester=261');
		const preferences = {
			...defaultCourseColorPreferences(),
			overrides: { MT1003: '5' },
			icons: { MT1003: '🧮' }
		};

		publishCourseAppearanceToExtension({
			targetWindow,
			profileId: 'student-2024:261',
			preferences
		});

		assert.deepEqual(targetWindow.posted, [
			{
				message: {
					source: 'bkalendar-web',
					type: 'bkalendar:course-appearance',
					version: 1,
					profileId: 'student-2024:261',
					preferences
				},
				targetOrigin: 'https://canar1406.github.io'
			}
		]);
	});

	it('publishes a profile snapshot to the installed extension without token fields', () => {
		const targetWindow = new FakeWindow('?semester=261');
		publishProfileToExtension({
			targetWindow,
			profile: {
				schemaVersion: 1,
				profileId: 'student-2024:261',
				sourceKind: 'student-2024',
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-04T16:00:00.000Z'
			}
		});

		assert.deepEqual(targetWindow.posted[0], {
			message: {
				source: 'bkalendar-web',
				type: 'bkalendar:sync-profile',
				version: 1,
				profile: {
					schemaVersion: 1,
					profileId: 'student-2024:261',
					sourceKind: 'student-2024',
					semester: 261,
					calendarName: 'BKalendar • HK 261',
					lastCheckedAt: '2026-09-04T16:00:00.000Z'
				}
			},
			targetOrigin: 'https://canar1406.github.io'
		});
	});

	it('does nothing unless the URL explicitly comes from the extension', async () => {
		const targetWindow = new FakeWindow('?semester=261');
		const timers = new FakeTimers();

		const result = await requestPendingSnapshotFromExtension({
			targetWindow,
			timers,
			requestId: 'request-123'
		});

		assert.deepEqual(result, { status: 'skipped' });
		assert.equal(targetWindow.posted.length, 0);
		assert.equal(targetWindow.listenerCount, 0);
		assert.equal(timers.pendingCount, 0);
	});

	it('accepts a same-window, same-origin ready response with the matching nonce', async () => {
		const targetWindow = new FakeWindow();
		const timers = new FakeTimers();
		const snapshot = await createSnapshot({
			sourceKind: 'student-2024',
			semester: 261,
			capturedAt: '2026-09-03T00:00:00.000Z',
			warnings: [],
			events: []
		});

		const pending = requestPendingSnapshotFromExtension({
			targetWindow,
			timers,
			requestId: 'request-123',
			retryIntervalMs: 10,
			timeoutMs: 30
		});

		assert.deepEqual(targetWindow.posted, [
			{
				message: {
					source: 'bkalendar-web',
					type: 'bkalendar:request-pending-snapshot',
					version: 1,
					requestId: 'request-123'
				},
				targetOrigin: 'https://canar1406.github.io'
			}
		]);
		assert.equal('snapshot' in (targetWindow.posted[0]?.message as object), false);

		targetWindow.emit(createExtensionTransferResponse('request-123', snapshot));

		assert.deepEqual(await pending, { status: 'ready', snapshot });
		assert.equal(targetWindow.listenerCount, 0);
		assert.equal(timers.pendingCount, 0);
	});

	it('ignores responses from another origin, window, or request nonce', async () => {
		const targetWindow = new FakeWindow();
		const timers = new FakeTimers();
		const snapshot = await createSnapshot({
			sourceKind: 'student-2024',
			semester: 261,
			capturedAt: '2026-09-03T00:00:00.000Z',
			warnings: [],
			events: []
		});
		const pending = requestPendingSnapshotFromExtension({
			targetWindow,
			timers,
			requestId: 'request-123',
			retryIntervalMs: 10,
			timeoutMs: 30
		});

		targetWindow.emit(createExtensionTransferResponse('request-123', snapshot), {
			origin: 'https://attacker.example'
		});
		targetWindow.emit(createExtensionTransferResponse('request-123', snapshot), {
			source: {}
		});
		targetWindow.emit(createExtensionTransferResponse('request-456', snapshot));
		assert.equal(targetWindow.listenerCount, 1);

		targetWindow.emit(createExtensionTransferResponse('request-123', snapshot));
		assert.equal((await pending).status, 'ready');
	});

	it('distinguishes an installed extension with no pending snapshot', async () => {
		const targetWindow = new FakeWindow();
		const timers = new FakeTimers();
		const pending = requestPendingSnapshotFromExtension({
			targetWindow,
			timers,
			requestId: 'request-123'
		});

		targetWindow.emit(createExtensionTransferEmptyResponse('request-123'));

		assert.deepEqual(await pending, { status: 'empty' });
		assert.equal(targetWindow.listenerCount, 0);
		assert.equal(timers.pendingCount, 0);
	});

	it('retries briefly, then times out and cleans every listener and timer', async () => {
		const targetWindow = new FakeWindow();
		const timers = new FakeTimers();
		const pending = requestPendingSnapshotFromExtension({
			targetWindow,
			timers,
			requestId: 'request-123',
			retryIntervalMs: 10,
			timeoutMs: 25
		});

		timers.advanceBy(25);

		assert.deepEqual(await pending, { status: 'timeout' });
		assert.equal(targetWindow.posted.length, 3);
		assert.equal(targetWindow.listenerCount, 0);
		assert.equal(timers.pendingCount, 0);
	});
});

function extensionState() {
	return {
		schemaVersion: 1 as const,
		updatedAt: '2026-09-04T16:00:00.000Z',
		profiles: [
			{
				schemaVersion: 1 as const,
				profileId: 'student-2024:261',
				sourceKind: 'student-2024' as const,
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-04T16:00:00.000Z'
			}
		],
		appearances: {},
		status: { state: 'idle' as const }
	};
}
