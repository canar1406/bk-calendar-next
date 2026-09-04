import { syncManagedCalendar, type GoogleCalendarGateway, type SyncResult } from './index.ts';
import { diffSnapshots, type TimetableDiff } from '../../timetable/src/index.ts';
import type { ProfileStore, SyncProfile } from '../../timetable/src/storage.ts';

export interface GoogleSyncDependencies {
	gateway: GoogleCalendarGateway;
	findCalendars?(summary: string): Promise<Array<{ id: string }>>;
	createCalendar(summary: string): Promise<{ id: string }>;
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

	if (!calendarId) {
		const existingCalendars = dependencies.findCalendars
			? await dependencies.findCalendars(stored.calendarName)
			: [];
		const calendar =
			[...existingCalendars]
				.filter((item) => item.id.trim() && item.id !== 'primary')
				.sort((left, right) => left.id.localeCompare(right.id))[0] ??
			(await dependencies.createCalendar(stored.calendarName));
		calendarId = assertSafeCalendarId(calendar.id);
		profile = { ...stored, calendarId };
		await store.save(profile);
	} else {
		calendarId = assertSafeCalendarId(calendarId);
	}

	const diff = diffSnapshots(profile.acceptedSnapshot, pendingSnapshot);
	const result = await syncManagedCalendar(
		dependencies.gateway,
		calendarId,
		pendingSnapshot.events,
		{
			allowDeletes: diff.canDelete,
			...(dependencies.onProgress ? { onProgress: dependencies.onProgress } : {})
		}
	);
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

function assertSafeCalendarId(calendarId: string): string {
	const normalized = calendarId.trim();
	if (!normalized) throw new Error('Google Calendar không trả về calendar ID.');
	if (normalized === 'primary') {
		throw new Error('BKalendar từ chối đồng bộ vào lịch cá nhân mặc định.');
	}
	return normalized;
}
