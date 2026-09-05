import type { MyBkCredentials } from '../auth/credential-vault.ts';
import type { MyBkCapture } from '../content/extract.ts';
import type { SourceKind } from '../../../../packages/timetable/src/index.ts';

export const MYBK_TIMETABLE_URL = 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb';
export const HCMUT_CAS_RENEW_URL =
	'https://sso.hcmut.edu.vn/cas/login?service=https%3A%2F%2Fmybk.hcmut.edu.vn%2Fapp%2Flogin%2Fcas&renew=true';

const BLANK_TAB_URL = 'about:blank';
const MAX_NAVIGATION_STEPS = 6;

export interface HiddenTabCreateProperties {
	url: string;
	active: false;
}

export interface HiddenWindowCreateProperties {
	url: string;
	focused: false;
	state: 'normal';
	type: 'popup';
}

export interface HiddenWindowUpdateProperties {
	focused: false;
	state: 'minimized';
}

export interface HiddenTabUpdateProperties {
	url: string;
}

export interface HiddenTabUpdateInfo {
	url?: string | undefined;
	status?: string | undefined;
}

export interface HiddenTabInfo {
	id?: number | undefined;
	url?: string | undefined;
}

export type HiddenTabUpdateListener = (
	tabId: number,
	changeInfo: HiddenTabUpdateInfo,
	tab: HiddenTabInfo
) => void;

export interface HiddenTabApi {
	createTab(properties: HiddenTabCreateProperties): Promise<unknown>;
	createWindow(properties: HiddenWindowCreateProperties): Promise<unknown>;
	updateWindow(windowId: number, properties: HiddenWindowUpdateProperties): Promise<unknown>;
	update(tabId: number, properties: HiddenTabUpdateProperties): Promise<unknown>;
	remove(tabId: number): Promise<void>;
	removeWindow(windowId: number): Promise<void>;
	onUpdated: {
		addListener(listener: HiddenTabUpdateListener): void;
		removeListener(listener: HiddenTabUpdateListener): void;
	};
}

export interface HiddenScriptApi {
	executeScript(injection: {
		target: { tabId: number };
		func: (username: string, password: string) => boolean;
		args: [string, string];
	}): Promise<Array<{ result?: boolean }>>;
}

export interface HiddenTabCaptureOptions {
	api: HiddenTabApi;
	url: string;
	sourceKind?: SourceKind;
	credentials: MyBkCredentials;
	waitForCapture(tabId: number): Promise<MyBkCapture>;
	registerSessionExpired?(tabId: number, handler: (reason?: string) => Promise<void>): () => void;
	cancelCapture?(tabId: number, error: unknown): boolean;
	submitCredentials(tabId: number, credentials: MyBkCredentials): Promise<boolean>;
}

export interface HiddenCaptureRegistry {
	readonly size: number;
	wait(tabId: number, timeoutMs: number): Promise<MyBkCapture>;
	resolve(tabId: number, capture: MyBkCapture): boolean;
	reject(tabId: number, error: unknown): boolean;
	signalSessionExpired(tabId: number, reason?: string): boolean;
	registerSessionExpired(tabId: number, handler: (reason?: string) => Promise<void>): () => void;
}

interface CaptureWaiter {
	resolve(capture: MyBkCapture): void;
	reject(error: unknown): void;
	timer: ReturnType<typeof setTimeout>;
}

export function createHiddenCaptureRegistry(): HiddenCaptureRegistry {
	const waiters = new Map<number, CaptureWaiter>();
	const sessionHandlers = new Map<number, (reason?: string) => Promise<void>>();

	function take(tabId: number): CaptureWaiter | undefined {
		const waiter = waiters.get(tabId);
		if (!waiter) return undefined;
		waiters.delete(tabId);
		clearTimeout(waiter.timer);
		return waiter;
	}

	return {
		get size() {
			return waiters.size;
		},
		wait(tabId, timeoutMs) {
			if (waiters.has(tabId)) {
				return Promise.reject(new Error('Tab MyBK này đã có một lượt đọc đang chờ.'));
			}
			return new Promise((resolve, reject) => {
				const timer = setTimeout(() => {
					const waiter = take(tabId);
					waiter?.reject(new Error('Không đọc được bảng TKB trong tab nền.'));
				}, timeoutMs);
				waiters.set(tabId, { resolve, reject, timer });
			});
		},
		resolve(tabId, capture) {
			const waiter = take(tabId);
			if (!waiter) return false;
			waiter.resolve(capture);
			return true;
		},
		reject(tabId, error) {
			const waiter = take(tabId);
			if (!waiter) return false;
			waiter.reject(error);
			return true;
		},
		signalSessionExpired(tabId, reason) {
			const handler = sessionHandlers.get(tabId);
			if (!handler) return false;
			void handler(reason).catch((error) => {
				const waiter = take(tabId);
				waiter?.reject(error);
			});
			return true;
		},
		registerSessionExpired(tabId, handler) {
			sessionHandlers.set(tabId, handler);
			return () => {
				if (sessionHandlers.get(tabId) === handler) sessionHandlers.delete(tabId);
			};
		}
	};
}

export async function captureInHiddenTab({
	api,
	url,
	sourceKind = 'student-2024',
	credentials,
	waitForCapture,
	registerSessionExpired,
	cancelCapture,
	submitCredentials
}: HiddenTabCaptureOptions): Promise<MyBkCapture> {
	const hiddenTab = await api.createTab({ url: BLANK_TAB_URL, active: false });
	const tabId = readTabId(hiddenTab);
	if (tabId === undefined) {
		throw new Error('Không tạo được cửa sổ nền để đọc MyBK.');
	}

	let rejectNavigation!: (error: unknown) => void;
	const navigationFailure = new Promise<never>((_, reject) => {
		rejectNavigation = reject;
	});
	let navigationSteps = 0;
	let submittedCas = false;
	let sessionRecoveryAttempts = 0;
	let navigationQueue = Promise.resolve();

	const listener: HiddenTabUpdateListener = (updatedTabId, changeInfo, updatedTab) => {
		if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
		const currentUrl = changeInfo.url ?? updatedTab.url;
		if (!currentUrl) return;
		navigationQueue = navigationQueue
			.then(async () => {
				navigationSteps += 1;
				if (navigationSteps > MAX_NAVIGATION_STEPS) {
					throw new Error('MyBK chuyển hướng quá nhiều lần khi đọc TKB.');
				}

				const route = classifyMyBkRoute(currentUrl, url, sourceKind);
				if (route === 'timetable') return;
				if (route === 'app-home') {
					await api.update(tabId, { url });
					return;
				}
				if (route === 'mybk-login') {
					await api.update(tabId, { url: HCMUT_CAS_RENEW_URL });
					return;
				}
				if (route === 'cas-login') {
					if (submittedCas) {
						throw new Error('MyBK từ chối đăng nhập. Hãy kiểm tra lại tài khoản hoặc mật khẩu.');
					}
					submittedCas = true;
					if (!(await submitCredentials(tabId, credentials))) {
						throw new Error('Không tìm thấy biểu mẫu đăng nhập HCMUT trong tab nền.');
					}
					return;
				}
				if (route === 'portal-login') {
					if (submittedCas) return;
					if (await submitCredentials(tabId, credentials)) submittedCas = true;
					return;
				}
				throw new Error('MyBK chuyển đến một trang không được hỗ trợ khi đọc TKB.');
			})
			.catch(rejectNavigation);
	};

	const capturePromise = waitForCapture(tabId);
	const unregisterSessionExpired =
		registerSessionExpired?.(tabId, async () => {
			if (sessionRecoveryAttempts >= 1) {
				throw new Error('Phiên MyBK vẫn hết hạn sau khi đăng nhập lại.');
			}
			sessionRecoveryAttempts += 1;
			submittedCas = false;
			await api.update(tabId, {
				url: sourceKind === 'student-2024' ? HCMUT_CAS_RENEW_URL : url
			});
		}) ?? (() => {});
	api.onUpdated.addListener(listener);
	let terminalError: unknown;
	try {
		await api.update(tabId, { url });
		return await Promise.race([capturePromise, navigationFailure]);
	} catch (error) {
		terminalError = error;
		throw error;
	} finally {
		cancelCapture?.(tabId, terminalError ?? new Error('Lượt đọc TKB trong tab nền đã kết thúc.'));
		unregisterSessionExpired();
		api.onUpdated.removeListener(listener);
		await api.remove(tabId).catch(() => {});
	}
}

export async function submitCasCredentials(
	api: HiddenScriptApi,
	tabId: number,
	credentials: MyBkCredentials
): Promise<boolean> {
	const results = await api.executeScript({
		target: { tabId },
		func: (username, password) => {
			const usernameInput = document.querySelector<HTMLInputElement>(
				'input[name="username"], input#username, input[name="user"], input[type="email"]'
			);
			const passwordInput = document.querySelector<HTMLInputElement>(
				'input[name="password"], input#password, input[type="password"]'
			);
			const form =
				passwordInput?.form ??
				usernameInput?.form ??
				document.querySelector<HTMLFormElement>(
					'form#fm1, form[action*="/cas/login"], form:has(input[type="password"])'
				);
			if (!usernameInput || !passwordInput || !form) return false;

			const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
			if (valueSetter) {
				valueSetter.call(usernameInput, username);
				valueSetter.call(passwordInput, password);
			} else {
				usernameInput.value = username;
				passwordInput.value = password;
			}
			for (const input of [usernameInput, passwordInput]) {
				input.dispatchEvent(new Event('input', { bubbles: true }));
				input.dispatchEvent(new Event('change', { bubbles: true }));
			}
			if (typeof form.requestSubmit === 'function') form.requestSubmit();
			else form.submit();
			return true;
		},
		args: [credentials.username, credentials.password]
	});
	return results.some((result) => result.result === true);
}

function readTabId(tab: unknown): number | undefined {
	if (!tab || typeof tab !== 'object' || !('id' in tab)) return undefined;
	return typeof tab.id === 'number' ? tab.id : undefined;
}

type MyBkRoute = 'timetable' | 'app-home' | 'mybk-login' | 'cas-login' | 'portal-login' | 'unknown';

function classifyMyBkRoute(
	currentUrl: string,
	timetableUrl: string,
	sourceKind: SourceKind
): MyBkRoute {
	try {
		const current = new URL(currentUrl);
		const timetable = new URL(timetableUrl);
		const isSameSourceHost = current.hostname === timetable.hostname;
		const isLoginPath = /(?:login|signin|auth|cas)/iu.test(current.pathname);
		if (
			sourceKind === 'student-2024' &&
			isSameSourceHost &&
			!isLoginPath &&
			(current.pathname === timetable.pathname ||
				current.pathname.startsWith(`${timetable.pathname}/`))
		) {
			return 'timetable';
		}
		if (current.hostname === 'sso.hcmut.edu.vn' && current.pathname.startsWith('/cas/login')) {
			return 'cas-login';
		}
		if (sourceKind !== 'student-2024' && isSameSourceHost) return 'portal-login';
		if (current.hostname !== 'mybk.hcmut.edu.vn') return 'unknown';
		if (current.pathname.startsWith('/app/login/cas')) return 'app-home';
		if (current.pathname.startsWith('/app/login')) return 'mybk-login';
		if (current.pathname === '/app' || current.pathname === '/app/') return 'app-home';
		return 'unknown';
	} catch {
		return 'unknown';
	}
}
