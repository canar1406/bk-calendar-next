import type { ManagedEvent } from '../../../../packages/timetable/src/index.ts';
import {
	buildCourseColorAssignments,
	colorizeEventsForSync,
	isCourseColorPreferences
} from '../../../../packages/google-calendar/src/course-appearance.ts';

export function prepareEventsWithCourseAppearance(
	events: ManagedEvent[],
	storedPreferences: unknown
): ManagedEvent[] {
	if (!isCourseColorPreferences(storedPreferences)) return events;
	const assignments = buildCourseColorAssignments(events, storedPreferences);
	return colorizeEventsForSync(events, assignments, storedPreferences.icons);
}
