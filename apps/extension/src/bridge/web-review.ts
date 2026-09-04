import {
	createExtensionTransferEmptyResponse,
	createExtensionTransferResponse,
	createExtensionStateUpdate,
	createExtensionStateEmptyResponse,
	createExtensionStateResponse,
	isExtensionTransferRequest,
	isExtensionProfileSyncMessage,
	isExtensionStateRequest,
	type ExtensionTransferResponse,
	type ExtensionState,
	type ExtensionStateReply,
	type TimetableSnapshot
} from '../../../../packages/timetable/src/index.ts';
import type { SyncProfile } from '../../../../packages/timetable/src/storage.ts';
import type { ExtensionStatus } from '../background/status.ts';
import {
	isCourseAppearanceTransferMessage,
	type CourseColorPreferences
} from '../../../../packages/google-calendar/src/course-appearance.ts';
import {
	isWebBridgePing,
	isWebBridgeStatePush,
	type WebBridgeRuntimeRequest
} from '../shared/web-bridge-runtime.ts';

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
	readExtensionState?(): Promise<ExtensionState>;
	writeProfile?(profile: SyncProfile): Promise<void>;
	writeCourseAppearance?(profileId: string, preferences: CourseColorPreferences): Promise<void>;
	postResponse(response: ExtensionTransferResponse | ExtensionStateReply): void;
}

export async function handleExtensionTransferMessage(
	event: TransferMessageEvent,
	context: TransferContext
): Promise<boolean> {
	if (
		event.source !== context.windowSource ||
		event.origin !== REVIEW_ORIGIN ||
		context.origin !== REVIEW_ORIGIN ||
		!context.pathname.startsWith(REVIEW_PATH_PREFIX)
	) {
		return false;
	}

	if (isCourseAppearanceTransferMessage(event.data)) {
		if (!context.writeCourseAppearance) return false;
		await context.writeCourseAppearance(event.data.profileId, event.data.preferences);
		return true;
	}
	if (isExtensionStateRequest(event.data)) {
		const state = await context.readExtensionState?.();
		context.postResponse(
			state
				? createExtensionStateResponse(event.data.requestId, state)
				: createExtensionStateEmptyResponse(event.data.requestId)
		);
		return true;
	}
	if (isExtensionProfileSyncMessage(event.data)) {
		const profileMessage = event.data;
		const currentProfiles = await context.readProfiles();
		const current = Array.isArray(currentProfiles)
			? currentProfiles.find(
					(item) => isRecord(item) && item.profileId === profileMessage.profile.profileId
				)
			: undefined;
		if (
			context.writeProfile &&
			(!isRecord(current) ||
				timestamp(current.lastCheckedAt, '') <=
					timestamp(
						profileMessage.profile.lastCheckedAt,
						profileMessage.profile.lastCheckedAt ?? ''
					))
		) {
			await context.writeProfile(stripTokenFields(profileMessage.profile));
		}
		return true;
	}
	if (!isExtensionTransferRequest(event.data)) return false;

	const snapshot = selectNewestPendingSnapshot(await context.readProfiles());
	context.postResponse(
		snapshot
			? createExtensionTransferResponse(event.data.requestId, snapshot)
			: createExtensionTransferEmptyResponse(event.data.requestId)
	);
	return true;
}

export function createLocalExtensionState(
	profilesValue: unknown,
	statusValue: unknown,
	updatedAt = new Date().toISOString(),
	storageValue: unknown = {}
): ExtensionState {
	return {
		schemaVersion: 1,
		updatedAt,
		profiles: sanitizeProfiles(profilesValue),
		appearances: sanitizeAppearances(storageValue),
		status: sanitizeStatus(statusValue)
	};
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
	const bridgeScope = globalThis as typeof globalThis & {
		__bkalendarWebBridgeInstalled?: boolean;
	};
	if (!bridgeScope.__bkalendarWebBridgeInstalled) {
		bridgeScope.__bkalendarWebBridgeInstalled = true;
		window.addEventListener('message', (event) => {
			void handleExtensionTransferMessage(event, {
				windowSource: window,
				origin: window.location.origin,
				pathname: window.location.pathname,
				async readProfiles() {
					return await sendBackgroundRequest({
						type: 'bkalendar:web-bridge:profiles:get'
					});
				},
				async readExtensionState() {
					return (await sendBackgroundRequest({
						type: 'bkalendar:web-bridge:state:get'
					})) as ExtensionState;
				},
				async writeProfile(profile) {
					await sendBackgroundRequest({
						type: 'bkalendar:web-bridge:profile:save',
						profile
					});
				},
				async writeCourseAppearance(profileId, preferences) {
					await sendBackgroundRequest({
						type: 'bkalendar:web-bridge:appearance:save',
						profileId,
						preferences
					});
				},
				postResponse(response) {
					window.postMessage(response, REVIEW_ORIGIN);
				}
			});
		});

		chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
			if (isWebBridgePing(message)) {
				sendResponse({ ok: true });
				return;
			}
			if (!isWebBridgeStatePush(message)) return;
			window.postMessage(createExtensionStateUpdate(message.state), REVIEW_ORIGIN);
		});
	}
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

function sanitizeProfiles(value: unknown): SyncProfile[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((item): SyncProfile[] => {
		if (!isRecord(item)) return [];
		if (
			item.schemaVersion !== 1 ||
			typeof item.profileId !== 'string' ||
			typeof item.sourceKind !== 'string' ||
			typeof item.semester !== 'number' ||
			typeof item.calendarName !== 'string'
		) {
			return [];
		}
		if (
			(item.acceptedSnapshot !== undefined && !isTimetableSnapshot(item.acceptedSnapshot)) ||
			(item.pendingSnapshot !== undefined && !isTimetableSnapshot(item.pendingSnapshot))
		) {
			return [];
		}
		return [
			stripTokenFields({
				schemaVersion: 1,
				profileId: item.profileId,
				sourceKind: item.sourceKind,
				semester: item.semester,
				calendarName: item.calendarName,
				...(typeof item.calendarId === 'string' ? { calendarId: item.calendarId } : {}),
				...(item.acceptedSnapshot ? { acceptedSnapshot: item.acceptedSnapshot } : {}),
				...(item.pendingSnapshot ? { pendingSnapshot: item.pendingSnapshot } : {}),
				...(typeof item.lastCheckedAt === 'string' ? { lastCheckedAt: item.lastCheckedAt } : {}),
				...(typeof item.lastSyncedAt === 'string' ? { lastSyncedAt: item.lastSyncedAt } : {})
			}) as SyncProfile
		];
	});
}

function sanitizeStatus(value: unknown): ExtensionState['status'] {
	if (!value || typeof value !== 'object') return { state: 'idle' };
	const status = value as Partial<ExtensionStatus>;
	if (status.state === 'error' && typeof status.checkedAt === 'string') {
		return {
			state: 'error',
			checkedAt: status.checkedAt,
			message: typeof status.message === 'string' ? status.message.slice(0, 240) : 'Không rõ lỗi.'
		};
	}
	if (status.state !== 'captured' || typeof status.capturedAt !== 'string') {
		return { state: 'idle' };
	}
	const completeness = status.completeness;
	if (!completeness || typeof completeness !== 'object') return { state: 'idle' };
	return {
		state: 'captured',
		capturedAt: status.capturedAt,
		...(typeof status.sourceUpdatedAt === 'string'
			? { sourceUpdatedAt: status.sourceUpdatedAt }
			: {}),
		completeness:
			completeness.state === 'unknown'
				? { state: 'unknown', parsedRows: completeness.parsedRows }
				: {
						state: completeness.state,
						parsedRows: completeness.parsedRows,
						expectedRows: completeness.expectedRows
					},
		...(status.changes ? { changes: status.changes } : {}),
		...(status.syncState ? { syncState: status.syncState } : {})
	};
}

function sanitizeAppearances(value: unknown): Record<string, unknown> {
	if (!isRecord(value)) return {};
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key, item]) => key.startsWith('bkalendar-next:course-colors:') && isRecord(item))
			.map(([key, item]) => [key, stripTokenFields(item)])
	);
}

async function sendBackgroundRequest(message: WebBridgeRuntimeRequest): Promise<unknown> {
	const response = (await chrome.runtime.sendMessage(message)) as {
		ok?: boolean;
		message?: string;
		value?: unknown;
	};
	if (!response?.ok) {
		throw new Error(response?.message || 'Extension background không phản hồi.');
	}
	return response.value;
}
