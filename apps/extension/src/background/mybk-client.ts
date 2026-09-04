import type { MyBkCredentials } from '../auth/credential-vault.ts';
import { extractMyBkTableFromDocument, type MyBkCapture } from '../content/extract.ts';

export const MYBK_TIMETABLE_URL = 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb';
const MYBK_CAS_ENTRY_URL =
	'https://sso.hcmut.edu.vn/cas/login?service=https%3A%2F%2Fmybk.hcmut.edu.vn%2Fapp%2Flogin%2Fcas';

export interface MyBkHttpResponse {
	url: string;
	status: number;
	body: string;
}

export interface MyBkHttpClient {
	request(url: string, init?: RequestInit): Promise<MyBkHttpResponse>;
}

export function createFetchMyBkHttpClient(fetcher: typeof fetch = fetch): MyBkHttpClient {
	return {
		async request(url, init = {}) {
			let response: Response;
			try {
				response = await fetcher(url, {
					...init,
					credentials: 'include',
					redirect: 'follow',
					cache: 'no-store'
				});
			} catch (cause) {
				throw new Error(
					'Không thể kết nối MyBK trong nền. Hãy cập nhật quyền extension rồi thử lại.',
					{ cause }
				);
			}
			return {
				url: response.url,
				status: response.status,
				body: await response.text()
			};
		}
	};
}

export async function fetchMyBkTimetable(
	client: MyBkHttpClient,
	credentials: MyBkCredentials
): Promise<MyBkCapture> {
	let initial: MyBkHttpResponse | undefined;
	try {
		initial = await client.request(MYBK_TIMETABLE_URL, { method: 'GET' });
	} catch {
		// MyBK currently emits an HTTP login redirect before returning to HTTPS.
		// Skip that redirect chain and enter HCMUT CAS directly over HTTPS.
	}
	const existingCapture = initial ? tryExtract(initial.body) : undefined;
	if (existingCapture) return existingCapture;

	const casPage =
		initial && isCasLogin(initial)
			? initial
			: await client.request(MYBK_CAS_ENTRY_URL, { method: 'GET' });
	const form = parseCasLoginForm(casPage);
	const body = new URLSearchParams({
		...form.hiddenFields,
		username: credentials.username,
		password: credentials.password,
		_eventId: form.hiddenFields._eventId ?? 'submit',
		submit: form.hiddenFields.submit ?? 'Login'
	});
	const loginResult = await client.request(form.action, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});
	if (isCasLogin(loginResult) && hasPasswordForm(loginResult.body)) {
		throw new Error('Tài khoản hoặc mật khẩu MyBK không đúng.');
	}

	const timetable = await client.request(MYBK_TIMETABLE_URL, { method: 'GET' });
	const capture = tryExtract(timetable.body);
	if (capture) return capture;
	if (isCasLogin(timetable) || isMyBkLogin(timetable)) {
		throw new Error('MyBK chưa tạo được phiên đăng nhập. Hãy kiểm tra lại tài khoản.');
	}
	throw new Error('MyBK đã đăng nhập nhưng chưa trả về bảng thời khóa biểu.');
}

function tryExtract(html: string): MyBkCapture | undefined {
	try {
		return extractMyBkTableFromDocument(html);
	} catch {
		return undefined;
	}
}

function parseCasLoginForm(response: MyBkHttpResponse): {
	action: string;
	hiddenFields: Record<string, string>;
} {
	const formMatch = [...response.body.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/giu)].find(
		(match) => looksLikeCasForm(match[2] ?? '')
	);
	if (!formMatch || (!isCasLogin(response) && !looksLikeCasForm(formMatch[2] ?? ''))) {
		throw new Error('MyBK không chuyển đến trang đăng nhập HCMUT CAS.');
	}
	const hiddenFields: Record<string, string> = {};
	for (const input of (formMatch[2] ?? '').matchAll(/<input\b([^>]+)>/giu)) {
		const attributes = input[1] ?? '';
		if (!/\btype=["']hidden["']/iu.test(attributes)) continue;
		const name = attribute(attributes, 'name');
		if (!name) continue;
		hiddenFields[name] = attribute(attributes, 'value') ?? '';
	}
	const action = attribute(formMatch[1] ?? '', 'action') ?? '/cas/login';
	const actionUrl = new URL(decodeHtml(action), response.url);
	if (actionUrl.hostname !== 'sso.hcmut.edu.vn') {
		if (actionUrl.pathname.startsWith('/cas/login') && looksLikeCasForm(formMatch[2] ?? '')) {
			actionUrl.protocol = 'https:';
			actionUrl.hostname = 'sso.hcmut.edu.vn';
		} else {
			throw new Error('Biểu mẫu đăng nhập MyBK không hợp lệ.');
		}
	}
	return {
		action: actionUrl.href,
		hiddenFields
	};
}

function looksLikeCasForm(html: string): boolean {
	return (
		/\bname=["']lt["']/iu.test(html) &&
		/\bname=["']execution["']/iu.test(html) &&
		/\bname=["']password["']/iu.test(html)
	);
}

function attribute(source: string, name: string): string | undefined {
	const match = source.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'iu'));
	return match ? decodeHtml(match[1] ?? '') : undefined;
}

function decodeHtml(value: string): string {
	return value
		.replaceAll('&amp;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

function isCasLogin(response: MyBkHttpResponse): boolean {
	try {
		const url = new URL(response.url);
		return url.hostname === 'sso.hcmut.edu.vn' && url.pathname.startsWith('/cas/login');
	} catch {
		return false;
	}
}

function isMyBkLogin(response: MyBkHttpResponse): boolean {
	try {
		const url = new URL(response.url);
		return url.hostname === 'mybk.hcmut.edu.vn' && url.pathname.startsWith('/app/login');
	} catch {
		return false;
	}
}

function hasPasswordForm(html: string): boolean {
	return /\bname=["']password["']/iu.test(html);
}
