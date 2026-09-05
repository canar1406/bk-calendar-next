import { extractTimetableFromDocument, isLikelyExpiredSession } from './extract.ts';
import { createDebouncedTask } from './observe.ts';
import type { ContentMessage } from '../shared/messages.ts';

const CAPTURE_DELAY_MS = 350;
let lastResultSignature = '';

chrome.runtime.onMessage.addListener((message: unknown) => {
	if (!message || typeof message !== 'object') return;
	const value = message as Record<string, unknown>;
	if (
		value.type !== 'bkalendar:offscreen:submit-credentials' ||
		typeof value.username !== 'string' ||
		typeof value.password !== 'string'
	) {
		return;
	}
	submitCredentials(value.username, value.password);
});

const captureTask = createDebouncedTask(
	() => {
		void captureCurrentPage();
	},
	CAPTURE_DELAY_MS,
	{
		set(callback, delayMs) {
			return window.setTimeout(callback, delayMs);
		},
		clear(handle) {
			window.clearTimeout(handle);
		}
	}
);

const observer = new MutationObserver(() => {
	captureTask.schedule();
});

observer.observe(document.documentElement, {
	childList: true,
	subtree: true
});
captureTask.schedule();

window.addEventListener(
	'pagehide',
	() => {
		observer.disconnect();
		captureTask.cancel();
	},
	{ once: true }
);

async function captureCurrentPage(): Promise<void> {
	try {
		const capture = extractTimetableFromDocument(document);
		const signature = JSON.stringify(capture);
		if (signature === lastResultSignature) return;
		lastResultSignature = signature;
		await sendMessage({ type: 'bkalendar:capture', capture });
	} catch (error) {
		if (isLikelyExpiredSession(document)) {
			const signature = 'session-expired';
			if (signature === lastResultSignature) return;
			lastResultSignature = signature;
			await sendMessage({
				type: 'bkalendar:session-expired',
				reason: error instanceof Error ? error.message : 'expired-session'
			});
			return;
		}
		if (!shouldReportCaptureError()) return;
		const signature = 'capture-error';
		if (signature === lastResultSignature) return;
		lastResultSignature = signature;
		await sendMessage({
			type: 'bkalendar:capture-error',
			reason: error instanceof Error ? error.message : 'unknown-capture-error'
		});
	}
}

function shouldReportCaptureError(): boolean {
	const url = new URL(window.location.href);
	if (url.hostname === 'mybk.hcmut.edu.vn') {
		return url.pathname.includes('/he-thong-quan-ly/sinh-vien/tkb');
	}
	// These portals render a login/dashboard shell before the timetable table.
	// Let the hidden capture timeout or a later mutation decide instead of
	// treating the first shell render as a failed timetable.
	return false;
}

async function sendMessage(message: ContentMessage): Promise<void> {
	try {
		if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
		await chrome.runtime.sendMessage(message);
	} catch {
		// The service worker can be briefly unavailable while an unpacked extension reloads
		// or when a stale content script survives an extension reload.
	}
}

function submitCredentials(username: string, password: string): void {
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
	if (!usernameInput || !passwordInput || !form) return;
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
	if (setter) {
		setter.call(usernameInput, username);
		setter.call(passwordInput, password);
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
}
