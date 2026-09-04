import type { MyBkCapture } from '../content/extract.ts';
import { isTrackingMode, type TrackingMode } from '../background/tracking-policy.ts';
import { isPollingIntervalMinutes, type PollingIntervalMinutes } from '../background/polling.ts';

export type ContentMessage =
	| {
			type: 'bkalendar:capture';
			capture: MyBkCapture;
	  }
	| {
			type: 'bkalendar:capture-error';
			reason?: string;
	  }
	| {
			type: 'bkalendar:session-expired';
			reason?: string;
	  };

export function isContentMessage(value: unknown): value is ContentMessage {
	if (!value || typeof value !== 'object') return false;
	const type = (value as { type?: unknown }).type;
	return (
		type === 'bkalendar:capture' ||
		type === 'bkalendar:capture-error' ||
		type === 'bkalendar:session-expired'
	);
}

export type PopupMessage =
	| { type: 'bkalendar:settings:get' }
	| { type: 'bkalendar:web-bridge:status:get' }
	| {
			type: 'bkalendar:credentials:save';
			username: string;
			password: string;
			consent: boolean;
			trackingMode: TrackingMode;
	  }
	| { type: 'bkalendar:credentials:remove' }
	| { type: 'bkalendar:tracking:set-mode'; trackingMode: TrackingMode }
	| {
			type: 'bkalendar:polling:set-interval';
			intervalMinutes: PollingIntervalMinutes;
	  }
	| { type: 'bkalendar:tracking:run-now' }
	| { type: 'bkalendar:google:connect' }
	| { type: 'bkalendar:google:disconnect' };

export function isPopupMessage(value: unknown): value is PopupMessage {
	if (!value || typeof value !== 'object') return false;
	const message = value as Record<string, unknown>;
	if (
		message.type === 'bkalendar:settings:get' ||
		message.type === 'bkalendar:web-bridge:status:get' ||
		message.type === 'bkalendar:credentials:remove' ||
		message.type === 'bkalendar:tracking:run-now' ||
		message.type === 'bkalendar:google:connect' ||
		message.type === 'bkalendar:google:disconnect'
	) {
		return true;
	}
	if (message.type === 'bkalendar:tracking:set-mode') {
		return isTrackingMode(message.trackingMode);
	}
	if (message.type === 'bkalendar:polling:set-interval') {
		return isPollingIntervalMinutes(message.intervalMinutes);
	}
	return (
		message.type === 'bkalendar:credentials:save' &&
		typeof message.username === 'string' &&
		typeof message.password === 'string' &&
		typeof message.consent === 'boolean' &&
		isTrackingMode(message.trackingMode)
	);
}
