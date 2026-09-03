import { createSnapshot, type TimetableSnapshot } from '../../timetable/src/index.ts';
import { parseStudent2024 } from './parser/student-2024.ts';
import { resolveTimetable } from './resolver.ts';
import { toTimetableSnapshot, type SnapshotOptions } from './snapshot.ts';

export type Student2024SnapshotOptions = Omit<SnapshotOptions, 'sourceKind'>;

export async function createStudent2024Snapshot(
	source: string,
	options: Student2024SnapshotOptions = {}
): Promise<TimetableSnapshot> {
	const parsed = parseStudent2024(source);
	if (parsed.rows.length > 0) {
		return await toTimetableSnapshot(resolveTimetable(parsed), {
			...options,
			sourceKind: 'student-2024'
		});
	}

	return await createSnapshot({
		sourceKind: 'student-2024',
		semester: parsed.semester,
		capturedAt: options.capturedAt ?? new Date().toISOString(),
		...(options.provenance ? { provenance: options.provenance } : {}),
		...(parsed.sourceUpdatedAt === undefined ? {} : { sourceUpdatedAt: parsed.sourceUpdatedAt }),
		warnings: [],
		...(options.completeness === undefined ? {} : { completeness: options.completeness }),
		events: []
	});
}
