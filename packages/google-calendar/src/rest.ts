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

export function formatGoogleEventSummary(event: ManagedEvent): string {
	const code = event.courseCode.trim();
	const title = event.title.trim();
	const group = (event.group || event.metadata.group || '').trim();
	const credits = (event.metadata.credits ?? '').trim();

	const normalizedCode = code.normalize('NFKC').toLocaleLowerCase('vi');
	const normalizedTitle = title.normalize('NFKC').toLocaleLowerCase('vi');
	const hasCodePrefix =
		!code ||
		normalizedCode === normalizedTitle ||
		normalizedTitle.startsWith(`[${normalizedCode}]`) ||
		normalizedTitle.startsWith(`${normalizedCode} `);
	const baseTitle = hasCodePrefix ? title : `[${code}] ${title}`;

	const suffixParts: string[] = [];
	if (group && !normalizedTitle.includes(`(${group.normalize('NFKC').toLocaleLowerCase('vi')}`)) {
		suffixParts.push(group);
	}
	if (credits) {
		suffixParts.push(`${credits} TC`);
	}
	const withSuffix =
		suffixParts.length > 0 ? `${baseTitle} (${suffixParts.join(' - ')})` : baseTitle;
	return event.icon ? `${event.icon} ${withSuffix}` : withSuffix;
}

export function toGoogleEventResource(event: ManagedEvent): GoogleEventResource {
	const recurrence = recurrenceLines(event);
	return {
		summary: formatGoogleEventSummary(event),
		description: Object.entries(event.metadata)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, value]) => `${key}: ${value}`)
			.join('\n'),
		location: event.location,
		start: { dateTime: event.start, timeZone: event.timeZone },
		end: { dateTime: event.end, timeZone: event.timeZone },
		...(recurrence.length > 0 ? { recurrence } : {}),
		...(event.colorId ? { colorId: event.colorId } : {}),
		extendedProperties: {
			private: {
				managedBy: MANAGED_BY,
				schemaVersion: '1',
				stableKey: event.stableKey,
				fingerprint: event.fingerprint ?? '',
				sourceFingerprint: event.sourceFingerprint ?? event.fingerprint ?? '',
				courseIcon: event.icon ?? ''
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
		let response: {
			items?: GoogleCalendarResource[];
			nextPageToken?: string;
		};
		try {
			response = await requestJson(
				fetcher,
				accessToken,
				`${API_BASE}/users/me/calendarList?${query}`
			);
		} catch (error) {
			if (isInsufficientCalendarListScope(error)) return [];
			throw error;
		}
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

export async function findLegacyCalendars(
	fetcher: typeof fetch,
	accessToken: string,
	sourceKind: ManagedEvent['sourceKind'],
	semester: number
): Promise<Array<{ id: string }>> {
	const legacyName =
		sourceKind === 'postgraduate'
			? `SDH${semester}`
			: sourceKind === 'lecturer'
				? `GV${semester}`
				: `SV${semester}`;
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
		let response: { items?: GoogleCalendarResource[]; nextPageToken?: string };
		try {
			response = await requestJson(
				fetcher,
				accessToken,
				`${API_BASE}/users/me/calendarList?${query}`
			);
		} catch (error) {
			if (isInsufficientCalendarListScope(error)) return [];
			throw error;
		}
		calendars.push(
			...(response.items ?? [])
				.filter(
					(calendar) =>
						calendar.id &&
						calendar.id !== 'primary' &&
						!calendar.primary &&
						!calendar.deleted &&
						calendar.summary === legacyName
				)
				.map((calendar) => ({ id: calendar.id }))
		);
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
		return await this.listEvents(calendarId, true);
	}

	async listCalendarEvents(calendarId: string): Promise<ManagedGoogleEvent[]> {
		return await this.listEvents(calendarId, false);
	}

	private async listEvents(
		calendarId: string,
		managedOnly: boolean
	): Promise<ManagedGoogleEvent[]> {
		const managed: ManagedGoogleEvent[] = [];
		let pageToken: string | undefined;
		do {
			const query = new URLSearchParams({
				singleEvents: 'false',
				showDeleted: 'false',
				maxResults: '2500'
			});
			if (managedOnly) query.set('privateExtendedProperty', `managedBy=${MANAGED_BY}`);
			if (pageToken) query.set('pageToken', pageToken);
			const response = await requestJson<{ items?: GoogleEventResource[]; nextPageToken?: string }>(
				this.fetcher,
				this.accessToken,
				`${API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${query}`
			);
			for (const item of response.items ?? []) {
				const privateData = item.extendedProperties?.private;
				if (!item.id || (managedOnly && (!privateData?.stableKey || !privateData.fingerprint))) {
					continue;
				}
				managed.push({
					id: item.id,
					...(item.etag ? { etag: item.etag } : {}),
					stableKey: privateData?.stableKey ?? `legacy:${item.id}`,
					fingerprint: privateData?.fingerprint ?? `legacy:${item.id}`,
					...(item.summary ? { summary: item.summary } : {}),
					...(item.description ? { description: item.description } : {}),
					...(item.location ? { location: item.location } : {}),
					...(item.start?.dateTime ? { start: item.start.dateTime } : {}),
					...(item.end?.dateTime ? { end: item.end.dateTime } : {}),
					...(privateData?.sourceFingerprint
						? { sourceFingerprint: privateData.sourceFingerprint }
						: {}),
					...(item.colorId ? { colorId: item.colorId } : {}),
					...(privateData?.courseIcon ? { icon: privateData.courseIcon } : {})
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
				body: JSON.stringify({ recurrence: [], ...toGoogleEventResource(event) })
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
		fingerprint: metadata?.fingerprint ?? fallback.fingerprint ?? '',
		...(metadata?.sourceFingerprint || fallback.sourceFingerprint
			? { sourceFingerprint: metadata?.sourceFingerprint ?? fallback.sourceFingerprint }
			: {}),
		...(resource.colorId || fallback.colorId
			? { colorId: resource.colorId ?? fallback.colorId }
			: {}),
		...(metadata?.courseIcon || fallback.icon
			? { icon: metadata?.courseIcon ?? fallback.icon }
			: {})
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
	for (let attempt = 0; ; attempt++) {
		const response = await fetcher(url, { ...init, headers });
		if (response.ok) return response;
		const detail = (await response.text()) || response.statusText;
		const transientQuota =
			response.status === 429 ||
			(response.status === 403 && /(?:user)?rateLimitExceeded/iu.test(detail));
		const safeServerRetry =
			['GET', 'PATCH', 'DELETE'].includes(init.method ?? 'GET') &&
			[500, 502, 503, 504].includes(response.status);
		if (attempt < 2 && (transientQuota || safeServerRetry)) {
			const retryAfter = response.headers.get('Retry-After');
			const seconds = retryAfter === null ? NaN : Number(retryAfter);
			const dateDelay = retryAfter === null ? NaN : Date.parse(retryAfter) - Date.now();
			const delay = Number.isFinite(seconds)
				? seconds * 1000
				: Number.isFinite(dateDelay)
					? dateDelay
					: 500 * 2 ** attempt + Math.random() * 200;
			await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(delay, 30_000))));
			continue;
		}
		throw new GoogleCalendarApiError(response.status, detail || response.statusText);
	}
}

function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
	if (!headers) return {};
	if (headers instanceof Headers) return Object.fromEntries(headers.entries());
	if (Array.isArray(headers)) return Object.fromEntries(headers);
	return { ...headers };
}

export class GoogleCalendarApiError extends Error {
	readonly status: number;
	readonly detail: string;

	constructor(status: number, detail: string) {
		const quota =
			status === 429 || (status === 403 && /rateLimitExceeded|quotaExceeded/iu.test(detail));
		super(
			`Google Calendar API ${status}: ${quota ? 'Google tạm giới hạn đồng bộ. Hãy chờ vài phút rồi thử lại; không cần đăng nhập lại. ' : ''}${detail}`
		);
		this.name = 'GoogleCalendarApiError';
		this.status = status;
		this.detail = detail;
	}
}

export function isGoogleCalendarAuthError(error: unknown): boolean {
	return (
		(error instanceof GoogleCalendarApiError &&
			(error.status === 401 ||
				/invalid credentials|invalid_token|unauthorized|access_token_scope_insufficient|insufficient authentication scopes|insufficient permission/i.test(
					error.detail
				))) ||
		(error instanceof Error &&
			/google calendar api 401|invalid credentials|invalid_token|unauthorized|access_token_scope_insufficient|insufficient authentication scopes|insufficient permission/i.test(
				error.message
			))
	);
}

function isInsufficientCalendarListScope(error: unknown): boolean {
	return (
		error instanceof GoogleCalendarApiError &&
		error.status === 403 &&
		(error.detail.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
			error.detail.includes('insufficient authentication scopes'))
	);
}
