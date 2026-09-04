import type { ChangeSummary } from './tracking-policy.ts';

export const TRACKING_NOTIFICATION_ID = 'bkalendar-next:timetable-change';

export type TrackingNotificationKind = 'applied' | 'review';

export interface TrackingNotification {
	title: string;
	message: string;
}

export function buildTrackingNotification(
	kind: TrackingNotificationKind,
	changes: ChangeSummary
): TrackingNotification {
	const parts = [
		changes.added ? `${changes.added} thêm mới` : '',
		changes.changed ? `${changes.changed} thay đổi` : '',
		changes.removed ? `${changes.removed} ${kind === 'applied' ? 'đã xóa' : 'có thể bị xóa'}` : ''
	].filter(Boolean);
	const summary = parts.join(', ') || 'Không có thay đổi';
	return kind === 'applied'
		? {
				title: 'BKalendar đã cập nhật thời khóa biểu',
				message: `${summary}. Nhấn để xem diff chi tiết.`
			}
		: {
				title: 'BKalendar phát hiện thay đổi',
				message: `${summary}; chưa cập nhật Google Calendar. Nhấn để xem và duyệt diff.`
			};
}

export function isTrackingNotification(notificationId: string): boolean {
	return (
		notificationId === TRACKING_NOTIFICATION_ID ||
		notificationId.startsWith(`${TRACKING_NOTIFICATION_ID}:`)
	);
}
