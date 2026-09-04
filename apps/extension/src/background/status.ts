import type { CaptureCompleteness, MyBkCapture } from '../content/extract.ts';
import type { SourceKind } from '../../../../packages/timetable/src/index.ts';

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
			sourceKind?: SourceKind;
			sourceUpdatedAt?: string;
			completeness: CaptureCompleteness;
			changes?: ChangeCounts;
			syncState?: 'review' | 'applied';
	  }
	| {
			state: 'error';
			checkedAt: string;
			sourceKind?: SourceKind;
			message: string;
	  };

export function createCaptureStatus(
	capture: MyBkCapture,
	capturedAt: string,
	changes?: ChangeCounts,
	syncState?: 'review' | 'applied'
): ExtensionStatus {
	return {
		state: 'captured',
		capturedAt,
		...(capture.sourceKind ? { sourceKind: capture.sourceKind } : {}),
		...(capture.sourceUpdatedAt ? { sourceUpdatedAt: capture.sourceUpdatedAt } : {}),
		completeness: structuredClone(capture.completeness),
		...(changes ? { changes: structuredClone(changes) } : {}),
		...(syncState ? { syncState } : {})
	};
}

export function createErrorStatus(
	error: unknown,
	checkedAt: string,
	sourceKind?: SourceKind
): ExtensionStatus {
	return {
		state: 'error',
		checkedAt,
		...(sourceKind ? { sourceKind } : {}),
		message: safeErrorMessage(error)
	};
}

function safeErrorMessage(error: unknown): string {
	const message = error instanceof Error ? error.message.trim() : '';
	if (!message || /failed to fetch|networkerror|load failed/i.test(message)) {
		return 'Không thể kết nối MyBK trong nền. Hãy kiểm tra mạng và quyền truy cập của extension.';
	}
	if (/password|access[_ -]?token|refresh[_ -]?token|authorization/i.test(message)) {
		return 'Không thể đọc thời khóa biểu MyBK. Thông tin nhạy cảm đã được ẩn.';
	}
	return message.slice(0, 240);
}
