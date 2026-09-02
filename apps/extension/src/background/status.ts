import type { CaptureCompleteness, MyBkCapture } from '../content/extract.ts';

export const EXTENSION_STATUS_KEY = 'bkalendar-next:extension-status';

export interface ChangeCounts {
	added: number;
	changed: number;
	removed: number;
	unchanged: number;
	canDelete: boolean;
}

export type ExtensionStatus =
	| { state: 'idle' }
	| {
			state: 'captured';
			capturedAt: string;
			sourceUpdatedAt?: string;
			completeness: CaptureCompleteness;
			changes?: ChangeCounts;
	  }
	| {
			state: 'error';
			checkedAt: string;
			message: string;
	  };

export function createCaptureStatus(
	capture: MyBkCapture,
	capturedAt: string,
	changes?: ChangeCounts
): ExtensionStatus {
	return {
		state: 'captured',
		capturedAt,
		...(capture.sourceUpdatedAt ? { sourceUpdatedAt: capture.sourceUpdatedAt } : {}),
		completeness: structuredClone(capture.completeness),
		...(changes ? { changes: structuredClone(changes) } : {})
	};
}

export function createErrorStatus(_error: unknown, checkedAt: string): ExtensionStatus {
	return {
		state: 'error',
		checkedAt,
		message: 'Không đọc được thời khóa biểu. Hãy mở đúng trang TKB MyBK và thử tải lại.'
	};
}
