import type { MyBkCapture } from '../content/extract.ts';

export type ContentMessage =
	| {
			type: 'bkalendar:capture';
			capture: MyBkCapture;
	  }
	| {
			type: 'bkalendar:capture-error';
	  };

export function isContentMessage(value: unknown): value is ContentMessage {
	if (!value || typeof value !== 'object') return false;
	const type = (value as { type?: unknown }).type;
	return type === 'bkalendar:capture' || type === 'bkalendar:capture-error';
}
