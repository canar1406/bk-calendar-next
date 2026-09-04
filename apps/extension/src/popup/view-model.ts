import type { ExtensionStatus } from '../background/status.ts';
import {
	diffSnapshots,
	type ManagedEvent,
	type TimetableSnapshot
} from '../../../../packages/timetable/src/index.ts';
import { readStoredDiffLog, type DiffDetail } from '../shared/diff-log.ts';

export interface StoredProfileSummary {
	profileId: string;
	semester: number;
	calendarName: string;
	lastCheckedAt?: string;
	pendingEventCount: number;
}

export interface PopupViewModel {
	tone: 'idle' | 'complete' | 'warning' | 'error';
	title: string;
	detail: string;
	profileLabel?: string;
	capturedLabel?: string;
	counts: {
		added: number;
		changed: number;
		removed: number;
	};
	deletionBlocked: boolean;
	warning?: string;
	actionLabel: string;
	actionKind: 'background-check' | 'open-web-review' | 'show-diff';
	actionUrl?: string;
}

export const WEB_REVIEW_URL = 'https://canar1406.github.io/bk-calendar-next/?from=extension';

export function selectCurrentProfile(
	profiles: StoredProfileSummary[]
): StoredProfileSummary | undefined {
	return [...profiles].sort((a, b) => timestamp(b.lastCheckedAt) - timestamp(a.lastCheckedAt))[0];
}

export function buildPopupViewModel(
	status: ExtensionStatus,
	profile?: StoredProfileSummary
): PopupViewModel {
	const emptyCounts = { added: 0, changed: 0, removed: 0 };

	if (status.state === 'idle') {
		return {
			tone: 'idle',
			title: 'Chưa có dữ liệu để xem',
			detail: 'Mở trang thời khóa biểu MyBK để tiện ích đọc và lưu bản xem trước cục bộ.',
			counts: emptyCounts,
			deletionBlocked: false,
			actionLabel: 'Kiểm tra MyBK trong nền',
			actionKind: 'background-check'
		};
	}

	if (status.state === 'error') {
		return {
			tone: 'error',
			title: 'Chưa đọc được lịch',
			detail: status.message,
			capturedLabel: formatDateTime(status.checkedAt),
			counts: emptyCounts,
			deletionBlocked: false,
			actionLabel: 'Thử lại trong nền',
			actionKind: 'background-check'
		};
	}

	const counts = status.changes
		? {
				added: status.changes.added,
				changed: status.changes.changed,
				removed: status.changes.removed
			}
		: emptyCounts;
	const total = counts.added + counts.changed + counts.removed;
	const alreadyApplied = status.syncState === 'applied';
	const deletionBlocked =
		counts.removed > 0 &&
		(status.changes?.canDelete === false || status.completeness.state !== 'complete');
	const warning = deletionBlocked
		? deletionWarning(counts.removed, status.completeness)
		: status.completeness.state !== 'complete'
			? 'Dữ liệu chưa được xác nhận đầy đủ. BKalendar sẽ không coi các mục vắng mặt là đã bị xóa.'
			: undefined;

	return {
		tone: status.completeness.state === 'complete' ? 'complete' : 'warning',
		title: alreadyApplied
			? 'Đã tự động cập nhật'
			: status.changes === undefined
				? 'Đã lưu bản xem trước cục bộ'
				: total === 0
					? 'Không có thay đổi'
					: `${total} thay đổi cần xem lại`,
		detail: alreadyApplied
			? `${total} thay đổi đã được ghi vào Google Calendar. Mở diff bên dưới để xem chi tiết.`
			: status.changes === undefined
				? `Đã đọc ${status.completeness.parsedRows} dòng từ MyBK.`
				: `${status.changes.unchanged} mục không đổi. Chưa có dữ liệu nào được ghi vào Google Calendar.`,
		...(profile
			? {
					profileLabel: `Học kỳ ${profile.semester} · ${profile.pendingEventCount} buổi học`
				}
			: {}),
		capturedLabel: formatDateTime(status.capturedAt),
		counts,
		deletionBlocked,
		...(warning ? { warning } : {}),
		actionLabel: alreadyApplied ? 'Xem diff chi tiết' : 'Xem lại trên BKalendar',
		actionKind: alreadyApplied ? 'show-diff' : 'open-web-review',
		...(alreadyApplied ? {} : { actionUrl: WEB_REVIEW_URL })
	};
}

export function summarizeStoredProfiles(value: unknown): StoredProfileSummary[] {
	if (!Array.isArray(value)) return [];

	return value.flatMap((item): StoredProfileSummary[] => {
		if (!item || typeof item !== 'object') return [];
		const profile = item as Record<string, unknown>;
		if (
			typeof profile.profileId !== 'string' ||
			typeof profile.semester !== 'number' ||
			typeof profile.calendarName !== 'string'
		) {
			return [];
		}

		const pendingSnapshot =
			profile.pendingSnapshot && typeof profile.pendingSnapshot === 'object'
				? (profile.pendingSnapshot as Record<string, unknown>)
				: undefined;

		return [
			{
				profileId: profile.profileId,
				semester: profile.semester,
				calendarName: profile.calendarName,
				...(typeof profile.lastCheckedAt === 'string'
					? { lastCheckedAt: profile.lastCheckedAt }
					: {}),
				pendingEventCount: Array.isArray(pendingSnapshot?.events)
					? pendingSnapshot.events.length
					: 0
			}
		];
	});
}

export function buildStoredDiffDetails(value: unknown, lastDiff?: unknown): DiffDetail[] {
	const storedLog = readStoredDiffLog(lastDiff);
	if (storedLog?.details.length) return storedLog.details;
	const profile = selectNewestProfileWithPendingSnapshot(value);
	if (!profile) return [];
	try {
		const diff = diffSnapshots(profile.acceptedSnapshot, profile.pendingSnapshot);
		return [
			...diff.added.map(({ after }) => ({
				kind: 'added' as const,
				title: eventTitle(after),
				description: `Thêm ${eventSchedule(after)}`
			})),
			...diff.changed.map(({ before, after, changedFields }) => ({
				kind: 'changed' as const,
				title: eventTitle(after),
				description: describeChangedFields(before, after, changedFields)
			})),
			...diff.removed.map(({ before }) => ({
				kind: 'removed' as const,
				title: eventTitle(before),
				description: `Không còn thấy ${eventSchedule(before)} trên MyBK`
			}))
		];
	} catch {
		return [];
	}
}

function selectNewestProfileWithPendingSnapshot(
	value: unknown
): { acceptedSnapshot?: TimetableSnapshot; pendingSnapshot: TimetableSnapshot } | undefined {
	if (!Array.isArray(value)) return undefined;
	return value
		.flatMap((item) => {
			if (!item || typeof item !== 'object') return [];
			const profile = item as Record<string, unknown>;
			if (!isSnapshot(profile.pendingSnapshot)) return [];
			return [
				{
					...(isSnapshot(profile.acceptedSnapshot)
						? { acceptedSnapshot: profile.acceptedSnapshot }
						: {}),
					pendingSnapshot: profile.pendingSnapshot,
					lastCheckedAt: typeof profile.lastCheckedAt === 'string' ? profile.lastCheckedAt : ''
				}
			];
		})
		.sort((a, b) => timestamp(b.lastCheckedAt) - timestamp(a.lastCheckedAt))[0];
}

function isSnapshot(value: unknown): value is TimetableSnapshot {
	if (!value || typeof value !== 'object') return false;
	const snapshot = value as Partial<TimetableSnapshot>;
	return (
		snapshot.schemaVersion === 1 &&
		typeof snapshot.semester === 'number' &&
		typeof snapshot.sourceKind === 'string' &&
		typeof snapshot.capturedAt === 'string' &&
		typeof snapshot.fingerprint === 'string' &&
		Array.isArray(snapshot.events)
	);
}

function eventTitle(event: ManagedEvent): string {
	return `${event.courseCode} · ${event.title}`;
}

function eventSchedule(event: ManagedEvent): string {
	return `${weekdayLabel(event.weekday)}, ${timeLabel(event.start)}–${timeLabel(event.end)}, ${event.location || 'chưa có phòng'}`;
}

function describeChangedFields(
	before: ManagedEvent,
	after: ManagedEvent,
	changedFields: string[]
): string {
	const descriptions: string[] = [];
	if (changedFields.includes('location')) {
		descriptions.push(`Phòng: ${before.location || 'chưa có'} → ${after.location || 'chưa có'}`);
	}
	if (changedFields.includes('start') || changedFields.includes('end')) {
		descriptions.push(
			`Giờ: ${timeLabel(before.start)}–${timeLabel(before.end)} → ${timeLabel(after.start)}–${timeLabel(after.end)}`
		);
	}
	if (changedFields.includes('activeWeekIndexes') || changedFields.includes('excludedStarts')) {
		descriptions.push('Tuần học đã thay đổi');
	}
	if (changedFields.includes('title')) {
		descriptions.push(`Tên môn: ${before.title} → ${after.title}`);
	}
	if (changedFields.includes('metadata')) descriptions.push('Thông tin lớp đã thay đổi');
	return descriptions.join(' · ') || 'Nội dung buổi học đã thay đổi';
}

function weekdayLabel(weekday: number): string {
	if (weekday === 8) return 'Chủ nhật';
	return `Thứ ${weekday}`;
}

function timeLabel(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'không rõ giờ';
	return new Intl.DateTimeFormat('vi-VN', {
		timeZone: 'Asia/Ho_Chi_Minh',
		hour: '2-digit',
		minute: '2-digit'
	}).format(date);
}

function deletionWarning(
	removed: number,
	completeness: Extract<ExtensionStatus, { state: 'captured' }>['completeness']
): string {
	if (completeness.state === 'incomplete') {
		return `Đang chặn xóa ${removed} mục vì MyBK mới đọc ${completeness.parsedRows}/${completeness.expectedRows} dòng. Hãy mở đủ tất cả trang dữ liệu rồi kiểm tra lại.`;
	}
	return `Đang chặn xóa ${removed} mục vì chưa xác nhận đã đọc đủ dữ liệu MyBK.`;
}

function formatDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Không rõ thời điểm';
	return new Intl.DateTimeFormat('vi-VN', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(date);
}

function timestamp(value: string | undefined): number {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}
