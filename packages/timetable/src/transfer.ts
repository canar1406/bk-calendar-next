import type { ManagedEvent, TimetableSnapshot } from './index.ts';

export const EXTENSION_TRANSFER_REQUEST_TYPE = 'bkalendar:request-pending-snapshot';
export const EXTENSION_TRANSFER_RESPONSE_TYPE = 'bkalendar:pending-snapshot';
export const EXTENSION_TRANSFER_VERSION = 1;

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

export function createExtensionTransferRequest(requestId: string): ExtensionTransferRequest {
	assertRequestId(requestId);
	return {
		source: 'bkalendar-web',
		type: EXTENSION_TRANSFER_REQUEST_TYPE,
		version: EXTENSION_TRANSFER_VERSION,
		requestId
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

function isTimetableSnapshot(value: unknown): value is TimetableSnapshot {
	if (!isRecord(value)) return false;
	return (
		value.schemaVersion === 1 &&
		isSourceKind(value.sourceKind) &&
		Number.isInteger(value.semester) &&
		typeof value.capturedAt === 'string' &&
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
