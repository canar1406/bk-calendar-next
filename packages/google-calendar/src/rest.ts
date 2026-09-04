import type { ManagedEvent } from '../../timetable/src/index.ts';
import type { GoogleCalendarGateway, ManagedGoogleEvent } from './index.ts';

export const MANAGED_BY = 'bkalendar-next';
const API_BASE = 'https://www.googleapis.com/calendar/v3';
const WEEK_MS = 7 * 86_400_000;

export interface GoogleEventResource {
	id?: string;
	etag?: string;
	summary?: string;
	description?: string;
	location?: string;
	start?: { dateTime: string; timeZone: string };
	end?: { dateTime: string; timeZone: string };
	recurrence?: string[];
	colorId?: string;
	extendedProperties?: {
		private?: Record<string, string>;
	};
}

export interface GoogleCalendarResource {
	id: string;
	summary: string;
	description?: string;
	timeZone?: string;
	primary?: boolean;
	deleted?: boolean;
}

export function toGoogleEventResource(event: ManagedEvent): GoogleEventResource {
	return {
		summary: event.title,
		description: Object.entries(event.metadata)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, value]) => `${key}: ${value}`)
			.join('\n'),
		location: event.location,
		start: { dateTime: event.start, timeZone: event.timeZone },
		end: { dateTime: event.end, timeZone: event.timeZone },
		recurrence: recurrenceLines(event),
		extendedProperties: {
			private: {
				managedBy: MANAGED_BY,
				schemaVersion: '1',
				stableKey: event.stableKey,
				fingerprint: event.fingerprint ?? ''
			}
		}
	};
}

export async function createManagedCalendar(
	fetcher: typeof fetch,
	accessToken: string,
	summary: string
): Promise<GoogleCalendarResource> {
	return await requestJson<GoogleCalendarResource>(fetcher, accessToken, `${API_BASE}/calendars`, {
		method: 'POST',
		body: JSON.stringify({
			summary,
			description: `Managed by ${MANAGED_BY}. Các sự kiện trong lịch này được BKalendar cập nhật.`,
			timeZone: 'Asia/Ho_Chi_Minh'
		})
	});
}

export async function findManagedCalendars(
	fetcher: typeof fetch,
	accessToken: string,
	summary: string
): Promise<Array<{ id: string }>> {
	const calendars: Array<{ id: string }> = [];
	let pageToken: string | undefined;
	do {
		const query = new URLSearchParams({
			minAccessRole: 'writer',
			showDeleted: 'false',
			showHidden: 'true',
			maxResults: '250'
		});
		if (pageToken) query.set('pageToken', pageToken);
		const response = await requestJson<{
			items?: GoogleCalendarResource[];
			nextPageToken?: string;
		}>(fetcher, accessToken, `${API_BASE}/users/me/calendarList?${query}`);
		for (const calendar of response.items ?? []) {
			if (
				!calendar.id ||
				calendar.id === 'primary' ||
				calendar.primary ||
				calendar.deleted ||
				calendar.summary !== summary ||
				!calendar.description?.includes(`Managed by ${MANAGED_BY}.`)
			) {
				continue;
			}
			calendars.push({ id: calendar.id });
		}
		pageToken = response.nextPageToken;
	} while (pageToken);
	return calendars.sort((left, right) => left.id.localeCompare(right.id));
}

export class GoogleCalendarRestGateway implements GoogleCalendarGateway {
	private readonly accessToken: string;
	private readonly fetcher: typeof fetch;

	constructor(accessToken: string, fetcher: typeof fetch = fetch) {
		this.accessToken = accessToken;
		this.fetcher = fetcher;
	}

	async listManagedEvents(calendarId: string): Promise<ManagedGoogleEvent[]> {
		const managed: ManagedGoogleEvent[] = [];
		let pageToken: string | undefined;
		do {
			const query = new URLSearchParams({
				singleEvents: 'false',
				showDeleted: 'false',
				maxResults: '2500',
				privateExtendedProperty: `managedBy=${MANAGED_BY}`
			});
			if (pageToken) query.set('pageToken', pageToken);
			const response = await requestJson<{ items?: GoogleEventResource[]; nextPageToken?: string }>(
				this.fetcher,
				this.accessToken,
				`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${query}`
			);
			for (const item of response.items ?? []) {
				const privateData = item.extendedProperties?.private;
				if (!item.id || !privateData?.stableKey || !privateData.fingerprint) continue;
				managed.push({
					id: item.id,
					...(item.etag ? { etag: item.etag } : {}),
					stableKey: privateData.stableKey,
					fingerprint: privateData.fingerprint
				});
			}
			pageToken = response.nextPageToken;
		} while (pageToken);
		return managed.sort((a, b) => a.stableKey.localeCompare(b.stableKey));
	}

	async insertEvent(calendarId: string, event: ManagedEvent): Promise<ManagedGoogleEvent> {
		const resource = await requestJson<GoogleEventResource>(
			this.fetcher,
			this.accessToken,
			`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
			{ method: 'POST', body: JSON.stringify(toGoogleEventResource(event)) }
		);
		return asManaged(resource, event);
	}

	async patchEvent(
		calendarId: string,
		eventId: string,
		event: ManagedEvent,
		etag?: string
	): Promise<ManagedGoogleEvent> {
		const resource = await requestJson<GoogleEventResource>(
			this.fetcher,
			this.accessToken,
			`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
			{
				method: 'PATCH',
				...(etag ? { headers: { 'If-Match': etag } } : {}),
				body: JSON.stringify(toGoogleEventResource(event))
			}
		);
		return asManaged(resource, event);
	}

	async deleteEvent(calendarId: string, eventId: string, etag?: string): Promise<void> {
		await request(
			this.fetcher,
			this.accessToken,
			`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
			{ method: 'DELETE', ...(etag ? { headers: { 'If-Match': etag } } : {}) }
		);
	}
}

function recurrenceLines(event: ManagedEvent): string[] {
	const active = [...new Set(event.activeWeekIndexes)].sort((a, b) => a - b);
	const last = active.at(-1);
	if (last === undefined || last === 0) return [];
	const until = new Date(new Date(event.start).getTime() + last * WEEK_MS);
	const lines = [`RRULE:FREQ=WEEKLY;UNTIL=${formatUtc(until)}`];
	const exclusions = [...new Set(event.excludedStarts)]
		.map((value) => new Date(value))
		.sort((a, b) => +a - +b)
		.map((date) => formatHcm(date));
	if (exclusions.length) lines.push(`EXDATE;TZID=${event.timeZone}:${exclusions.join(',')}`);
	return lines;
}

function formatUtc(date: Date): string {
	return date
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}Z$/, 'Z');
}

function formatHcm(date: Date): string {
	const parts = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
		timeZone: 'Asia/Ho_Chi_Minh',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? '';
	return `${part('year')}${part('month')}${part('day')}T${part('hour')}${part('minute')}${part('second')}`;
}

function asManaged(resource: GoogleEventResource, fallback: ManagedEvent): ManagedGoogleEvent {
	if (!resource.id) throw new Error('Google Calendar không trả về event ID.');
	const metadata = resource.extendedProperties?.private;
	return {
		id: resource.id,
		...(resource.etag ? { etag: resource.etag } : {}),
		stableKey: metadata?.stableKey ?? fallback.stableKey,
		fingerprint: metadata?.fingerprint ?? fallback.fingerprint ?? ''
	};
}

async function requestJson<T>(
	fetcher: typeof fetch,
	accessToken: string,
	url: string,
	init: RequestInit = {}
): Promise<T> {
	const response = await request(fetcher, accessToken, url, init);
	return (await response.json()) as T;
}

async function request(
	fetcher: typeof fetch,
	accessToken: string,
	url: string,
	init: RequestInit = {}
): Promise<Response> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
		Accept: 'application/json',
		...toHeaderRecord(init.headers)
	};
	if (init.body !== undefined) headers['Content-Type'] = 'application/json';
	const response = await fetcher(url, { ...init, headers });
	if (!response.ok) {
		let detail = '';
		try {
			detail = JSON.stringify(await response.json());
		} catch {
			detail = await response.text();
		}
		throw new GoogleCalendarApiError(response.status, detail || response.statusText);
	}
	return response;
}

function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
	if (!headers) return {};
	if (headers instanceof Headers) return Object.fromEntries(headers.entries());
	if (Array.isArray(headers)) return Object.fromEntries(headers);
	return { ...headers };
}

export class GoogleCalendarApiError extends Error {
	readonly status: number;

	constructor(status: number, detail: string) {
		super(`Google Calendar API ${status}: ${detail}`);
		this.name = 'GoogleCalendarApiError';
		this.status = status;
	}
}
