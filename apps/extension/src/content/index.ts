import { extractMyBkTableFromDocument } from './extract.ts';
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
		const capture = extractMyBkTableFromDocument(document);
		const signature = JSON.stringify(capture);
		if (signature === lastResultSignature) return;
		lastResultSignature = signature;
		await sendMessage({ type: 'bkalendar:capture', capture });
	} catch (error) {
		const signature = 'capture-error';
		if (signature === lastResultSignature) return;
		lastResultSignature = signature;
		await sendMessage({
			type: 'bkalendar:capture-error',
			reason: error instanceof Error ? error.message : 'unknown-capture-error'
		});
	}
}

async function sendMessage(message: ContentMessage): Promise<void> {
	try {
		await chrome.runtime.sendMessage(message);
	} catch {
		// The service worker can be briefly unavailable while an unpacked extension reloads.
	}
}
