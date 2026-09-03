import {
	createStudent2024Snapshot,
	type Student2024SnapshotOptions
} from '../../../../packages/core/src/index.ts';
import {
	diffSnapshots,
	type TimetableDiff,
	type TimetableSnapshot
} from '../../../../packages/timetable/src/index.ts';
import {
	stageSnapshot,
	type ProfileStore,
	type SyncProfile
} from '../../../../packages/timetable/src/storage.ts';

export type PrepareTimetableOptions = Student2024SnapshotOptions;

export interface PreparedTimetable {
	profileId: string;
	snapshot: TimetableSnapshot;
	diff: TimetableDiff;
}

export async function prepareTimetable(
	source: string,
	previousSnapshot: TimetableSnapshot | undefined,
	options: PrepareTimetableOptions = {}
): Promise<PreparedTimetable> {
	const snapshot = await createStudent2024Snapshot(source, options);

	return {
		profileId: profileIdFor(snapshot),
		snapshot,
		diff: diffSnapshots(previousSnapshot, snapshot)
	};
}

export async function stageTimetableImport(
	store: ProfileStore,
	source: string,
	options: PrepareTimetableOptions = {}
): Promise<PreparedTimetable & { profile: SyncProfile }> {
	if (options.provenance === 'sample') {
		throw new Error('Dữ liệu mẫu không được lưu làm thời khóa biểu của người dùng.');
	}
	const snapshot = await createStudent2024Snapshot(source, options);
	return await stageTransferredSnapshot(store, snapshot);
}

export async function stageTransferredSnapshot(
	store: ProfileStore,
	snapshot: TimetableSnapshot
): Promise<PreparedTimetable & { profile: SyncProfile }> {
	if (snapshot.provenance === 'sample') {
		throw new Error('Dữ liệu mẫu không được lưu làm thời khóa biểu của người dùng.');
	}
	const staged = await stageSnapshot(store, snapshot);
	return {
		profileId: staged.profileId,
		snapshot,
		diff: staged.diff,
		profile: staged.profile
	};
}

function profileIdFor(snapshot: TimetableSnapshot): string {
	return `${snapshot.sourceKind}:${snapshot.semester}`;
}

export function inferCaptureCompleteness(source: string) {
	const parsedRows = source
		.replaceAll('\r\n', '\n')
		.replaceAll('\r', '\n')
		.split('\n')
		.filter((line) => /^\d{5}\t/u.test(line) && line.split('\t').length === 12).length;
	const footer = /Trình bày từ dòng\s+\d+\s+đến\s+\d+\s*\/\s*(\d+)\s+dòng/iu.exec(source);
	if (!footer) return { state: 'unknown' as const, parsedRows };

	const expectedRows = Number(footer[1]);
	return parsedRows >= expectedRows
		? { state: 'complete' as const, parsedRows, expectedRows }
		: { state: 'incomplete' as const, parsedRows, expectedRows };
}
