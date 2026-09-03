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
	const snapshot = await createStudent2024Snapshot(source, options);
	return await stageTransferredSnapshot(store, snapshot);
}

export async function stageTransferredSnapshot(
	store: ProfileStore,
	snapshot: TimetableSnapshot
): Promise<PreparedTimetable & { profile: SyncProfile }> {
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
