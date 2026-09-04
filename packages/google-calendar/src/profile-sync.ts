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

	if (!calendarId) {
		const resolved = await resolveCalendar(stored, dependencies);
		calendarId = resolved.id;
		calendarOrigin = resolved.origin;
		profile = { ...stored, calendarId, calendarOrigin };
		await store.save(profile);
	} else {
		calendarId = assertSafeCalendarId(calendarId);
		if (!stored.calendarOrigin && dependencies.findLegacyCalendars) {
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
		if (!(error instanceof GoogleCalendarApiError) || error.status !== 404 || !stored.calendarId) {
			throw error;
		}
		const { calendarId: _oldCalendarId, calendarOrigin: _oldOrigin, ...withoutCalendar } = stored;
		const resolved = await resolveCalendar(withoutCalendar, dependencies);
		calendarId = resolved.id;
		calendarOrigin = resolved.origin;
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
): Promise<{ id: string; origin: 'managed' | 'legacy' }> {
	const existingCalendars = dependencies.findCalendars
		? await dependencies.findCalendars(stored.calendarName)
		: [];
	const managedCalendar = [...existingCalendars]
		.filter((item) => item.id.trim() && item.id !== 'primary')
		.sort((left, right) => left.id.localeCompare(right.id))[0];
	if (managedCalendar) return { id: assertSafeCalendarId(managedCalendar.id), origin: 'managed' };
	const legacyCalendar = dependencies.findLegacyCalendars
		? (await dependencies.findLegacyCalendars(stored.sourceKind, stored.semester))[0]
		: undefined;
	if (legacyCalendar) return { id: assertSafeCalendarId(legacyCalendar.id), origin: 'legacy' };
	return {
		id: assertSafeCalendarId((await dependencies.createCalendar(stored.calendarName)).id),
		origin: 'managed'
	};
}

async function syncCalendar(
	dependencies: GoogleSyncDependencies,
	calendarId: string,
	calendarOrigin: 'managed' | 'legacy',
	localEvents: ManagedEvent[],
	eventsForSync: ManagedEvent[],
	allowDeletes: boolean
): Promise<SyncResult> {
	const gateway =
		calendarOrigin === 'legacy' && dependencies.gateway.listCalendarEvents
			? createLegacyMigrationGateway(dependencies.gateway, localEvents)
			: dependencies.gateway;
	return await syncManagedCalendar(gateway, calendarId, eventsForSync, {
		allowDeletes,
		...(dependencies.onProgress ? { onProgress: dependencies.onProgress } : {})
	});
}

function createLegacyMigrationGateway(
	gateway: GoogleCalendarGateway,
	localEvents: ManagedEvent[]
): GoogleCalendarGateway {
	return {
		...gateway,
		async listManagedEvents(calendarId) {
			const legacyEvents = await gateway.listCalendarEvents!(calendarId);
			return reconcileLegacyEvents(localEvents, legacyEvents.filter(isLikelyLegacyBkalendarEvent));
		}
	};
}

function reconcileLegacyEvents(
	localEvents: ManagedEvent[],
	legacyEvents: ManagedGoogleEvent[]
): ManagedGoogleEvent[] {
	const available = [...localEvents];
	return legacyEvents.map((legacy) => {
		const matchIndex = available.findIndex((event) => matchesLegacyEvent(event, legacy));
		if (matchIndex < 0) return legacy;
		const [event] = available.splice(matchIndex, 1);
		return {
			...legacy,
			stableKey: event!.stableKey,
			fingerprint: legacy.fingerprint
		};
	});
}

function matchesLegacyEvent(event: ManagedEvent, legacy: ManagedGoogleEvent): boolean {
	const courseCode = event.courseCode.trim().toLocaleUpperCase('vi');
	const description = legacy.description?.toLocaleUpperCase('vi') ?? '';
	const summary = legacy.summary?.trim().toLocaleUpperCase('vi') ?? '';
	const courseMatches =
		description.includes(courseCode) || summary === event.title.trim().toLocaleUpperCase('vi');
	if (!courseMatches) return false;
	if (legacy.location && legacy.location.trim() !== event.location.trim()) return false;
	if (legacy.start && legacy.start !== event.start) return false;
	return true;
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
