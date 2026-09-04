import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	buildStoredDiffDetails,
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
	semester: 261,
	calendarName: 'BKalendar • HK 261',
	lastCheckedAt: '2026-09-03T01:00:00.000Z',
	pendingEventCount: 12
};

describe('extension popup view model', () => {
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
				semester: 261,
				calendarName: 'BKalendar • HK 261',
				lastCheckedAt: '2026-09-03T01:00:00.000Z',
				pendingEventCount: 2
			}
		]);
		assert.equal(JSON.stringify(profiles).includes('must-not-reach-the-view'), false);
	});

	it('selects the most recently checked persisted profile', () => {
		const selected = selectCurrentProfile([
			{
				profileId: 'student-2024:252',
				semester: 252,
				calendarName: 'BKalendar • HK 252',
				lastCheckedAt: '2026-08-20T01:00:00.000Z',
				pendingEventCount: 5
			},
			currentProfile
		]);

		assert.deepEqual(selected, currentProfile);
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
		assert.equal(viewModel.actionLabel, 'Mở thời khóa biểu MyBK');
		assert.equal(
			viewModel.actionUrl,
			'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb'
		);
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
		assert.equal(viewModel.actionLabel, 'Mở MyBK để thử lại');
		assert.equal(
			viewModel.actionUrl,
			'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb'
		);
	});
});
