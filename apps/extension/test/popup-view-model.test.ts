import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	buildStoredDiffDetails,
	buildFallbackDiffDetails,
	buildPopupViewModel,
	selectCurrentProfile,
	summarizeStoredProfiles,
	type StoredProfileSummary
} from '../src/popup/view-model.ts';
import type { ExtensionStatus } from '../src/background/status.ts';

const capturedStatus: ExtensionStatus = {
	state: 'captured',
	capturedAt: '2026-09-03T01:00:00.000Z',
	completeness: { state: 'complete', parsedRows: 12, expectedRows: 12 },
	changes: {
		added: 2,
		changed: 1,
		removed: 1,
		unchanged: 8,
		canDelete: true
	}
};

const currentProfile: StoredProfileSummary = {
	profileId: 'student-2024:261',
	sourceKind: 'student-2024',
	semester: 261,
	calendarName: 'BKalendar • HK 261',
	lastCheckedAt: '2026-09-03T01:00:00.000Z',
	pendingEventCount: 12
};

describe('extension popup view model', () => {
	it('describes a successful zero-write sync without claiming new updates or offering an empty diff', () => {
		const view = buildPopupViewModel({
			...capturedStatus,
			syncState: 'applied',
			changes: { added: 0, changed: 0, removed: 0, unchanged: 8, canDelete: true }
		});
		assert.equal(view.title, 'Lịch đã khớp Google Calendar');
		assert.equal(
			view.detail,
			'Không có thay đổi mới. Không cần thêm, sửa hoặc xóa sự kiện trong lần kiểm tra này.'
		);
		assert.equal(view.summaryLabel, 'Đã đồng bộ');
		assert.equal(view.removedLabel, 'Đã xóa');
		assert.equal(view.actionKind, 'open-web-review');
		assert.ok(view.actionUrl);
		assert.deepEqual(view.counts, { added: 0, changed: 0, removed: 0 });
	});

	it('labels completed writes as synced and removed events as already deleted', () => {
		const view = buildPopupViewModel({ ...capturedStatus, syncState: 'applied' });
		assert.equal(view.summaryLabel, 'Đã đồng bộ');
		assert.equal(view.removedLabel, 'Đã xóa');
		assert.equal(view.title, 'Đã tự động cập nhật');
		assert.equal(view.actionKind, 'show-diff');
	});

	it('does not describe an unapproved zero-change review as synchronized', () => {
		const view = buildPopupViewModel({
			...capturedStatus,
			syncState: 'review',
			changes: { added: 0, changed: 0, removed: 0, unchanged: 8, canDelete: true }
		});
		assert.equal(view.summaryLabel, 'Chưa đồng bộ');
		assert.equal(view.removedLabel, 'Có thể xóa');
		assert.equal(view.title, 'Không có thay đổi');
	});

	it('builds a detailed diff that can be opened from a notification', () => {
		const baseEvent = {
			stableKey: 'physics',
			fingerprint: 'old',
			sourceKind: 'student-2024',
			semester: 261,
			courseCode: 'PH1003',
			group: 'L12',
			sessionOrdinal: 0,
			weekday: 3,
			title: 'Vật lý 1',
			location: 'H3-301',
			start: '2026-08-25T05:00:00.000Z',
			end: '2026-08-25T07:50:00.000Z',
			timeZone: 'Asia/Ho_Chi_Minh',
			activeWeekIndexes: [0, 2],
			excludedStarts: ['2026-09-01T05:00:00.000Z'],
			metadata: { courseCode: 'PH1003' }
		} as const;
		const details = buildStoredDiffDetails([
			{
				schemaVersion: 1,
				profileId: 'student-2024:261',
				sourceKind: 'student-2024',
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-04T01:00:00.000Z',
				acceptedSnapshot: {
					schemaVersion: 1,
					sourceKind: 'student-2024',
					semester: 261,
					capturedAt: '2026-09-03T01:00:00.000Z',
					fingerprint: 'before',
					warnings: [],
					completeness: { state: 'complete', parsedRows: 2, expectedRows: 2 },
					events: [
						baseEvent,
						{
							...baseEvent,
							stableKey: 'removed',
							fingerprint: 'removed',
							courseCode: 'AS1001',
							title: 'Nhập môn Vẽ kỹ thuật'
						}
					]
				},
				pendingSnapshot: {
					schemaVersion: 1,
					sourceKind: 'student-2024',
					semester: 261,
					capturedAt: '2026-09-04T01:00:00.000Z',
					fingerprint: 'after',
					warnings: [],
					completeness: { state: 'complete', parsedRows: 2, expectedRows: 2 },
					events: [
						{
							...baseEvent,
							fingerprint: 'new',
							location: 'H3-302'
						},
						{
							...baseEvent,
							stableKey: 'added',
							fingerprint: 'added',
							courseCode: 'PE1013',
							title: 'Bóng bàn'
						}
					]
				}
			}
		]);

		assert.deepEqual(
			details.map((detail) => detail.kind),
			['added', 'changed', 'removed']
		);
		assert.match(details[0]?.title ?? '', /PE1013/);
		assert.match(details[1]?.description ?? '', /H3-301 → H3-302/);
		assert.match(details[2]?.title ?? '', /AS1001/);
	});

	it('does not show a stored diff from a different selected timetable source', () => {
		const studentLog = {
			schemaVersion: 1,
			profileId: 'student-2024:261',
			outcome: 'applied',
			createdAt: '2026-09-04T03:00:00.000Z',
			details: [
				{
					kind: 'changed',
					courseCode: 'MT1003',
					title: 'MT1003 · Giải tích 1',
					description: 'Phòng đã thay đổi'
				}
			]
		};

		assert.equal(buildStoredDiffDetails([], studentLog, 'lecturer').length, 0);
		assert.equal(buildStoredDiffDetails([], studentLog, 'student-2024').length, 1);
	});

	it('provides a visible fallback when an applied update has counts but no itemized diff log', () => {
		const details = buildFallbackDiffDetails({
			state: 'captured',
			capturedAt: '2026-09-05T00:00:00.000Z',
			completeness: { state: 'complete', parsedRows: 8, expectedRows: 8 },
			changes: { added: 0, changed: 4, removed: 0, unchanged: 4, canDelete: true },
			syncState: 'applied'
		});

		assert.equal(details.length, 1);
		assert.equal(details[0]?.kind, 'changed');
		assert.match(details[0]?.title ?? '', /Google Calendar/);
		assert.match(details[0]?.description ?? '', /4/);
	});

	it('extracts only safe display fields from persisted profiles', () => {
		const profiles = summarizeStoredProfiles([
			{
				schemaVersion: 1,
				profileId: 'student-2024:261',
				sourceKind: 'student-2024',
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-03T01:00:00.000Z',
				pendingSnapshot: { events: [{ stableKey: 'one' }, { stableKey: 'two' }] },
				accessToken: 'must-not-reach-the-view'
			},
			{ broken: true }
		]);

		assert.deepEqual(profiles, [
			{
				profileId: 'student-2024:261',
				sourceKind: 'student-2024',
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-03T01:00:00.000Z',
				pendingEventCount: 2
			}
		]);
		assert.equal(JSON.stringify(profiles).includes('must-not-reach-the-view'), false);
	});

	it('counts accepted events after an automatic sync promotes the pending snapshot', () => {
		const profiles = summarizeStoredProfiles([
			{
				schemaVersion: 1,
				profileId: 'student-2024:261',
				sourceKind: 'student-2024',
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-04T16:04:00.000Z',
				acceptedSnapshot: {
					schemaVersion: 1,
					sourceKind: 'student-2024',
					semester: 261,
					capturedAt: '2026-09-04T16:04:00.000Z',
					fingerprint: 'accepted',
					warnings: [],
					completeness: { state: 'complete', parsedRows: 8, expectedRows: 8 },
					events: Array.from({ length: 8 }, (_, index) => ({
						stableKey: `event-${index}`,
						fingerprint: `fingerprint-${index}`
					}))
				}
			}
		]);

		assert.equal(profiles[0]?.pendingEventCount, 8);
	});

	it('selects the most recently checked persisted profile', () => {
		const selected = selectCurrentProfile([
			{
				profileId: 'student-2024:252',
				sourceKind: 'student-2024',
				semester: 252,
				calendarName: 'BKalendar • HK 252',
				lastCheckedAt: '2026-08-20T01:00:00.000Z',
				pendingEventCount: 5
			},
			currentProfile
		]);

		assert.deepEqual(selected, currentProfile);
	});

	it('selects only profiles belonging to the timetable source currently shown', () => {
		const lecturerProfile: StoredProfileSummary = {
			profileId: 'lecturer:261',
			sourceKind: 'lecturer',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			lastCheckedAt: '2026-09-04T03:00:00.000Z',
			pendingEventCount: 7
		};

		assert.deepEqual(
			selectCurrentProfile([currentProfile, lecturerProfile], 'student-2024'),
			currentProfile
		);
		assert.deepEqual(
			selectCurrentProfile([currentProfile, lecturerProfile], 'lecturer'),
			lecturerProfile
		);
		assert.equal(selectCurrentProfile([currentProfile], 'postgraduate'), undefined);
	});

	it('shows a normal tracking state for every configured timetable source', () => {
		const lecturerProfile: StoredProfileSummary = {
			profileId: 'lecturer:261',
			sourceKind: 'lecturer',
			semester: 261,
			calendarName: 'BKalendar • HK 261',
			lastCheckedAt: '2026-09-04T03:00:00.000Z',
			pendingEventCount: 7
		};
		const withProfile = buildPopupViewModel(
			capturedStatus,
			lecturerProfile,
			true,
			'review',
			false,
			'lecturer'
		);

		assert.equal(withProfile.title, '4 thay đổi cần xem lại');
		assert.equal(withProfile.profileLabel, 'Học kỳ 261 · 7 buổi học');
		assert.equal(withProfile.actionKind, 'open-web-review');
	});

	it('presents persisted change counts as a local review summary', () => {
		const viewModel = buildPopupViewModel(capturedStatus, currentProfile);

		assert.equal(viewModel.tone, 'complete');
		assert.equal(viewModel.title, '4 thay đổi cần xem lại');
		assert.equal(viewModel.profileLabel, 'Học kỳ 261 · 12 buổi học');
		assert.deepEqual(viewModel.counts, {
			added: 2,
			changed: 1,
			removed: 1
		});
		assert.equal(viewModel.deletionBlocked, false);
		assert.equal(viewModel.actionLabel, 'Xem lại trên BKalendar');
		assert.equal(
			viewModel.actionUrl,
			'https://canar1406.github.io/bk-calendar-next/?from=extension'
		);
	});

	it('shows an automatic diff as already applied instead of asking for review', () => {
		const viewModel = buildPopupViewModel(
			{ ...capturedStatus, syncState: 'applied' },
			currentProfile
		);

		assert.equal(viewModel.title, 'Đã tự động cập nhật');
		assert.match(viewModel.detail, /đã được ghi vào Google Calendar/);
		assert.equal(viewModel.actionLabel, 'Xem diff chi tiết');
	});

	it('clearly blocks possible removals when the capture is incomplete', () => {
		const viewModel = buildPopupViewModel(
			{
				...capturedStatus,
				completeness: { state: 'incomplete', parsedRows: 4, expectedRows: 12 },
				changes: {
					added: 0,
					changed: 1,
					removed: 3,
					unchanged: 5,
					canDelete: false
				}
			},
			currentProfile
		);

		assert.equal(viewModel.tone, 'warning');
		assert.equal(viewModel.title, '4 thay đổi cần xem lại');
		assert.equal(viewModel.deletionBlocked, true);
		assert.equal(
			viewModel.warning,
			'Đang chặn xóa 3 mục vì MyBK mới đọc 4/12 dòng. Hãy mở đủ tất cả trang dữ liệu rồi kiểm tra lại.'
		);
		assert.equal(viewModel.actionLabel, 'Xem lại trên BKalendar');
		assert.equal(
			viewModel.actionUrl,
			'https://canar1406.github.io/bk-calendar-next/?from=extension'
		);
	});

	it('uses a safe empty state before the first local capture', () => {
		const viewModel = buildPopupViewModel({ state: 'idle' });

		assert.equal(viewModel.tone, 'idle');
		assert.equal(viewModel.title, 'Chưa có dữ liệu để xem');
		assert.deepEqual(viewModel.counts, { added: 0, changed: 0, removed: 0 });
		assert.equal(viewModel.deletionBlocked, false);
		assert.equal(viewModel.actionLabel, 'Kiểm tra MyBK trong nền');
		assert.equal(viewModel.actionKind, 'background-check');
		assert.equal(viewModel.actionUrl, undefined);
	});

	it('does not report no changes when MyBK is not configured', () => {
		const viewModel = buildPopupViewModel(capturedStatus, currentProfile, false);

		assert.equal(viewModel.title, 'Chưa cấu hình MyBK');
		assert.match(viewModel.detail, /lưu tài khoản MyBK/i);
		assert.deepEqual(viewModel.counts, { added: 0, changed: 0, removed: 0 });
		assert.equal(viewModel.profileLabel, undefined);
		assert.equal(viewModel.actionKind, 'open-settings');
	});

	it('requires Google before showing an automatic tracking result', () => {
		const viewModel = buildPopupViewModel(capturedStatus, currentProfile, true, 'auto-safe', false);

		assert.equal(viewModel.title, 'Cần kết nối Google Calendar');
		assert.match(viewModel.detail, /Google Calendar chưa được kết nối/i);
		assert.equal(viewModel.actionLabel, 'Kết nối Google Calendar');
		assert.equal(viewModel.actionKind, 'connect-google');
	});

	it('keeps extraction errors local and offers only a retry action', () => {
		const viewModel = buildPopupViewModel({
			state: 'error',
			checkedAt: '2026-09-03T01:00:00.000Z',
			message: 'Không đọc được thời khóa biểu.'
		});

		assert.equal(viewModel.tone, 'error');
		assert.equal(viewModel.title, 'Chưa đọc được lịch');
		assert.equal(viewModel.detail, 'Không đọc được thời khóa biểu.');
		assert.equal(viewModel.actionLabel, 'Thử lại trong nền');
		assert.equal(viewModel.actionKind, 'background-check');
		assert.equal(viewModel.actionUrl, undefined);
	});
});
