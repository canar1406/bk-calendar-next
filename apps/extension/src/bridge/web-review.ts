import {
	createExtensionTransferEmptyResponse,
	createExtensionTransferResponse,
	isExtensionTransferRequest,
	type ExtensionTransferResponse,
	type TimetableSnapshot
} from '../../../../packages/timetable/src/index.ts';

export const PROFILE_STORAGE_KEY = 'bkalendar-next:profiles';
export const REVIEW_ORIGIN = 'https://canar1406.github.io';
export const REVIEW_PATH_PREFIX = '/bk-calendar-next/';

interface TransferMessageEvent {
	source: MessageEventSource | null;
	origin: string;
	data: unknown;
}

interface TransferContext {
	windowSource: MessageEventSource;
	origin: string;
	pathname: string;
	readProfiles(): Promise<unknown>;
	postResponse(response: ExtensionTransferResponse): void;
}

export async function handleExtensionTransferMessage(
	event: TransferMessageEvent,
	context: TransferContext
): Promise<boolean> {
	if (
		event.source !== context.windowSource ||
		event.origin !== REVIEW_ORIGIN ||
		context.origin !== REVIEW_ORIGIN ||
		!context.pathname.startsWith(REVIEW_PATH_PREFIX) ||
		!isExtensionTransferRequest(event.data)
	) {
		return false;
	}

	const snapshot = selectNewestPendingSnapshot(await context.readProfiles());
	context.postResponse(
		snapshot
			? createExtensionTransferResponse(event.data.requestId, snapshot)
			: createExtensionTransferEmptyResponse(event.data.requestId)
	);
	return true;
}

export function selectNewestPendingSnapshot(value: unknown): TimetableSnapshot | undefined {
	if (!Array.isArray(value)) return undefined;

	return value
		.flatMap((item): Array<{ snapshot: TimetableSnapshot; checkedAt: number }> => {
			if (!isRecord(item) || !isTimetableSnapshot(item.pendingSnapshot)) return [];
			return [
				{
					snapshot: stripTokenFields(item.pendingSnapshot),
					checkedAt: timestamp(item.lastCheckedAt, item.pendingSnapshot.capturedAt)
				}
			];
		})
		.sort((a, b) => b.checkedAt - a.checkedAt)[0]?.snapshot;
}

if (typeof window !== 'undefined' && typeof chrome !== 'undefined') {
	window.addEventListener('message', (event) => {
		void handleExtensionTransferMessage(event, {
			windowSource: window,
			origin: window.location.origin,
			pathname: window.location.pathname,
			async readProfiles() {
				const stored = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
				return stored[PROFILE_STORAGE_KEY];
			},
			postResponse(response) {
				window.postMessage(response, REVIEW_ORIGIN);
			}
		});
	});
}

function isTimetableSnapshot(value: unknown): value is TimetableSnapshot {
	if (!isRecord(value)) return false;
	return (
		value.schemaVersion === 1 &&
		typeof value.sourceKind === 'string' &&
		typeof value.semester === 'number' &&
		typeof value.capturedAt === 'string' &&
		typeof value.fingerprint === 'string' &&
		Array.isArray(value.events) &&
		Array.isArray(value.warnings)
	);
}

function timestamp(primary: unknown, fallback: string): number {
	const value = typeof primary === 'string' ? primary : fallback;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stripTokenFields<T>(value: T): T {
	if (Array.isArray(value)) return value.map(stripTokenFields) as T;
	if (!isRecord(value)) return value;

	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => !key.toLowerCase().includes('token'))
			.map(([key, item]) => [key, stripTokenFields(item)])
	) as T;
}
