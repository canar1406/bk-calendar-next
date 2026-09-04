export {
	syncPendingProfile,
	type GoogleProfileSyncResult,
	type GoogleSyncDependencies
} from '../../../../packages/google-calendar/src/profile-sync.ts';
import { isGoogleCalendarAuthError } from '../../../../packages/google-calendar/src/index.ts';

export async function syncWithGoogleReauth<T>(options: {
	requestToken(): Promise<string>;
	run(accessToken: string): Promise<T>;
	onReauth?(): void;
	beforeRetry?(): Promise<void> | void;
}): Promise<T> {
	let accessToken = await options.requestToken();
	try {
		return await options.run(accessToken);
	} catch (error) {
		if (!isGoogleCalendarAuthError(error)) throw error;
		options.onReauth?.();
		await options.beforeRetry?.();
		accessToken = await options.requestToken();
		return await options.run(accessToken);
	}
}
