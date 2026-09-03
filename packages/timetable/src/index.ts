export type SourceKind = 'student-2024' | 'student-legacy' | 'lecturer' | 'postgraduate';

export interface ManagedEvent {
	stableKey: string;
	fingerprint?: string;
	sourceKind: SourceKind;
	semester: number;
	courseCode: string;
	group: string;
	sessionOrdinal: number;
	weekday: number;
	title: string;
	location: string;
	start: string;
	end: string;
	timeZone: string;
	activeWeekIndexes: number[];
	excludedStarts: string[];
	metadata: Record<string, string>;
}

export type CaptureCompleteness =
	| { state: 'complete'; parsedRows: number; expectedRows: number }
	| { state: 'incomplete'; parsedRows: number; expectedRows: number }
	| { state: 'unknown'; parsedRows: number };

export interface TimetableSnapshot {
	schemaVersion: 1;
	sourceKind: SourceKind;
	semester: number;
	capturedAt: string;
	sourceUpdatedAt?: string;
	fingerprint: string;
	events: ManagedEvent[];
	warnings: string[];
	completeness?: CaptureCompleteness;
}

export interface AddedEvent {
	kind: 'added';
	after: ManagedEvent;
}

export interface RemovedEvent {
	kind: 'removed';
	before: ManagedEvent;
}

export interface ChangedEvent {
	kind: 'changed';
	before: ManagedEvent;
	after: ManagedEvent;
	changedFields: string[];
}

export interface UnchangedEvent {
	kind: 'unchanged';
	before: ManagedEvent;
	after: ManagedEvent;
}

export interface TimetableDiff {
	added: AddedEvent[];
	removed: RemovedEvent[];
	changed: ChangedEvent[];
	unchanged: UnchangedEvent[];
	canDelete: boolean;
}

export async function createStableEventKey(
	event: Omit<ManagedEvent, 'stableKey' | 'fingerprint'> | ManagedEvent
): Promise<string> {
	const identity = {
		sourceKind: event.sourceKind,
		semester: event.semester,
		courseCode: normalizeIdentity(event.courseCode || event.title),
		group: normalizeIdentity(event.group),
		sessionOrdinal: event.sessionOrdinal,
		weekday: event.weekday
	};
	return `bk2_${await sha256(canonicalStringify(identity))}`;
}

export async function createEventFingerprint(
	event: Omit<ManagedEvent, 'fingerprint'> | ManagedEvent
): Promise<string> {
	return await sha256(canonicalStringify({ ...event, fingerprint: undefined }));
}

export async function createSnapshot(
	input: Omit<TimetableSnapshot, 'schemaVersion' | 'fingerprint' | 'events'> & {
		events: Array<Omit<ManagedEvent, 'stableKey' | 'fingerprint'> | ManagedEvent>;
	}
): Promise<TimetableSnapshot> {
	const events: ManagedEvent[] = [];
	for (const sourceEvent of input.events) {
		const event = { ...sourceEvent } as ManagedEvent;
		event.stableKey = event.stableKey || (await createStableEventKey(event));
		event.fingerprint = await createEventFingerprint(event);
		events.push(event);
	}
	events.sort((a, b) => a.stableKey.localeCompare(b.stableKey));
	assertUnique(events, 'new snapshot');
	const fingerprint = await sha256(
		canonicalStringify(
			events.map((event) => ({ key: event.stableKey, fingerprint: event.fingerprint }))
		)
	);
	return { ...input, schemaVersion: 1, events, fingerprint };
}

export function diffSnapshots(
	before: TimetableSnapshot | undefined,
	after: TimetableSnapshot
): TimetableDiff {
	assertUnique(before?.events ?? [], 'previous snapshot');
	assertUnique(after.events, 'new snapshot');

	const previous = new Map((before?.events ?? []).map((event) => [event.stableKey, event]));
	const current = new Map(after.events.map((event) => [event.stableKey, event]));
	const added: AddedEvent[] = [];
	const removed: RemovedEvent[] = [];
	const changed: ChangedEvent[] = [];
	const unchanged: UnchangedEvent[] = [];

	for (const event of [...after.events].sort(byStableKey)) {
		const old = previous.get(event.stableKey);
		if (!old) {
			added.push({ kind: 'added', after: event });
		} else if (old.fingerprint !== event.fingerprint) {
			changed.push({
				kind: 'changed',
				before: old,
				after: event,
				changedFields: changedFields(old, event)
			});
		} else {
			unchanged.push({ kind: 'unchanged', before: old, after: event });
		}
	}

	for (const event of [...(before?.events ?? [])].sort(byStableKey)) {
		if (!current.has(event.stableKey)) removed.push({ kind: 'removed', before: event });
	}

	return {
		added,
		changed,
		removed,
		unchanged,
		canDelete: after.completeness?.state === 'complete' || after.completeness === undefined
	};
}

function assertUnique(events: ManagedEvent[], label: string): void {
	const seen = new Set<string>();
	for (const event of events) {
		if (seen.has(event.stableKey)) {
			throw new Error(`Duplicate stable key in ${label}: ${event.stableKey}`);
		}
		seen.add(event.stableKey);
	}
}

function normalizeIdentity(value: string): string {
	return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

function changedFields(before: ManagedEvent, after: ManagedEvent): string[] {
	const mutable: Array<keyof ManagedEvent> = [
		'title',
		'location',
		'start',
		'end',
		'timeZone',
		'activeWeekIndexes',
		'excludedStarts',
		'metadata'
	];
	return mutable.filter(
		(key) => canonicalStringify(before[key]) !== canonicalStringify(after[key])
	);
}

function byStableKey(a: ManagedEvent, b: ManagedEvent): number {
	return a.stableKey.localeCompare(b.stableKey);
}

function canonicalStringify(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, item]) => item !== undefined)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, canonicalize(item)])
		);
	}
	return value;
}

async function sha256(value: string): Promise<string> {
	const bytes = new TextEncoder().encode(value);
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export {
	EXTENSION_TRANSFER_REQUEST_TYPE,
	EXTENSION_TRANSFER_RESPONSE_TYPE,
	EXTENSION_TRANSFER_VERSION,
	createExtensionTransferEmptyResponse,
	createExtensionTransferRequest,
	createExtensionTransferResponse,
	isExtensionTransferRequest,
	isExtensionTransferResponse,
	type ExtensionTransferEmptyResponse,
	type ExtensionTransferReadyResponse,
	type ExtensionTransferRequest,
	type ExtensionTransferResponse
} from './transfer.ts';
