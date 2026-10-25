import {
	createSnapshot,
	type ScheduleKind,
	type SourceKind,
	type TimetableSnapshot
} from '../../timetable/src/index.ts';
import { parseTimetableSource } from './parser/dispatcher.ts';
import { resolveTimetable } from './resolver.ts';
import { toTimetableSnapshot, type SnapshotOptions } from './snapshot.ts';
import { createExamSnapshot, looksLikeExamSource } from './parser/exam.ts';

export type SourceSnapshotOptions = Omit<SnapshotOptions, 'sourceKind'> & {
	scheduleKind?: ScheduleKind;
	semester?: number;
};

export async function createSourceSnapshot(
	source: string,
	sourceKind: SourceKind | 'auto',
	options: SourceSnapshotOptions = {}
): Promise<TimetableSnapshot> {
	if (
		options.scheduleKind === 'exams' ||
		(options.scheduleKind === undefined && looksLikeExamSource(source))
	) {
		return await createExamSnapshot(
			source,
			sourceKind === 'auto' ? 'student-2024' : sourceKind,
			options
		);
	}
	const parsed = parseTimetableSource(source, sourceKind);
	if (parsed.timetable.rows.length > 0) {
		return await toTimetableSnapshot(resolveTimetable(parsed.timetable), {
			...options,
			sourceKind: parsed.sourceKind
		});
	}

	return await createSnapshot({
		sourceKind: parsed.sourceKind,
		semester: parsed.timetable.semester,
		capturedAt: options.capturedAt ?? new Date().toISOString(),
		...(options.provenance ? { provenance: options.provenance } : {}),
		...(parsed.timetable.sourceUpdatedAt
			? { sourceUpdatedAt: parsed.timetable.sourceUpdatedAt }
			: {}),
		warnings: [],
		...(options.completeness ? { completeness: options.completeness } : {}),
		events: []
	});
}
