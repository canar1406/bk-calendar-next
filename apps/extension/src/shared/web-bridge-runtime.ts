import type { CourseColorPreferences } from '../../../../packages/google-calendar/src/course-appearance.ts';
import type { SyncProfile } from '../../../../packages/timetable/src/storage.ts';
import type { ExtensionState } from '../../../../packages/timetable/src/index.ts';
import type { ThemePreference } from './theme.ts';

export type WebBridgeRuntimeRequest =
	| { type: 'bkalendar:web-bridge:profiles:get' }
	| { type: 'bkalendar:web-bridge:state:get' }
	| { type: 'bkalendar:web-bridge:profile:save'; profile: SyncProfile }
	| {
			type: 'bkalendar:web-bridge:appearance:save';
			profileId: string;
			preferences: CourseColorPreferences;
	  }
	| { type: 'bkalendar:web-bridge:theme:save'; preference: ThemePreference };

export interface WebBridgeStatePush {
	type: 'bkalendar:web-bridge:state:push';
	state: ExtensionState;
}

export const WEB_BRIDGE_PING_TYPE = 'bkalendar:web-bridge:ping';

export interface WebBridgePing {
	type: typeof WEB_BRIDGE_PING_TYPE;
}

export interface WebBridgePingResponse {
	ok: true;
}

export function isWebBridgePing(value: unknown): value is WebBridgePing {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		(value as { type?: unknown }).type === WEB_BRIDGE_PING_TYPE
	);
}

export function isWebBridgeRuntimeRequest(value: unknown): value is WebBridgeRuntimeRequest {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const message = value as Record<string, unknown>;
	return (
		message.type === 'bkalendar:web-bridge:profiles:get' ||
		message.type === 'bkalendar:web-bridge:state:get' ||
		(message.type === 'bkalendar:web-bridge:profile:save' &&
			message.profile !== null &&
			typeof message.profile === 'object') ||
		(message.type === 'bkalendar:web-bridge:appearance:save' &&
			typeof message.profileId === 'string' &&
			message.preferences !== null &&
			typeof message.preferences === 'object') ||
		(message.type === 'bkalendar:web-bridge:theme:save' &&
			(message.preference === 'light' ||
				message.preference === 'dark' ||
				message.preference === 'system'))
	);
}

export function isWebBridgeStatePush(value: unknown): value is WebBridgeStatePush {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
	const message = value as Record<string, unknown>;
	return (
		message.type === 'bkalendar:web-bridge:state:push' &&
		message.state !== null &&
		typeof message.state === 'object'
	);
}
