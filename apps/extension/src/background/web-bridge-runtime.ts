import { isCourseColorPreferences } from '../../../../packages/google-calendar/src/course-appearance.ts';
import type { ExtensionState } from '../../../../packages/timetable/src/index.ts';
import type { SyncProfile } from '../../../../packages/timetable/src/storage.ts';
import {
	isWebBridgeRuntimeRequest,
	type WebBridgeRuntimeRequest
} from '../shared/web-bridge-runtime.ts';

export interface WebBridgeRuntimeContext {
	readProfiles(): Promise<unknown>;
	readState(): Promise<ExtensionState>;
	saveProfile(profile: SyncProfile): Promise<void>;
	saveAppearance(profileId: string, preferences: unknown): Promise<void>;
}

export async function handleWebBridgeRuntimeRequest(
	message: unknown,
	senderUrl: string | undefined,
	context: WebBridgeRuntimeContext
): Promise<{ handled: boolean; value?: unknown }> {
	if (!isTrustedReviewUrl(senderUrl) || !isWebBridgeRuntimeRequest(message)) {
		return { handled: false };
	}

	const command = message as WebBridgeRuntimeRequest;
	if (command.type === 'bkalendar:web-bridge:profiles:get') {
		return { handled: true, value: await context.readProfiles() };
	}
	if (command.type === 'bkalendar:web-bridge:state:get') {
		return { handled: true, value: await context.readState() };
	}
	if (command.type === 'bkalendar:web-bridge:profile:save') {
		await context.saveProfile(command.profile);
		return { handled: true };
	}
	if (!isCourseColorPreferences(command.preferences)) {
		throw new Error('Cấu hình màu môn học không hợp lệ.');
	}
	await context.saveAppearance(command.profileId, command.preferences);
	return { handled: true };
}

function isTrustedReviewUrl(value: string | undefined): boolean {
	if (!value) return false;
	try {
		const url = new URL(value);
		return (
			url.origin === 'https://canar1406.github.io' && url.pathname.startsWith('/bk-calendar-next/')
		);
	} catch {
		return false;
	}
}
