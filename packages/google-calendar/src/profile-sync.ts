import {
	GoogleCalendarApiError,
	syncManagedCalendar,
	type GoogleCalendarGateway,
	type ManagedGoogleEvent,
	type SyncResult
} from './index.ts';
import {
	diffSnapshots,
	type ManagedEvent,
	type SourceKind,
	type TimetableDiff
} from '../../timetable/src/index.ts';
import type { ProfileStore, SyncProfile } from '../../timetable/src/storage.ts';

export interface GoogleSyncDependencies {
	gateway: GoogleCalendarGateway;
	findCalendars?(summary: string): Promise<Array<{ id: string }>>;
	findLegacyCalendars?(sourceKind: SourceKind, semester: number): Promise<Array<{ id: string }>>;
	createCalendar(summary: string): Promise<{ id: string }>;
	prepareEvents?(events: ManagedEvent[]): ManagedEvent[];
	now?: () => string;
	onProgress?: (result: Readonly<SyncResult>) => void;
}

export interface GoogleProfileSyncResult {
	result: SyncResult;
	diff: TimetableDiff;
	profile: SyncProfile;
	promoted: boolean;
}

export async function syncPendingProfile(
	store: ProfileStore,
	profileId: string,
	dependencies: GoogleSyncDependencies
): Promise<GoogleProfileSyncResult> {
	const stored = await store.get(profileId);
	if (!stored) throw new Error('Không tìm thấy profile BKalendar cần đồng bộ.');
	if (!stored.pendingSnapshot) throw new Error('Không có thời khóa biểu đang chờ đồng bộ.');

	const pendingSnapshot = stored.pendingSnapshot;
	if (pendingSnapshot.provenance === 'sample') {
		throw new Error('Dữ liệu mẫu chỉ dùng để xem trước và không thể đồng bộ Google Calendar.');
	}
	let profile = stored;
	let calendarId = stored.calendarId;
	let calendarOrigin = stored.calendarOrigin ?? 'managed';
	let createdFreshCalendar = false;

	if (!calendarId) {
		const resolved = await resolveCalendar(stored, dependencies);
		calendarId = resolved.id;
		calendarOrigin = resolved.origin;
		createdFreshCalendar = resolved.created;
		profile = { ...stored, calendarId, calendarOrigin };
		await store.save(profile);
	} else {
		calendarId = assertSafeCalendarId(calendarId);
		if (
			stored.scheduleKind !== 'exams' &&
			!stored.calendarOrigin &&
			dependencies.findLegacyCalendars
		) {
			const legacyCalendars = await dependencies.findLegacyCalendars(
				stored.sourceKind,
				stored.semester
			);
			if (legacyCalendars.some((calendar) => calendar.id === calendarId)) {
				calendarOrigin = 'legacy';
				profile = { ...profile, calendarOrigin };
				await store.save(profile);
			}
		}
	}

	const diff = diffSnapshots(profile.acceptedSnapshot, pendingSnapshot);
	const eventsForSync = dependencies.prepareEvents
		? dependencies.prepareEvents(pendingSnapshot.events)
		: pendingSnapshot.events;
	let result: SyncResult;
	try {
		result = await syncCalendar(
			dependencies,
			calendarId,
			calendarOrigin,
			pendingSnapshot.events,
			eventsForSync,
			diff.canDelete
		);
	} catch (error) {
		const isStaleStored404 =
			error instanceof GoogleCalendarApiError && error.status === 404 && Boolean(stored.calendarId);
		const isInaccessibleExisting403 =
			!createdFreshCalendar &&
			error instanceof GoogleCalendarApiError &&
			error.status === 403 &&
			!/rateLimitExceeded|quotaExceeded|tạm giới hạn/iu.test(error.message);
		if (!isStaleStored404 && !isInaccessibleExisting403) {
			throw error;
		}
		const { calendarId: _oldCalendarId, calendarOrigin: _oldOrigin, ...withoutCalendar } = stored;
		const resolved = isStaleStored404
			? await resolveCalendar(withoutCalendar, dependencies)
			: {
					id: assertSafeCalendarId((await dependencies.createCalendar(stored.calendarName)).id),
					origin: 'managed' as const,
					created: true
				};
		calendarId = resolved.id;
		calendarOrigin = resolved.origin;
		createdFreshCalendar = resolved.created;
		profile = { ...withoutCalendar, calendarId, calendarOrigin };
		await store.save(profile);
		result = await syncCalendar(
			dependencies,
			calendarId,
			calendarOrigin,
			pendingSnapshot.events,
			eventsForSync,
			diff.canDelete
		);
	}

	if (
		!createdFreshCalendar &&
		result.inserted === 0 &&
		result.patched === 0 &&
		result.deleted === 0 &&
		result.failed.length > 0 &&
		result.failed.every((failure) => isCalendarWriteForbiddenOrMissing(failure.message))
	) {
		const { calendarId: _oldCalendarId, calendarOrigin: _oldOrigin, ...withoutCalendar } = stored;
		calendarId = assertSafeCalendarId((await dependencies.createCalendar(stored.calendarName)).id);
		calendarOrigin = 'managed';
		createdFreshCalendar = true;
		profile = { ...withoutCalendar, calendarId, calendarOrigin };
		await store.save(profile);
		result = await syncCalendar(
			dependencies,
			calendarId,
			calendarOrigin,
			pendingSnapshot.events,
			eventsForSync,
			diff.canDelete
		);
	}
	const promoted = result.failed.length === 0 && result.skippedDeletes === 0;

	if (dependencies.gateway.listCalendarEvents) {
		await cleanupExtraSemesterCalendars(
			stored,
			calendarId,
			pendingSnapshot.events,
			dependencies,
			result
		);
	}

	if (promoted) {
		const { pendingSnapshot: _pendingSnapshot, ...withoutPending } = profile;
		profile = {
			...withoutPending,
			acceptedSnapshot: pendingSnapshot,
			lastSyncedAt: dependencies.now?.() ?? new Date().toISOString()
		};
		await store.save(profile);
	}

	return { result, diff, profile, promoted };
}

async function resolveCalendar(
	stored: SyncProfile,
	dependencies: GoogleSyncDependencies
): Promise<{ id: string; origin: 'managed' | 'legacy'; created: boolean }> {
	const existingCalendars = dependencies.findCalendars
		? await dependencies.findCalendars(stored.calendarName)
		: [];
	const managedCalendar = [...existingCalendars]
		.filter((item) => item.id.trim() && item.id !== 'primary')
		.sort((left, right) => left.id.localeCompare(right.id))[0];
	if (managedCalendar)
		return { id: assertSafeCalendarId(managedCalendar.id), origin: 'managed', created: false };
	const legacyCalendar =
		stored.scheduleKind !== 'exams' && dependencies.findLegacyCalendars
			? (await dependencies.findLegacyCalendars(stored.sourceKind, stored.semester))[0]
			: undefined;
	if (legacyCalendar)
		return { id: assertSafeCalendarId(legacyCalendar.id), origin: 'legacy', created: false };
	return {
		id: assertSafeCalendarId((await dependencies.createCalendar(stored.calendarName)).id),
		origin: 'managed',
		created: true
	};
}

function isCalendarWriteForbiddenOrMissing(message: string): boolean {
	return (
		/Google Calendar API (?:403|404):/iu.test(message) &&
		!/rateLimitExceeded|quotaExceeded|tạm giới hạn/iu.test(message)
	);
}

async function syncCalendar(
	dependencies: GoogleSyncDependencies,
	calendarId: string,
	calendarOrigin: 'managed' | 'legacy',
	localEvents: ManagedEvent[],
	eventsForSync: ManagedEvent[],
	allowDeletes: boolean
): Promise<SyncResult> {
	let leftoverDuplicateLegacyEvents: ManagedGoogleEvent[] = [];
	const gateway =
		calendarOrigin === 'legacy' && dependencies.gateway.listCalendarEvents
			? createLegacyMigrationGateway(dependencies.gateway, localEvents, (duplicates) => {
					leftoverDuplicateLegacyEvents = duplicates;
				})
			: dependencies.gateway;
	const result = await syncManagedCalendar(gateway, calendarId, eventsForSync, {
		allowDeletes,
		...(dependencies.onProgress ? { onProgress: dependencies.onProgress } : {})
	});

	if (!allowDeletes && leftoverDuplicateLegacyEvents.length > 0) {
		for (const duplicate of leftoverDuplicateLegacyEvents) {
			try {
				await dependencies.gateway.deleteEvent(calendarId, duplicate.id, duplicate.etag);
				result.deleted++;
				if (result.skippedDeletes > 0) result.skippedDeletes--;
			} catch (error) {
				result.failed.push({
					operation: 'delete',
					stableKey: duplicate.stableKey,
					eventId: duplicate.id,
					message: error instanceof Error ? error.message : String(error)
				});
			} finally {
				dependencies.onProgress?.(result);
			}
		}
	}

	return result;
}

async function cleanupExtraSemesterCalendars(
	stored: SyncProfile,
	activeCalendarId: string,
	localEvents: ManagedEvent[],
	dependencies: GoogleSyncDependencies,
	result: SyncResult
): Promise<void> {
	if (!dependencies.gateway.listCalendarEvents) return;
	const extraIds = new Set<string>();
	if (dependencies.findCalendars) {
		for (const item of await dependencies.findCalendars(stored.calendarName)) {
			if (item.id && item.id !== 'primary' && item.id !== activeCalendarId) {
				extraIds.add(item.id);
			}
		}
	}
	if (stored.scheduleKind !== 'exams' && dependencies.findLegacyCalendars) {
		for (const item of await dependencies.findLegacyCalendars(stored.sourceKind, stored.semester)) {
			if (item.id && item.id !== 'primary' && item.id !== activeCalendarId) {
				extraIds.add(item.id);
			}
		}
	}

	for (const extraCalendarId of extraIds) {
		let events: ManagedGoogleEvent[];
		try {
			events = await dependencies.gateway.listCalendarEvents(extraCalendarId);
		} catch {
			continue;
		}
		const duplicateCourseEvents = events.filter(
			(remote) =>
				!remote.stableKey.startsWith('legacy:') ||
				isLikelyLegacyBkalendarEvent(remote) ||
				localEvents.some((local) => matchesCourse(local, remote))
		);
		for (const remote of duplicateCourseEvents) {
			try {
				await dependencies.gateway.deleteEvent(extraCalendarId, remote.id, remote.etag);
				result.deleted++;
				dependencies.onProgress?.(result);
			} catch {
				// Ignore errors on secondary duplicate calendars so primary sync still succeeds.
			}
		}
	}
}

function createLegacyMigrationGateway(
	gateway: GoogleCalendarGateway,
	localEvents: ManagedEvent[],
	onDuplicateLegacyCourseEvents?: (duplicates: ManagedGoogleEvent[]) => void
): GoogleCalendarGateway {
	return {
		async listManagedEvents(calendarId) {
			const allEvents = await gateway.listCalendarEvents!(calendarId);
			const relevant = allEvents.filter(
				(event) =>
					!event.stableKey.startsWith('legacy:') ||
					isLikelyLegacyBkalendarEvent(event) ||
					localEvents.some((local) => matchesCourse(local, event))
			);
			const reconciled = reconcileLegacyEvents(localEvents, relevant);
			const duplicateLegacyCourseEvents = reconciled.filter(
				(item) =>
					item.stableKey.startsWith('legacy:') &&
					localEvents.some((local) => matchesCourse(local, item))
			);
			onDuplicateLegacyCourseEvents?.(duplicateLegacyCourseEvents);
			return reconciled;
		},
		...(gateway.listCalendarEvents
			? { listCalendarEvents: (calendarId: string) => gateway.listCalendarEvents!(calendarId) }
			: {}),
		insertEvent: (calendarId, event) => gateway.insertEvent(calendarId, event),
		patchEvent: (calendarId, eventId, event, etag) =>
			gateway.patchEvent(calendarId, eventId, event, etag),
		deleteEvent: (calendarId, eventId, etag) => gateway.deleteEvent(calendarId, eventId, etag)
	};
}

function reconcileLegacyEvents(
	localEvents: ManagedEvent[],
	legacyEvents: ManagedGoogleEvent[]
): ManagedGoogleEvent[] {
	const available = [...localEvents];
	const reconciled: ManagedGoogleEvent[] = [];

	for (const remote of legacyEvents) {
		if (!remote.stableKey.startsWith('legacy:')) {
			const exactIndex = available.findIndex((event) => event.stableKey === remote.stableKey);
			if (exactIndex >= 0) available.splice(exactIndex, 1);
			reconciled.push(remote);
		}
	}

	for (const legacy of legacyEvents) {
		if (!legacy.stableKey.startsWith('legacy:')) continue;
		let matchIndex = available.findIndex((event) => matchesLegacyEvent(event, legacy, true));
		if (matchIndex < 0) {
			matchIndex = available.findIndex((event) => matchesLegacyEvent(event, legacy, false));
		}
		if (matchIndex < 0) {
			reconciled.push(legacy);
			continue;
		}
		const [event] = available.splice(matchIndex, 1);
		reconciled.push({
			...legacy,
			stableKey: event!.stableKey,
			fingerprint: legacy.fingerprint
		});
	}

	return reconciled;
}

function matchesLegacyEvent(
	event: ManagedEvent,
	legacy: ManagedGoogleEvent,
	strictTimeAndLocation = true
): boolean {
	if (!matchesCourse(event, legacy)) return false;
	if (!strictTimeAndLocation) return true;
	if (
		legacy.location &&
		event.location &&
		legacy.location.trim().toLocaleUpperCase('vi') !== event.location.trim().toLocaleUpperCase('vi')
	) {
		return false;
	}
	if (legacy.start && !sameInstantOrSlot(legacy.start, event.start)) return false;
	return true;
}

function matchesCourse(event: ManagedEvent, legacy: ManagedGoogleEvent): boolean {
	const courseCode = event.courseCode.trim().toLocaleUpperCase('vi');
	const description = legacy.description?.toLocaleUpperCase('vi') ?? '';
	const rawSummary = legacy.summary?.trim() ?? '';
	const summary = rawSummary.toLocaleUpperCase('vi');
	const strippedSummary = rawSummary
		.replace(/^[^\p{L}\p{N}]+\s*/u, '')
		.trim()
		.toLocaleUpperCase('vi');
	const title = event.title.trim().toLocaleUpperCase('vi');
	return (
		(courseCode.length > 0 && (description.includes(courseCode) || summary.includes(courseCode))) ||
		summary === title ||
		strippedSummary === title
	);
}

function sameInstantOrSlot(leftIso: string, rightIso: string): boolean {
	if (leftIso === rightIso) return true;
	const leftMs = Date.parse(leftIso);
	const rightMs = Date.parse(rightIso);
	if (Number.isFinite(leftMs) && Number.isFinite(rightMs) && leftMs === rightMs) return true;
	if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return false;
	return hcmSlotKey(new Date(leftMs)) === hcmSlotKey(new Date(rightMs));
}

function hcmSlotKey(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
		timeZone: 'Asia/Ho_Chi_Minh',
		weekday: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? '';
	return `${get('weekday')}:${get('hour')}:${get('minute')}`;
}

function isLikelyLegacyBkalendarEvent(event: ManagedGoogleEvent): boolean {
	const description = event.description ?? '';
	return (
		/(?:course\s*code|mã môn học|mã mh|nhóm\s*tổ|nhóm-tổ|lớp)\s*:/iu.test(description) ||
		/^\s*(?:[A-Z]{2,4}\d{4}|🧮|📘|📚|🧪)/u.test(event.summary ?? '')
	);
}

function assertSafeCalendarId(calendarId: string): string {
	const normalized = calendarId.trim();
	if (!normalized) throw new Error('Google Calendar không trả về calendar ID.');
	if (normalized === 'primary') {
		throw new Error('BKalendar từ chối đồng bộ vào lịch cá nhân mặc định.');
	}
	return normalized;
}
