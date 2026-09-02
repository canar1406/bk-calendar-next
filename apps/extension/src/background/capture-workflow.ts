import { createStudent2024Snapshot } from '../../../../packages/core/src/index.ts';
import { stageSnapshot, type ProfileStore } from '../../../../packages/timetable/src/storage.ts';
import type { MyBkCapture } from '../content/extract.ts';

export async function stageMyBkCapture(
	store: ProfileStore,
	capture: MyBkCapture,
	capturedAt: string
) {
	const snapshot = await createStudent2024Snapshot(capture.raw, {
		capturedAt,
		completeness: capture.completeness
	});
	const staged = await stageSnapshot(store, snapshot);
	return { ...staged, snapshot };
}
