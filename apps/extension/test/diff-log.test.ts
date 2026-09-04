import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createDiffLog } from '../src/shared/diff-log.ts';
import type { ManagedEvent, TimetableDiff } from '../../../packages/timetable/src/index.ts';

const baseEvent: ManagedEvent = {
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
};

describe('safe local diff log', () => {
	it('preserves useful applied-change details after a pending snapshot is promoted', () => {
		const after = { ...baseEvent, fingerprint: 'new', location: 'H3-302' };
		const diff: TimetableDiff = {
			added: [{ kind: 'added', after }],
			changed: [
				{
					kind: 'changed',
					before: baseEvent,
					after,
					changedFields: ['location']
				}
			],
			removed: [{ kind: 'removed', before: baseEvent }],
			unchanged: [],
			canDelete: true
		};

		const log = createDiffLog('student-2024:261', 'applied', diff, '2026-09-03T02:00:00Z');

		assert.equal(log.profileId, 'student-2024:261');
		assert.equal(log.outcome, 'applied');
		assert.deepEqual(
			log.details.map((detail) => detail.kind),
			['added', 'changed', 'removed']
		);
		assert.match(log.details[1]?.description ?? '', /H3-301 → H3-302/);
		assert.equal(JSON.stringify(log).includes('password'), false);
	});
});
