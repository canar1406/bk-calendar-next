import type { ManagedEvent } from '../../timetable/src/index.ts';

export interface ManagedGoogleEvent {
	id: string;
	etag?: string;
	stableKey: string;
	fingerprint: string;
}

export interface GoogleCalendarGateway {
	listManagedEvents(calendarId: string): Promise<ManagedGoogleEvent[]>;
	insertEvent(calendarId: string, event: ManagedEvent): Promise<ManagedGoogleEvent>;
	patchEvent(
		calendarId: string,
		eventId: string,
		event: ManagedEvent,
		etag?: string
	): Promise<ManagedGoogleEvent>;
	deleteEvent(calendarId: string, eventId: string, etag?: string): Promise<void>;
}

export type SyncOperation = 'insert' | 'patch' | 'delete';

export interface SyncFailure {
	operation: SyncOperation;
	stableKey: string;
	eventId?: string;
	message: string;
}

export interface SyncResult {
	inserted: number;
	patched: number;
	deleted: number;
	skippedDeletes: number;
	unchanged: number;
	failed: SyncFailure[];
}

export async function syncManagedCalendar(
	gateway: GoogleCalendarGateway,
	calendarId: string,
	localEvents: ManagedEvent[],
	options: { allowDeletes?: boolean; onProgress?: (result: Readonly<SyncResult>) => void } = {}
): Promise<SyncResult> {
	const remoteEvents = await gateway.listManagedEvents(calendarId);
	assertUnique(localEvents, (event) => event.stableKey, 'local');
	assertUnique(remoteEvents, (event) => event.stableKey, 'remote');

	const remoteByKey = new Map(remoteEvents.map((event) => [event.stableKey, event]));
	const localByKey = new Map(localEvents.map((event) => [event.stableKey, event]));
	const result: SyncResult = {
		inserted: 0,
		patched: 0,
		deleted: 0,
		skippedDeletes: 0,
		unchanged: 0,
		failed: []
	};
	const added = localEvents.filter((event) => !remoteByKey.has(event.stableKey)).sort(byStableKey);
	const existing = localEvents
		.filter((event) => remoteByKey.has(event.stableKey))
		.sort(byStableKey);
	const removed = remoteEvents
		.filter((event) => !localByKey.has(event.stableKey))
		.sort((a, b) => a.stableKey.localeCompare(b.stableKey));

	for (const event of added) {
		await execute(
			result,
			'insert',
			event.stableKey,
			undefined,
			async () => {
				await gateway.insertEvent(calendarId, event);
				result.inserted++;
			},
			options.onProgress
		);
	}

	for (const event of existing) {
		const remote = remoteByKey.get(event.stableKey)!;
		if (remote.fingerprint === event.fingerprint) {
			result.unchanged++;
			options.onProgress?.(result);
			continue;
		}
		await execute(
			result,
			'patch',
			event.stableKey,
			remote.id,
			async () => {
				await gateway.patchEvent(calendarId, remote.id, event, remote.etag);
				result.patched++;
			},
			options.onProgress
		);
	}

	if (options.allowDeletes !== false) {
		for (const event of removed) {
			await execute(
				result,
				'delete',
				event.stableKey,
				event.id,
				async () => {
					await gateway.deleteEvent(calendarId, event.id, event.etag);
					result.deleted++;
				},
				options.onProgress
			);
		}
	} else {
		result.skippedDeletes = removed.length;
	}

	return result;
}

async function execute(
	result: SyncResult,
	operation: SyncOperation,
	stableKey: string,
	eventId: string | undefined,
	work: () => Promise<void>,
	onProgress?: (result: Readonly<SyncResult>) => void
): Promise<void> {
	try {
		await work();
	} catch (error) {
		result.failed.push({
			operation,
			stableKey,
			...(eventId ? { eventId } : {}),
			message: error instanceof Error ? error.message : String(error)
		});
	} finally {
		onProgress?.(result);
	}
}

function assertUnique<T>(items: T[], keyOf: (item: T) => string, side: string): void {
	const seen = new Set<string>();
	for (const item of items) {
		const key = keyOf(item);
		if (seen.has(key)) throw new Error(`Duplicate stable key in ${side} events: ${key}`);
		seen.add(key);
	}
}

function byStableKey(a: ManagedEvent, b: ManagedEvent): number {
	return a.stableKey.localeCompare(b.stableKey);
}

export {
	CALENDAR_SCOPE,
	requestGoogleAccessToken,
	revokeGoogleAccessToken,
	type GoogleIdentityApi,
	type GoogleTokenClient,
	type GoogleTokenResponse
} from './oauth.ts';
export {
	GoogleCalendarApiError,
	GoogleCalendarRestGateway,
	MANAGED_BY,
	createManagedCalendar,
	toGoogleEventResource,
	type GoogleCalendarResource,
	type GoogleEventResource
} from './rest.ts';
