import {
	syncManagedCalendar,
	type GoogleCalendarGateway,
	type SyncResult
} from '../../../../packages/google-calendar/src/index.ts';
import { diffSnapshots, type TimetableDiff } from '../../../../packages/timetable/src/index.ts';
import type { ProfileStore, SyncProfile } from '../../../../packages/timetable/src/storage.ts';

export interface GoogleSyncDependencies {
	gateway: GoogleCalendarGateway;
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
	let profile = stored;
	let calendarId = stored.calendarId;

	if (!calendarId) {
		const calendar = await dependencies.createCalendar(stored.calendarName);
		if (!calendar.id.trim()) throw new Error('Google Calendar không trả về calendar ID.');
		calendarId = calendar.id;
		profile = { ...stored, calendarId };
		await store.save(profile);
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
	const hasBlockedRemovals = diff.removed.length > 0 && !diff.canDelete;
	const promoted = result.failed.length === 0 && !hasBlockedRemovals;

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
