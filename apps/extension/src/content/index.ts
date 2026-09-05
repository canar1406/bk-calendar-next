import { extractTimetableFromDocument, isLikelyExpiredSession } from './extract.ts';
import { createDebouncedTask } from './observe.ts';
import type { ContentMessage } from '../shared/messages.ts';

const CAPTURE_DELAY_MS = 350;
let lastResultSignature = '';

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
