import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createEventFingerprint,
	createStableEventKey,
	diffSnapshots,
	type ManagedEvent,
	type TimetableSnapshot
} from '../src/index.ts';

function event(overrides: Partial<ManagedEvent> = {}): ManagedEvent {
	return {
		stableKey: '',
		sourceKind: 'student-2024',
		semester: 261,
		courseCode: 'MT1003',
		group: 'L11',
		sessionOrdinal: 0,
		weekday: 2,
		title: 'Giải tích 1',
		location: 'H1-GĐH1',
		start: '2026-08-31T00:00:00.000Z',
		end: '2026-08-31T02:50:00.000Z',
		timeZone: 'Asia/Ho_Chi_Minh',
		activeWeekIndexes: [0, 2, 3],
		excludedStarts: ['2026-09-07T00:00:00.000Z'],
		metadata: { credits: '4', lecturer: 'Nguyễn Văn A' },
		...overrides
	};
}

async function finalized(overrides: Partial<ManagedEvent> = {}): Promise<ManagedEvent> {
	const value = event(overrides);
	value.stableKey = await createStableEventKey(value);
	value.fingerprint = await createEventFingerprint(value);
	return value;
}

function snapshot(events: ManagedEvent[]): TimetableSnapshot {
	return {
		schemaVersion: 1,
		sourceKind: 'student-2024',
		semester: 261,
		capturedAt: '2026-09-02T00:00:00.000Z',
		fingerprint: events.map((e) => e.fingerprint).join(':'),
		events,
		warnings: []
	};
}

describe('stable event identity', () => {
	it('keeps identity when mutable schedule fields change', async () => {
		const before = event();
		const after = event({
			location: 'H6-411',
			start: '2026-08-31T02:00:00.000Z',
			activeWeekIndexes: [0, 1, 2]
		});
		assert.equal(await createStableEventKey(after), await createStableEventKey(before));
	});

	it('distinguishes two sessions of the same course and weekday', async () => {
		assert.notEqual(
			await createStableEventKey(event({ sessionOrdinal: 1 })),
			await createStableEventKey(event({ sessionOrdinal: 0 }))
		);
	});

	it('creates the same fingerprint when metadata key order changes', async () => {
		const a = event({ metadata: { credits: '4', lecturer: 'Nguyễn Văn A' } });
		const b = event({ metadata: { lecturer: 'Nguyễn Văn A', credits: '4' } });
		assert.equal(await createEventFingerprint(a), await createEventFingerprint(b));
	});
});

describe('snapshot diff', () => {
	it('classifies added, changed, removed and unchanged events', async () => {
		const unchanged = await finalized();
		const changedBefore = await finalized({ courseCode: 'PH1003', title: 'Vật lý 1' });
		const changedAfter = await finalized({
			courseCode: 'PH1003',
			title: 'Vật lý 1',
			location: 'H3-301'
		});
		const removed = await finalized({ courseCode: 'AS1001', title: 'Nhập môn kỹ thuật' });
		const added = await finalized({ courseCode: 'LA1003', title: 'Anh văn' });
		const result = diffSnapshots(
			snapshot([unchanged, changedBefore, removed]),
			snapshot([unchanged, changedAfter, added])
		);
		assert.deepEqual(
			result.added.map((item) => item.after.courseCode),
			['LA1003']
		);
		assert.deepEqual(
			result.changed.map((item) => item.after.courseCode),
			['PH1003']
		);
		assert.deepEqual(
			result.removed.map((item) => item.before.courseCode),
			['AS1001']
		);
		assert.deepEqual(
			result.unchanged.map((item) => item.after.courseCode),
			['MT1003']
		);
	});

	it('rejects duplicate stable keys instead of deleting ambiguously', async () => {
		const duplicateA = await finalized();
		const duplicateB = { ...duplicateA, title: 'Một dòng khác' };
		assert.throws(
			() => diffSnapshots(undefined, snapshot([duplicateA, duplicateB])),
			/duplicate stable key/i
		);
	});
});
