import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSnapshot } from '../../../packages/timetable/src/index.ts';
import { createIcalendarExport, exportIcalendarFile } from '../src/lib/ical-download.ts';

describe('web iCalendar export', () => {
	it('creates a safe .ics download with Vietnamese calendar content', async () => {
		const snapshot = await createSnapshot({
			sourceKind: 'student-2024',
			semester: 261,
			capturedAt: '2026-09-02T00:00:00.000Z',
			warnings: [],
			events: [
				{
					stableKey: '',
					sourceKind: 'student-2024',
					semester: 261,
					courseCode: 'MT1003',
					group: 'L11',
					sessionOrdinal: 0,
					weekday: 2,
					title: 'Giải tích 1',
					location: 'H1-GĐH1',
					start: '2026-08-24T00:00:00.000Z',
					end: '2026-08-24T02:50:00.000Z',
					timeZone: 'Asia/Ho_Chi_Minh',
					activeWeekIndexes: [0],
					excludedStarts: [],
					metadata: { courseCode: 'MT1003' }
				}
			]
		});

		const result = createIcalendarExport(snapshot, 'BKalendar • HK 261 / MyBK', {
			generatedAt: new Date('2026-09-02T00:00:00.000Z')
		});

		assert.equal(result.filename, 'BKalendar-HK-261-MyBK.ics');
		assert.equal(result.mimeType, 'text/calendar;charset=utf-8');
		assert.match(result.content, /SUMMARY:Giải tích 1/);
		assert.match(result.content, /\r\nEND:VCALENDAR\r\n$/);
	});

	it('shares a calendar File when Web Share supports files', async () => {
		const calendar = {
			content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
			filename: 'BKalendar-HK-261.ics',
			mimeType: 'text/calendar;charset=utf-8' as const
		};
		let sharedFile: File | undefined;

		const result = await exportIcalendarFile(calendar, {
			createFile(content, filename, mimeType) {
				return new File([content], filename, { type: mimeType });
			},
			canShare(data) {
				assert.equal(data.files?.length, 1);
				return true;
			},
			async share(data) {
				sharedFile = data.files?.[0];
			},
			downloadEnvironment: {
				createUrl() {
					throw new Error('download fallback must not run');
				},
				revokeUrl() {},
				createAnchor() {
					throw new Error('download fallback must not run');
				},
				appendAnchor() {},
				scheduleCleanup() {}
			}
		});

		assert.equal(result, 'shared');
		assert.ok(sharedFile instanceof File);
		assert.equal(sharedFile.name, calendar.filename);
		assert.equal(sharedFile.type, calendar.mimeType);
		assert.equal(await sharedFile.text(), calendar.content);
	});

	it('attaches a temporary link before clicking when file sharing is unavailable', async () => {
		const actions: string[] = [];
		const anchor = {
			href: '',
			download: '',
			click() {
				actions.push('click');
			},
			remove() {
				actions.push('remove');
			}
		};

		const result = await exportIcalendarFile(
			{
				content: 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
				filename: 'BKalendar-HK-261.ics',
				mimeType: 'text/calendar;charset=utf-8'
			},
			{
				createFile(content, filename, mimeType) {
					return new File([content], filename, { type: mimeType });
				},
				canShare() {
					return false;
				},
				async share() {
					throw new Error('share must not run');
				},
				downloadEnvironment: {
					createUrl() {
						actions.push('create-url');
						return 'blob:calendar';
					},
					revokeUrl(url) {
						actions.push(`revoke:${url}`);
					},
					createAnchor() {
						return anchor;
					},
					appendAnchor() {
						actions.push('append');
					},
					scheduleCleanup(cleanup) {
						actions.push('schedule');
						cleanup();
					}
				}
			}
		);

		assert.equal(result, 'downloaded');
		assert.equal(anchor.href, 'blob:calendar');
		assert.equal(anchor.download, 'BKalendar-HK-261.ics');
		assert.deepEqual(actions, [
			'create-url',
			'append',
			'click',
			'schedule',
			'remove',
			'revoke:blob:calendar'
		]);
	});
});
