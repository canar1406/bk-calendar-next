export const POLLING_INTERVAL_OPTIONS = [5, 10, 15, 30, 60] as const;
export type PollingIntervalMinutes = (typeof POLLING_INTERVAL_OPTIONS)[number];
export const DEFAULT_POLLING_INTERVAL_MINUTES: PollingIntervalMinutes = 10;

export function isPollingIntervalMinutes(value: unknown): value is PollingIntervalMinutes {
	return (
		typeof value === 'number' && POLLING_INTERVAL_OPTIONS.includes(value as PollingIntervalMinutes)
	);
}

export function normalizePollingIntervalMinutes(value: unknown): PollingIntervalMinutes {
	const numericValue = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
	return isPollingIntervalMinutes(numericValue) ? numericValue : DEFAULT_POLLING_INTERVAL_MINUTES;
}
