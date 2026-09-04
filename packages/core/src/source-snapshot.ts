import {
	createSnapshot,
	type SourceKind,
	type TimetableSnapshot
} from '../../timetable/src/index.ts';
import { parseTimetableSource } from './parser/dispatcher.ts';
import { resolveTimetable } from './resolver.ts';
import { toTimetableSnapshot, type SnapshotOptions } from './snapshot.ts';

export type SourceSnapshotOptions = Omit<SnapshotOptions, 'sourceKind'>;

export async function createSourceSnapshot(
	source: string,
	sourceKind: SourceKind | 'auto',
	options: SourceSnapshotOptions = {}
): Promise<TimetableSnapshot> {
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
