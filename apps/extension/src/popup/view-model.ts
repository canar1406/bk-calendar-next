import type { ExtensionStatus } from '../background/status.ts';
import type { TrackingMode } from '../background/tracking-policy.ts';
import {
	diffSnapshots,
	type ManagedEvent,
	type SourceKind,
	type TimetableSnapshot
} from '../../../../packages/timetable/src/index.ts';
import { readStoredDiffLog, type DiffDetail } from '../shared/diff-log.ts';
import { isSourceKind, sourceDisplayName, supportsBackgroundTracking } from './source-selection.ts';

export interface StoredProfileSummary {
	profileId: string;
	sourceKind: SourceKind;
	semester: number;
	calendarName: string;
	lastCheckedAt?: string;
	pendingEventCount: number;
}

export interface PopupViewModel {
	tone: 'idle' | 'complete' | 'warning' | 'error';
	title: string;
	detail: string;
	summaryLabel: string;
	removedLabel: string;
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
	actionKind:
		'background-check' | 'open-web-review' | 'show-diff' | 'open-settings' | 'connect-google';
	actionUrl?: string;
}

export const WEB_REVIEW_URL = 'https://canar1406.github.io/bk-calendar-next/?from=extension';

export function selectCurrentProfile(
	profiles: StoredProfileSummary[],
	sourceKind?: SourceKind
): StoredProfileSummary | undefined {
	return profiles
		.filter((profile) => sourceKind === undefined || profile.sourceKind === sourceKind)
		.sort((a, b) => timestamp(b.lastCheckedAt) - timestamp(a.lastCheckedAt))[0];
}

export function buildPopupViewModel(
	status: ExtensionStatus,
	profile?: StoredProfileSummary,
	configured?: boolean,
	trackingMode?: TrackingMode,
	googleConnected?: boolean,
	sourceKind: SourceKind = 'student-2024'
): PopupViewModel {
	const emptyCounts = { added: 0, changed: 0, removed: 0 };

	if (!supportsBackgroundTracking(sourceKind)) {
		const sourceName = sourceDisplayName(sourceKind);
		return {
			tone: profile ? 'complete' : 'idle',
			summaryLabel: profile ? 'Đã đồng bộ cục bộ' : 'Chưa đồng bộ',
			removedLabel: 'Đã xóa',
			title: profile ? `Đã nhận lịch ${sourceName}` : `Chưa có lịch ${sourceName}`,
			detail: profile
				? 'Hồ sơ này đã được đồng bộ cục bộ từ BKalendar Web. Extension chỉ hiển thị đúng nguồn đã chọn và không giả vờ tự theo dõi trang chưa được hỗ trợ.'
				: 'Hãy nhập lịch trên BKalendar Web; hồ sơ, màu và icon sẽ được chuyển sang extension qua kết nối cục bộ.',
			...(profile
				? {
						profileLabel: `Học kỳ ${profile.semester} · ${profile.pendingEventCount} buổi học`,
						...(profile.lastCheckedAt
							? { capturedLabel: formatDateTime(profile.lastCheckedAt) }
							: {})
					}
				: {}),
			counts: emptyCounts,
			deletionBlocked: false,
			actionLabel: profile ? 'Xem lịch trên BKalendar Web' : 'Mở BKalendar Web để nhập lịch',
			actionKind: 'open-web-review',
			actionUrl: WEB_REVIEW_URL
		};
	}

	if (configured === false) {
		return {
			tone: 'idle',
			summaryLabel: 'Chưa đồng bộ',
			removedLabel: 'Có thể xóa',
			title: 'Chưa cấu hình MyBK',
			detail: 'Hãy lưu tài khoản MyBK trong thiết lập để bắt đầu theo dõi thời khóa biểu.',
			counts: emptyCounts,
			deletionBlocked: false,
			actionLabel: 'Thiết lập tài khoản MyBK',
			actionKind: 'open-settings'
		};
	}

	if (trackingMode === 'auto-safe' && googleConnected === false) {
		return {
			tone: 'warning',
			summaryLabel: 'Chưa đồng bộ',
			removedLabel: 'Có thể xóa',
			title: 'Cần kết nối Google Calendar',
			detail:
				'Chế độ tự động chưa thể chạy vì Google Calendar chưa được kết nối. Hãy cấp quyền một lần để bật tự động cập nhật.',
			counts: emptyCounts,
			deletionBlocked: false,
			actionLabel: 'Kết nối Google Calendar',
			actionKind: 'connect-google'
		};
	}

	if (status.state === 'idle') {
		return {
			tone: 'idle',
			summaryLabel: 'Chưa đồng bộ',
			removedLabel: 'Có thể xóa',
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
			summaryLabel: 'Chưa đồng bộ',
			removedLabel: 'Có thể xóa',
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
	const zeroWriteSync = alreadyApplied && total === 0;
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
		summaryLabel: alreadyApplied ? 'Đã đồng bộ' : 'Chưa đồng bộ',
		removedLabel: alreadyApplied ? 'Đã xóa' : 'Có thể xóa',
		title: zeroWriteSync
			? 'Lịch đã khớp Google Calendar'
			: alreadyApplied
				? 'Đã tự động cập nhật'
				: status.changes === undefined
					? 'Đã lưu bản xem trước cục bộ'
					: total === 0
						? 'Không có thay đổi'
						: `${total} thay đổi cần xem lại`,
		detail: zeroWriteSync
			? 'Không có thay đổi mới. Không cần thêm, sửa hoặc xóa sự kiện trong lần kiểm tra này.'
			: alreadyApplied
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
		actionLabel: zeroWriteSync
			? 'Mở BKalendar Web'
			: alreadyApplied
				? 'Xem diff chi tiết'
				: 'Xem lại trên BKalendar',
		actionKind: zeroWriteSync
			? 'open-web-review'
			: alreadyApplied
				? 'show-diff'
				: 'open-web-review',
		...(zeroWriteSync || !alreadyApplied ? { actionUrl: WEB_REVIEW_URL } : {})
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
			!isSourceKind(profile.sourceKind) ||
			typeof profile.calendarName !== 'string'
		) {
			return [];
		}

		const currentSnapshot =
			profile.pendingSnapshot && typeof profile.pendingSnapshot === 'object'
				? (profile.pendingSnapshot as Record<string, unknown>)
				: profile.acceptedSnapshot && typeof profile.acceptedSnapshot === 'object'
					? (profile.acceptedSnapshot as Record<string, unknown>)
					: undefined;

		return [
			{
				profileId: profile.profileId,
				sourceKind: profile.sourceKind,
				semester: profile.semester,
				calendarName: profile.calendarName,
				...(typeof profile.lastCheckedAt === 'string'
					? { lastCheckedAt: profile.lastCheckedAt }
					: {}),
				pendingEventCount: Array.isArray(currentSnapshot?.events)
					? currentSnapshot.events.length
					: 0
			}
		];
	});
}

export function buildStoredDiffDetails(
	value: unknown,
	lastDiff?: unknown,
	sourceKind?: SourceKind
): DiffDetail[] {
	const storedLog = readStoredDiffLog(lastDiff);
	if (
		storedLog?.details.length &&
		(sourceKind === undefined || storedLog.profileId.startsWith(`${sourceKind}:`))
	) {
		return storedLog.details;
	}
	const profile = selectNewestProfileWithPendingSnapshot(value, sourceKind);
	if (!profile) return [];
	try {
		const diff = diffSnapshots(profile.acceptedSnapshot, profile.pendingSnapshot);
		return [
			...diff.added.map(({ after }) => ({
				kind: 'added' as const,
				courseCode: after.courseCode,
				title: eventTitle(after),
				description: `Thêm ${eventSchedule(after)}`
			})),
			...diff.changed.map(({ before, after, changedFields }) => ({
				kind: 'changed' as const,
				courseCode: after.courseCode,
				title: eventTitle(after),
				description: describeChangedFields(before, after, changedFields)
			})),
			...diff.removed.map(({ before }) => ({
				kind: 'removed' as const,
				courseCode: before.courseCode,
				title: eventTitle(before),
				description: `Không còn thấy ${eventSchedule(before)} trên MyBK`
			}))
		];
	} catch {
		return [];
	}
}

export function buildFallbackDiffDetails(status: ExtensionStatus): DiffDetail[] {
	if (status.state !== 'captured' || status.syncState !== 'applied' || !status.changes) return [];
	const { added, changed, removed } = status.changes;
	const total = added + changed + removed;
	if (total === 0) return [];
	const operations = [
		added > 0 ? `${added} buổi thêm mới` : '',
		changed > 0 ? `${changed} buổi thay đổi` : '',
		removed > 0 ? `${removed} buổi đã xóa` : ''
	].filter(Boolean);
	return [
		{
			kind: 'changed',
			title: 'Google Calendar',
			description: `Đã tự động cập nhật ${operations.join(', ')}. Chi tiết từng buổi không còn trong log cục bộ.`
		}
	];
}

function selectNewestProfileWithPendingSnapshot(
	value: unknown,
	sourceKind?: SourceKind
): { acceptedSnapshot?: TimetableSnapshot; pendingSnapshot: TimetableSnapshot } | undefined {
	if (!Array.isArray(value)) return undefined;
	return value
		.flatMap((item) => {
			if (!item || typeof item !== 'object') return [];
			const profile = item as Record<string, unknown>;
			if (!isSnapshot(profile.pendingSnapshot)) return [];
			if (sourceKind !== undefined && profile.pendingSnapshot.sourceKind !== sourceKind) return [];
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
