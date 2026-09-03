import type { ExtensionStatus } from '../background/status.ts';

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
	actionUrl: string;
}

export const MYBK_TIMETABLE_URL = 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb';
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
			actionLabel: 'Mở thời khóa biểu MyBK',
			actionUrl: MYBK_TIMETABLE_URL
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
			actionLabel: 'Mở MyBK để thử lại',
			actionUrl: MYBK_TIMETABLE_URL
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
		title:
			status.changes === undefined
				? 'Đã lưu bản xem trước cục bộ'
				: total === 0
					? 'Không có thay đổi'
					: `${total} thay đổi cần xem lại`,
		detail:
			status.changes === undefined
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
		actionLabel: 'Xem lại trên BKalendar',
		actionUrl: WEB_REVIEW_URL
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
