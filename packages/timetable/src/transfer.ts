import type { ManagedEvent, TimetableSnapshot } from './index.ts';
import type { SyncProfile } from './storage.ts';

export const EXTENSION_TRANSFER_REQUEST_TYPE = 'bkalendar:request-pending-snapshot';
export const EXTENSION_TRANSFER_RESPONSE_TYPE = 'bkalendar:pending-snapshot';
export const EXTENSION_TRANSFER_VERSION = 1;
export const EXTENSION_STATE_REQUEST_TYPE = 'bkalendar:request-state';
export const EXTENSION_STATE_RESPONSE_TYPE = 'bkalendar:state';
export const EXTENSION_STATE_UPDATE_TYPE = 'bkalendar:state-updated';
export const EXTENSION_PROFILE_SYNC_TYPE = 'bkalendar:sync-profile';

export interface ExtensionTransferRequest {
	source: 'bkalendar-web';
	type: typeof EXTENSION_TRANSFER_REQUEST_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	requestId: string;
}

export interface ExtensionTransferReadyResponse {
	source: 'bkalendar-extension';
	type: typeof EXTENSION_TRANSFER_RESPONSE_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	requestId: string;
	status: 'ready';
	snapshot: TimetableSnapshot;
}

export interface ExtensionTransferEmptyResponse {
	source: 'bkalendar-extension';
	type: typeof EXTENSION_TRANSFER_RESPONSE_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	requestId: string;
	status: 'empty';
}

export type ExtensionTransferResponse =
	ExtensionTransferReadyResponse | ExtensionTransferEmptyResponse;

export interface ExtensionState {
	schemaVersion: 1;
	updatedAt: string;
	profiles: SyncProfile[];
	appearances: Record<string, unknown>;
	status: ExtensionStateStatus;
}

export type ExtensionStateStatus =
	| { state: 'idle' }
	| {
			state: 'captured';
			capturedAt: string;
			sourceUpdatedAt?: string;
			completeness: {
				state: 'complete' | 'incomplete' | 'unknown';
				parsedRows: number;
				expectedRows?: number;
			};
			changes?: {
				added: number;
				changed: number;
				removed: number;
				unchanged: number;
				canDelete: boolean;
			};
			syncState?: 'review' | 'applied';
	  }
	| { state: 'error'; checkedAt: string; message: string };

export interface ExtensionStateRequest {
	source: 'bkalendar-web';
	type: typeof EXTENSION_STATE_REQUEST_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	requestId: string;
}

export interface ExtensionStateResponse {
	source: 'bkalendar-extension';
	type: typeof EXTENSION_STATE_RESPONSE_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	requestId: string;
	status: 'ready';
	state: ExtensionState;
}

export interface ExtensionStateEmptyResponse {
	source: 'bkalendar-extension';
	type: typeof EXTENSION_STATE_RESPONSE_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	requestId: string;
	status: 'empty';
}

export type ExtensionStateReply = ExtensionStateResponse | ExtensionStateEmptyResponse;

export interface ExtensionStateUpdate {
	source: 'bkalendar-extension';
	type: typeof EXTENSION_STATE_UPDATE_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	state: ExtensionState;
}

export interface ExtensionProfileSyncMessage {
	source: 'bkalendar-web';
	type: typeof EXTENSION_PROFILE_SYNC_TYPE;
	version: typeof EXTENSION_TRANSFER_VERSION;
	profile: SyncProfile;
}

export function createExtensionTransferRequest(requestId: string): ExtensionTransferRequest {
	assertRequestId(requestId);
	return {
		source: 'bkalendar-web',
		type: EXTENSION_TRANSFER_REQUEST_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		requestId
	};
}

export function createExtensionStateRequest(requestId: string): ExtensionStateRequest {
	assertRequestId(requestId);
	return {
		source: 'bkalendar-web',
		type: EXTENSION_STATE_REQUEST_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		requestId
	};
}

export function createExtensionStateResponse(
	requestId: string,
	state: ExtensionState
): ExtensionStateResponse {
	assertRequestId(requestId);
	return {
		source: 'bkalendar-extension',
		type: EXTENSION_STATE_RESPONSE_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		requestId,
		status: 'ready',
		state
	};
}

export function createExtensionStateEmptyResponse(requestId: string): ExtensionStateEmptyResponse {
	assertRequestId(requestId);
	return {
		source: 'bkalendar-extension',
		type: EXTENSION_STATE_RESPONSE_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		requestId,
		status: 'empty'
	};
}

export function createExtensionStateUpdate(state: ExtensionState): ExtensionStateUpdate {
	return {
		source: 'bkalendar-extension',
		type: EXTENSION_STATE_UPDATE_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		state
	};
}

export function createExtensionProfileSyncMessage(
	profile: SyncProfile
): ExtensionProfileSyncMessage {
	return {
		source: 'bkalendar-web',
		type: EXTENSION_PROFILE_SYNC_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		profile
	};
}

export function createExtensionTransferResponse(
	requestId: string,
	snapshot: TimetableSnapshot
): ExtensionTransferReadyResponse {
	assertRequestId(requestId);
	return {
		source: 'bkalendar-extension',
		type: EXTENSION_TRANSFER_RESPONSE_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		requestId,
		status: 'ready',
		snapshot
	};
}

export function createExtensionTransferEmptyResponse(
	requestId: string
): ExtensionTransferEmptyResponse {
	assertRequestId(requestId);
	return {
		source: 'bkalendar-extension',
		type: EXTENSION_TRANSFER_RESPONSE_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		requestId,
		status: 'empty'
	};
}

export function isExtensionTransferRequest(value: unknown): value is ExtensionTransferRequest {
	if (!isRecord(value)) return false;
	return (
		value.source === 'bkalendar-web' &&
		value.type === EXTENSION_TRANSFER_REQUEST_TYPE &&
		value.version === EXTENSION_TRANSFER_VERSION &&
		validRequestId(value.requestId)
	);
}

export function isExtensionStateRequest(value: unknown): value is ExtensionStateRequest {
	if (!isRecord(value)) return false;
	return (
		value.source === 'bkalendar-web' &&
		value.type === EXTENSION_STATE_REQUEST_TYPE &&
		value.version === EXTENSION_TRANSFER_VERSION &&
		validRequestId(value.requestId)
	);
}

export function isExtensionTransferResponse(value: unknown): value is ExtensionTransferResponse {
	if (!isRecord(value)) return false;
	const validEnvelope =
		value.source === 'bkalendar-extension' &&
		value.type === EXTENSION_TRANSFER_RESPONSE_TYPE &&
		value.version === EXTENSION_TRANSFER_VERSION &&
		validRequestId(value.requestId);
	if (!validEnvelope) return false;
	if (value.status === 'empty') return true;
	return value.status === 'ready' && isTimetableSnapshot(value.snapshot);
}

export function isExtensionStateReply(value: unknown): value is ExtensionStateReply {
	if (!isRecord(value)) return false;
	const validEnvelope =
		value.source === 'bkalendar-extension' &&
		value.type === EXTENSION_STATE_RESPONSE_TYPE &&
		value.version === EXTENSION_TRANSFER_VERSION &&
		validRequestId(value.requestId);
	if (!validEnvelope) return false;
	if (value.status === 'empty') return true;
	return value.status === 'ready' && isExtensionState(value.state);
}

export function isExtensionStateUpdate(value: unknown): value is ExtensionStateUpdate {
	if (!isRecord(value)) return false;
	return (
		value.source === 'bkalendar-extension' &&
		value.type === EXTENSION_STATE_UPDATE_TYPE &&
		value.version === EXTENSION_TRANSFER_VERSION &&
		isExtensionState(value.state)
	);
}

export function isExtensionProfileSyncMessage(
	value: unknown
): value is ExtensionProfileSyncMessage {
	if (!isRecord(value)) return false;
	return (
		value.source === 'bkalendar-web' &&
		value.type === EXTENSION_PROFILE_SYNC_TYPE &&
		value.version === EXTENSION_TRANSFER_VERSION &&
		isSyncProfile(value.profile)
	);
}

function isExtensionState(value: unknown): value is ExtensionState {
	if (!isRecord(value)) return false;
	return (
		value.schemaVersion === 1 &&
		typeof value.updatedAt === 'string' &&
		Array.isArray(value.profiles) &&
		value.profiles.every(isSyncProfile) &&
		isRecord(value.appearances) &&
		isExtensionStateStatus(value.status)
	);
}

function isSyncProfile(value: unknown): value is SyncProfile {
	if (!isRecord(value)) return false;
	return (
		value.schemaVersion === 1 &&
		typeof value.profileId === 'string' &&
		typeof value.sourceKind === 'string' &&
		typeof value.semester === 'number' &&
		typeof value.calendarName === 'string' &&
		(value.calendarId === undefined || typeof value.calendarId === 'string') &&
		(value.acceptedSnapshot === undefined || isTimetableSnapshot(value.acceptedSnapshot)) &&
		(value.pendingSnapshot === undefined || isTimetableSnapshot(value.pendingSnapshot)) &&
		(value.lastCheckedAt === undefined || typeof value.lastCheckedAt === 'string') &&
		(value.lastSyncedAt === undefined || typeof value.lastSyncedAt === 'string')
	);
}

function isExtensionStateStatus(value: unknown): value is ExtensionStateStatus {
	if (!isRecord(value) || typeof value.state !== 'string') return false;
	if (value.state === 'idle') return true;
	if (value.state === 'error') {
		return typeof value.checkedAt === 'string' && typeof value.message === 'string';
	}
	if (value.state !== 'captured' || typeof value.capturedAt !== 'string') return false;
	if (!isRecord(value.completeness) || typeof value.completeness.state !== 'string') return false;
	if (
		value.completeness.state !== 'complete' &&
		value.completeness.state !== 'incomplete' &&
		value.completeness.state !== 'unknown'
	) {
		return false;
	}
	return (
		typeof value.completeness.parsedRows === 'number' &&
		(value.completeness.state === 'unknown' ||
			typeof value.completeness.expectedRows === 'number') &&
		(value.sourceUpdatedAt === undefined || typeof value.sourceUpdatedAt === 'string') &&
		(value.syncState === undefined || value.syncState === 'review' || value.syncState === 'applied')
	);
}

function isTimetableSnapshot(value: unknown): value is TimetableSnapshot {
	if (!isRecord(value)) return false;
	return (
		value.schemaVersion === 1 &&
		isSourceKind(value.sourceKind) &&
		Number.isInteger(value.semester) &&
		typeof value.capturedAt === 'string' &&
		(value.provenance === undefined ||
			value.provenance === 'user' ||
			value.provenance === 'sample') &&
		typeof value.fingerprint === 'string' &&
		Array.isArray(value.events) &&
		value.events.every(isManagedEvent) &&
		Array.isArray(value.warnings) &&
		value.warnings.every((warning) => typeof warning === 'string')
	);
}

function isManagedEvent(value: unknown): value is ManagedEvent {
	if (!isRecord(value)) return false;
	return (
		typeof value.stableKey === 'string' &&
		isSourceKind(value.sourceKind) &&
		Number.isInteger(value.semester) &&
		typeof value.courseCode === 'string' &&
		typeof value.group === 'string' &&
		Number.isInteger(value.sessionOrdinal) &&
		Number.isInteger(value.weekday) &&
		typeof value.title === 'string' &&
		typeof value.location === 'string' &&
		typeof value.start === 'string' &&
		typeof value.end === 'string' &&
		typeof value.timeZone === 'string' &&
		Array.isArray(value.activeWeekIndexes) &&
		value.activeWeekIndexes.every(Number.isInteger) &&
		Array.isArray(value.excludedStarts) &&
		value.excludedStarts.every((start) => typeof start === 'string') &&
		isRecord(value.metadata)
	);
}

function isSourceKind(value: unknown): boolean {
	return (
		value === 'student-2024' ||
		value === 'student-legacy' ||
		value === 'lecturer' ||
		value === 'postgraduate'
	);
}

function assertRequestId(requestId: string): void {
	if (!validRequestId(requestId)) throw new Error('Extension transfer request ID is required.');
}

function validRequestId(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}
