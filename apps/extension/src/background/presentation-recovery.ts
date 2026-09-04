import { GoogleCalendarApiError } from '../../../../packages/google-calendar/src/index.ts';

export async function syncPresentationWithCalendarRecovery<T>(options: {
	calendarId: string;
	sync(calendarId: string): Promise<T>;
	recover(): Promise<string>;
}): Promise<{ calendarId: string; result: T }> {
	try {
		return {
			calendarId: options.calendarId,
			result: await options.sync(options.calendarId)
		};
	} catch (error) {
		if (!(error instanceof GoogleCalendarApiError) || error.status !== 404) throw error;
		const calendarId = await options.recover();
		return {
			calendarId,
			result: await options.sync(calendarId)
		};
	}
}

export function throwIfCalendarMissing(failures: Array<{ message: string }>): void {
	const failure = failures.find(({ message }) => /Google Calendar API 404\b/iu.test(message));
	if (failure) throw new GoogleCalendarApiError(404, failure.message);
}
