export type { HourMinute, ResolvedTimetable, Timerow, Timetable } from './timetable.ts';

export {
	detectTimetableSourceKind,
	parseTimetableSource,
	type ParsedTimetableSource
} from './parser/dispatcher.ts';
export { parseLecturer } from './parser/lecturer.ts';
export { parsePostgraduate } from './parser/postgraduate.ts';
export { parseStudent } from './parser/student.ts';
export { parseStudent2024 } from './parser/student-2024.ts';
export {
	createStudent2024Snapshot,
	type Student2024SnapshotOptions
} from './student-2024-snapshot.ts';
export {
	ColumnCountError,
	ParseError,
	SemesterNotFoundError,
	SourceUpdatedAtNotFoundError,
	TableNotFoundError
} from './parser/errors.ts';
export {
	InvalidSemesterError,
	MixedSemesterError,
	resolveTimetable,
	UnresolvedTimetableError
} from './resolver.ts';
export { toTimetableSnapshot, type SnapshotOptions } from './snapshot.ts';
