import {
	createExtensionStateRequest,
	createExtensionProfileSyncMessage,
	createExtensionTransferRequest,
	isExtensionStateReply,
	isExtensionStateUpdate,
	isExtensionTransferResponse,
	type ExtensionState,
	type TimetableSnapshot
} from '../../../../packages/timetable/src/index.ts';
import type { SyncProfile } from '../../../../packages/timetable/src/storage.ts';
import {
	createCourseAppearanceTransferMessage,
	type CourseColorPreferences
} from '../../../../packages/google-calendar/src/course-appearance.ts';

export interface ExtensionMessageEvent {
	data: unknown;
	origin: string;
	source: unknown;
}

export interface ExtensionMessageWindow {
	readonly location: {
		readonly origin: string;
		readonly search: string;
	};
	addEventListener(type: 'message', listener: (event: ExtensionMessageEvent) => void): void;
	removeEventListener(type: 'message', listener: (event: ExtensionMessageEvent) => void): void;
	postMessage(message: unknown, targetOrigin: string): void;
}

export interface ExtensionTransferTimers {
	setTimeout(callback: () => void, delayMs: number): unknown;
	clearTimeout(handle: unknown): void;
}

export type PendingSnapshotRequestResult =
	| { status: 'skipped' }
	| { status: 'ready'; snapshot: TimetableSnapshot }
	| { status: 'empty' }
	| { status: 'timeout' };

export type ExtensionStateRequestResult =
	{ status: 'ready'; state: ExtensionState } | { status: 'empty' } | { status: 'timeout' };

export interface PendingSnapshotRequestOptions {
	targetWindow: ExtensionMessageWindow;
	timers?: ExtensionTransferTimers;
	requestId?: string;
	retryIntervalMs?: number;
	timeoutMs?: number;
}

export interface ExtensionStateRequestOptions {
	targetWindow: ExtensionMessageWindow;
	timers?: ExtensionTransferTimers;
	requestId?: string;
	retryIntervalMs?: number;
	timeoutMs?: number;
}

export interface PublishCourseAppearanceOptions {
	targetWindow: Pick<ExtensionMessageWindow, 'location' | 'postMessage'>;
	profileId: string;
	preferences: CourseColorPreferences;
}

export interface PublishProfileOptions {
	targetWindow: Pick<ExtensionMessageWindow, 'postMessage' | 'location'>;
	profile: SyncProfile;
}

export function publishProfileToExtension({ targetWindow, profile }: PublishProfileOptions): void {
	targetWindow.postMessage(
		createExtensionProfileSyncMessage(profile),
		targetWindow.location.origin
	);
}

export function subscribeToExtensionState(
	targetWindow: ExtensionMessageWindow,
	onState: (state: ExtensionState) => void
): () => void {
	const origin = targetWindow.location.origin;
	const handleMessage = (event: ExtensionMessageEvent): void => {
		if (event.source !== targetWindow || event.origin !== origin) return;
		if (!isExtensionStateUpdate(event.data)) return;
		onState(event.data.state);
	};
	targetWindow.addEventListener('message', handleMessage);
	return () => targetWindow.removeEventListener('message', handleMessage);
}

export async function requestExtensionStateFromExtension({
	targetWindow,
	timers = browserTimers,
	requestId = createRequestId(),
	retryIntervalMs = DEFAULT_RETRY_INTERVAL_MS,
	timeoutMs = DEFAULT_TIMEOUT_MS
}: ExtensionStateRequestOptions): Promise<ExtensionStateRequestResult> {
	const request = createExtensionStateRequest(requestId);
	const origin = targetWindow.location.origin;

	return await new Promise((resolve) => {
		let settled = false;
		const timerHandles = new Set<unknown>();

		const clearTimers = (): void => {
			for (const handle of timerHandles) timers.clearTimeout(handle);
			timerHandles.clear();
		};
		const finish = (result: ExtensionStateRequestResult): void => {
			if (settled) return;
			settled = true;
			targetWindow.removeEventListener('message', handleMessage);
			clearTimers();
			resolve(result);
		};
		const handleMessage = (event: ExtensionMessageEvent): void => {
			if (event.source !== targetWindow || event.origin !== origin) return;
			if (!isExtensionStateReply(event.data) || event.data.requestId !== requestId) return;
			finish(
				event.data.status === 'ready'
					? { status: 'ready', state: event.data.state }
					: { status: 'empty' }
			);
		};
		const schedule = (callback: () => void, delayMs: number): void => {
			let handle: unknown;
			handle = timers.setTimeout(() => {
				timerHandles.delete(handle);
				callback();
			}, delayMs);
			timerHandles.add(handle);
		};
		const sendRequest = (): void => {
			if (settled) return;
			targetWindow.postMessage(request, origin);
			schedule(sendRequest, retryIntervalMs);
		};

		targetWindow.addEventListener('message', handleMessage);
		sendRequest();
		schedule(() => finish({ status: 'timeout' }), timeoutMs);
	});
}

const DEFAULT_RETRY_INTERVAL_MS = 150;
const DEFAULT_TIMEOUT_MS = 900;

export function publishCourseAppearanceToExtension({
	targetWindow,
	profileId,
	preferences
}: PublishCourseAppearanceOptions): void {
	targetWindow.postMessage(
		createCourseAppearanceTransferMessage(profileId, preferences),
		targetWindow.location.origin
	);
}

export async function requestPendingSnapshotFromExtension({
	targetWindow,
	timers = browserTimers,
	requestId = createRequestId(),
	retryIntervalMs = DEFAULT_RETRY_INTERVAL_MS,
	timeoutMs = DEFAULT_TIMEOUT_MS
}: PendingSnapshotRequestOptions): Promise<PendingSnapshotRequestResult> {
	if (new URLSearchParams(targetWindow.location.search).get('from') !== 'extension') {
		return { status: 'skipped' };
	}

	const request = createExtensionTransferRequest(requestId);
	const origin = targetWindow.location.origin;

	return await new Promise((resolve) => {
		let settled = false;
		const timerHandles = new Set<unknown>();

		const clearTimers = (): void => {
			for (const handle of timerHandles) timers.clearTimeout(handle);
			timerHandles.clear();
		};

		const finish = (result: PendingSnapshotRequestResult): void => {
			if (settled) return;
			settled = true;
			targetWindow.removeEventListener('message', handleMessage);
			clearTimers();
			resolve(result);
		};

		const handleMessage = (event: ExtensionMessageEvent): void => {
			if (event.source !== targetWindow || event.origin !== origin) return;
			if (!isExtensionTransferResponse(event.data) || event.data.requestId !== requestId) return;
			if (event.data.status === 'empty') finish({ status: 'empty' });
			else finish({ status: 'ready', snapshot: event.data.snapshot });
		};

		const schedule = (callback: () => void, delayMs: number): void => {
			let handle: unknown;
			handle = timers.setTimeout(() => {
				timerHandles.delete(handle);
				callback();
			}, delayMs);
			timerHandles.add(handle);
		};

		const sendRequest = (): void => {
			if (settled) return;
			targetWindow.postMessage(request, origin);
			schedule(sendRequest, retryIntervalMs);
		};

		targetWindow.addEventListener('message', handleMessage);
		sendRequest();
		schedule(() => finish({ status: 'timeout' }), timeoutMs);
	});
}

function createRequestId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const browserTimers: ExtensionTransferTimers = {
	setTimeout(callback, delayMs) {
		return globalThis.setTimeout(callback, delayMs);
	},
	clearTimeout(handle) {
		globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>);
	}
};
