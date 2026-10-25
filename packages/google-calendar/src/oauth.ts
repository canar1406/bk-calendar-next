import { GoogleOAuthError } from './auth-errors.ts';

export const CALENDAR_SCOPE = [
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
	'https://www.googleapis.com/auth/calendar.app.created'
].join(' ');

export const HCMUT_HOSTED_DOMAIN = 'hcmut.edu.vn';

export interface GoogleTokenResponse {
	access_token?: string;
	expires_in?: number | string;
	scope?: string;
	error?: string;
	error_description?: string;
}

export interface GoogleTokenClient {
	requestAccessToken(options?: { prompt?: string }): void;
}

export interface GoogleIdentityApi {
	accounts: {
		oauth2: {
			initTokenClient(config: {
				client_id: string;
				scope: string;
				prompt?: string;
				hosted_domain?: string;
				include_granted_scopes?: boolean;
				callback: (response: GoogleTokenResponse) => void;
				error_callback?: (error: { type: string }) => void;
			}): GoogleTokenClient;
		};
	};
}

const tokenCache = new WeakMap<
	GoogleIdentityApi,
	Map<string, { token: string; expiresAt: number }>
>();
const pendingRequests = new WeakMap<GoogleIdentityApi, Map<string, Promise<string>>>();

export function clearGoogleAccessToken(identity: GoogleIdentityApi, clientId: string): void {
	tokenCache.get(identity)?.delete(clientId);
}

export function requestGoogleAccessToken(
	googleIdentity: GoogleIdentityApi,
	clientId: string
): Promise<string> {
	if (!clientId.trim()) {
		return Promise.reject(new Error('Thiếu Google OAuth client ID.'));
	}

	const cached = tokenCache.get(googleIdentity)?.get(clientId);
	if (cached && cached.expiresAt > Date.now() + 60_000) return Promise.resolve(cached.token);
	const pending = pendingRequests.get(googleIdentity)?.get(clientId);
	if (pending) return pending;
	const requests = pendingRequests.get(googleIdentity) ?? new Map<string, Promise<string>>();
	pendingRequests.set(googleIdentity, requests);
	const request = new Promise<string>((resolve, reject) => {
		let settled = false;
		const fail = (error: unknown): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			reject(error);
		};
		const timeout = setTimeout(
			() =>
				fail(
					new GoogleOAuthError('timeout', 'Đăng nhập Google quá lâu. Hãy đóng cửa sổ và thử lại.')
				),
			120_000
		);
		try {
			const tokenClient = googleIdentity.accounts.oauth2.initTokenClient({
				client_id: clientId,
				scope: CALENDAR_SCOPE,
				prompt: 'select_account',
				hosted_domain: HCMUT_HOSTED_DOMAIN,
				include_granted_scopes: true,
				error_callback(error) {
					fail(new GoogleOAuthError(error.type));
				},
				callback(response) {
					if (settled) return;
					if (response.error) {
						fail(new GoogleOAuthError(response.error, response.error_description));
						return;
					}
					if (!response.access_token) {
						fail(new Error('Google không trả về access token. Hãy thử đăng nhập lại.'));
						return;
					}
					if (typeof response.scope === 'string' && response.scope.trim().length > 0) {
						const granted = new Set(response.scope.split(/\s+/).filter(Boolean));
						const hasWriteScope =
							granted.has('https://www.googleapis.com/auth/calendar') ||
							granted.has('https://www.googleapis.com/auth/calendar.events') ||
							granted.has('https://www.googleapis.com/auth/calendar.app.created');
						if (!hasWriteScope) {
							fail(
								new Error(
									'Bạn chưa tích chọn quyền tạo và chỉnh sửa lịch Google Calendar trong cửa sổ đăng nhập. Hãy bấm đồng bộ lại và tích chọn đầy đủ các quyền.'
								)
							);
							return;
						}
					}
					settled = true;
					clearTimeout(timeout);
					const seconds = Number(response.expires_in ?? 3600);
					const tokens = tokenCache.get(googleIdentity) ?? new Map();
					tokens.set(clientId, {
						token: response.access_token,
						expiresAt:
							Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 3600) * 1000
					});
					tokenCache.set(googleIdentity, tokens);
					resolve(response.access_token);
				}
			});
			tokenClient.requestAccessToken({ prompt: 'select_account' });
		} catch (error) {
			fail(error);
		}
	}).finally(() => {
		requests.delete(clientId);
	});
	requests.set(clientId, request);
	return request;
}

export async function revokeGoogleAccessToken(
	accessToken: string,
	fetcher: typeof fetch = fetch
): Promise<void> {
	const response = await fetcher(
		`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
		{ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
	);
	if (!response.ok) throw new Error(`Không thể thu hồi quyền Google (${response.status}).`);
}
