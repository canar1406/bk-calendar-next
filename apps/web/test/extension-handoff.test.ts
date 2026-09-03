import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createExtensionTransferEmptyResponse,
	createExtensionTransferResponse,
	createSnapshot
} from '../../../packages/timetable/src/index.ts';
import {
	requestPendingSnapshotFromExtension,
	type ExtensionMessageEvent,
	type ExtensionMessageWindow,
	type ExtensionTransferTimers
} from '../src/lib/extension-handoff.ts';

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
