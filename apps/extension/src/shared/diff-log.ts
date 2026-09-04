import type { ManagedEvent, TimetableDiff } from '../../../../packages/timetable/src/index.ts';

export const LAST_DIFF_STORAGE_KEY = 'bkalendar-next:last-diff';

export interface DiffDetail {
	kind: 'added' | 'changed' | 'removed';
	title: string;
	description: string;
}

export interface StoredDiffLog {
	schemaVersion: 1;
	profileId: string;
	outcome: 'applied' | 'review';
	createdAt: string;
	details: DiffDetail[];
}

export function createDiffLog(
	profileId: string,
	outcome: StoredDiffLog['outcome'],
	diff: TimetableDiff,
	createdAt: string
): StoredDiffLog {
	return {
		schemaVersion: 1,
		profileId,
		outcome,
		createdAt,
		details: [
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
		]
	};
}

export function readStoredDiffLog(value: unknown): StoredDiffLog | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const log = value as Partial<StoredDiffLog>;
	if (
		log.schemaVersion !== 1 ||
		typeof log.profileId !== 'string' ||
		(log.outcome !== 'applied' && log.outcome !== 'review') ||
		typeof log.createdAt !== 'string' ||
		!Array.isArray(log.details)
	) {
		return undefined;
	}
	const details = log.details.flatMap((item): DiffDetail[] => {
		if (!item || typeof item !== 'object') return [];
		const detail = item as Partial<DiffDetail>;
		if (
			(detail.kind !== 'added' && detail.kind !== 'changed' && detail.kind !== 'removed') ||
			typeof detail.title !== 'string' ||
			typeof detail.description !== 'string'
		) {
			return [];
		}
		return [
			{
				kind: detail.kind,
				title: detail.title,
				description: detail.description
			}
		];
	});
	return {
		schemaVersion: 1,
		profileId: log.profileId,
		outcome: log.outcome,
		createdAt: log.createdAt,
		details
	};
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
