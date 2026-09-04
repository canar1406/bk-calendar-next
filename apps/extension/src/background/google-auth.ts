import { CALENDAR_SCOPE } from '../../../../packages/google-calendar/src/oauth.ts';

export const GOOGLE_WEB_CLIENT_ID =
	'290456536857-ujdg26n2gqovjc27h2mqrd9p6vhm7pbp.apps.googleusercontent.com';

export interface ExtensionIdentityApi {
	getAuthToken?(details: { interactive: boolean }): Promise<{ token?: string }>;
	removeCachedAuthToken?(details: { token: string }): Promise<void>;
	getRedirectURL(path?: string): string;
	launchWebAuthFlow(details: {
		url: string;
		interactive: boolean;
		abortOnLoadForNonInteractive?: boolean;
		timeoutMsForNonInteractive?: number;
	}): Promise<string | undefined>;
}

export async function requestGoogleToken(
	identity: ExtensionIdentityApi,
	interactive: boolean,
	webClientId: string
): Promise<string> {
	const nativeToken = await tryNativeToken(identity, interactive);
	if (nativeToken) return nativeToken;
	return await requestWebFlowToken(identity, interactive, webClientId);
}

export async function disconnectGoogle(identity: ExtensionIdentityApi): Promise<void> {
	if (!identity.getAuthToken || !identity.removeCachedAuthToken) return;
	try {
		const result = await identity.getAuthToken({ interactive: false });
		if (result.token) await identity.removeCachedAuthToken({ token: result.token });
	} catch {
		// Edge web-flow tokens are never persisted, and a missing Chrome token is disconnected.
	}
}

async function tryNativeToken(
	identity: ExtensionIdentityApi,
	interactive: boolean
): Promise<string | undefined> {
	if (!identity.getAuthToken) return undefined;
	try {
		return (await identity.getAuthToken({ interactive })).token;
	} catch {
		return undefined;
	}
}

async function requestWebFlowToken(
	identity: ExtensionIdentityApi,
	interactive: boolean,
	webClientId: string
): Promise<string> {
	if (!webClientId.trim()) throw new Error('Thiếu Google OAuth web client ID.');
	const redirectUri = identity.getRedirectURL();
	const state = randomState();
	const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	authUrl.search = new URLSearchParams({
		client_id: webClientId,
		redirect_uri: redirectUri,
		response_type: 'token',
		scope: CALENDAR_SCOPE,
		state,
		include_granted_scopes: 'true',
		prompt: interactive ? 'select_account consent' : 'none'
	}).toString();

	let responseUrl: string | undefined;
	try {
		responseUrl = await identity.launchWebAuthFlow({
			url: authUrl.href,
			interactive,
			...(!interactive
				? {
						abortOnLoadForNonInteractive: false,
						timeoutMsForNonInteractive: 15_000
					}
				: {})
		});
	} catch {
		responseUrl = undefined;
	}
	if (!responseUrl) {
		throw new Error('Hãy mở BKalendar và chọn Kết nối Google Calendar.');
	}
	const redirected = new URL(responseUrl);
	if (
		redirected.hostname === 'accounts.google.com' &&
		redirected.pathname.startsWith('/signin/oauth/error')
	) {
		throw new Error(
			`Google OAuth từ chối redirect URI. Hãy thêm Authorized redirect URI sau vào Google Cloud: ${redirectUri}`
		);
	}
	const params = new URLSearchParams(redirected.hash.slice(1) || redirected.search.slice(1));
	if (params.get('state') !== state) throw new Error('Phản hồi Google OAuth không hợp lệ.');
	const error = params.get('error');
	if (error) {
		throw new Error(params.get('error_description') || `Google OAuth: ${error}`);
	}
	const token = params.get('access_token');
	if (!token) throw new Error('Google OAuth không trả về access token.');
	return token;
}

function randomState(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
