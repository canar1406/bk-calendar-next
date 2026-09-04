import {
	createSourceSnapshot,
	type SourceSnapshotOptions
} from '../../../../packages/core/src/index.ts';
import {
	diffSnapshots,
	type SourceKind,
	type TimetableDiff,
	type TimetableSnapshot
} from '../../../../packages/timetable/src/index.ts';
import {
	stageSnapshot,
	type ProfileStore,
	type SyncProfile
} from '../../../../packages/timetable/src/storage.ts';

export type PrepareTimetableOptions = SourceSnapshotOptions & {
	sourceKind?: SourceKind | 'auto';
};

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
	const snapshot = await createWorkflowSnapshot(source, options);

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
	const snapshot = await createWorkflowSnapshot(source, options);
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

async function createWorkflowSnapshot(
	source: string,
	options: PrepareTimetableOptions
): Promise<TimetableSnapshot> {
	const { sourceKind = 'student-2024', ...snapshotOptions } = options;
	return await createSourceSnapshot(source, sourceKind, snapshotOptions);
}

export function inferCaptureCompleteness(source: string, sourceKind: SourceKind = 'student-2024') {
	const normalized = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	const parsedRows = countSourceRows(normalized, sourceKind);
	const expectedRows = expectedSourceRows(normalized, sourceKind);
	if (expectedRows === undefined) return { state: 'unknown' as const, parsedRows };

	return parsedRows >= expectedRows
		? { state: 'complete' as const, parsedRows, expectedRows }
		: { state: 'incomplete' as const, parsedRows, expectedRows };
}

function countSourceRows(source: string, sourceKind: SourceKind): number {
	const expectedColumns: Record<SourceKind, number> = {
		'student-2024': 12,
		'student-legacy': 11,
		lecturer: 10,
		postgraduate: 9
	};
	const headerPatterns: Record<SourceKind, RegExp> = {
		'student-2024': /^học kỳ\tmã mh\ttên môn học/iu,
		'student-legacy': /^mã mh\ttên môn học/iu,
		lecturer: /^lớp\ttên mh\tphòng/iu,
		postgraduate: /^cán bộ giảng dạy\tmôn học/iu
	};
	const lines = source.split('\n');
	const headerIndex = lines.findIndex((line) => headerPatterns[sourceKind].test(line.trim()));
	if (headerIndex < 0) return 0;
	return lines
		.slice(headerIndex + 1)
		.filter((line) => line.trim() !== '' && line.split('\t').length === expectedColumns[sourceKind])
		.length;
}

function expectedSourceRows(source: string, sourceKind: SourceKind): number | undefined {
	if (sourceKind === 'student-2024') {
		const footer = /Trình bày từ dòng\s+\d+\s+đến\s+\d+\s*\/\s*(\d+)\s+dòng/iu.exec(source);
		return footer ? Number(footer[1]) : undefined;
	}
	if (sourceKind === 'lecturer') {
		const footer = /Đang xem\s+\d+\s+đến\s+\d+\s+trong tổng số\s+(\d+)\s+mục/iu.exec(source);
		return footer ? Number(footer[1]) : undefined;
	}
	return undefined;
}
