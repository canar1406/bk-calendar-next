export const CALENDAR_SCOPE = [
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
	'https://www.googleapis.com/auth/calendar.app.created'
].join(' ');

export interface GoogleTokenResponse {
	access_token?: string;
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
				callback: (response: GoogleTokenResponse) => void;
			}): GoogleTokenClient;
		};
	};
}

export function requestGoogleAccessToken(
	googleIdentity: GoogleIdentityApi,
	clientId: string
): Promise<string> {
	if (!clientId.trim()) {
		return Promise.reject(new Error('Thiếu Google OAuth client ID.'));
	}

	return new Promise<string>((resolve, reject) => {
		const tokenClient = googleIdentity.accounts.oauth2.initTokenClient({
			client_id: clientId,
			scope: CALENDAR_SCOPE,
			prompt: 'select_account consent',
			callback(response) {
				if (response.error) {
					reject(new Error(response.error_description || `Google OAuth: ${response.error}`));
					return;
				}
				if (!response.access_token) {
					reject(new Error('Google không trả về access token. Hãy thử đăng nhập lại.'));
					return;
				}
				resolve(response.access_token);
			}
		});
		tokenClient.requestAccessToken({ prompt: 'select_account consent' });
	});
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
