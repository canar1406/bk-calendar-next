import {
	createCaptureStatus,
	createErrorStatus,
	EXTENSION_STATUS_KEY,
	type ExtensionStatus
} from './status.ts';
import { stageMyBkCapture } from './capture-workflow.ts';
import { createProfileStore } from '../../../../packages/timetable/src/storage.ts';
import { isContentMessage } from '../shared/messages.ts';
import { createChromeStorage } from '../storage/chrome.ts';

chrome.runtime.onInstalled.addListener(() => {
	void initializeStatus();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
	if (sender.id !== chrome.runtime.id || !isContentMessage(message)) return false;

	void handleMessage(message)
		.then(() => sendResponse({ ok: true }))
		.catch(() => sendResponse({ ok: false }));
	return true;
});

async function initializeStatus(): Promise<void> {
	const stored = await chrome.storage.local.get(EXTENSION_STATUS_KEY);
	if (stored[EXTENSION_STATUS_KEY] !== undefined) return;
	await persistStatus({ state: 'idle' });
}

async function handleMessage(message: ReturnType<typeof asContentMessage>): Promise<void> {
	const now = new Date().toISOString();
	let status: ExtensionStatus;
	if (message.type === 'bkalendar:capture') {
		try {
			const store = createProfileStore(createChromeStorage(chrome.storage.local));
			const staged = await stageMyBkCapture(store, message.capture, now);
			status = createCaptureStatus(message.capture, now, {
				added: staged.diff.added.length,
				changed: staged.diff.changed.length,
				removed: staged.diff.removed.length,
				unchanged: staged.diff.unchanged.length,
				canDelete: staged.diff.canDelete
			});
		} catch (error) {
			status = createErrorStatus(error, now);
		}
	} else {
		status = createErrorStatus(undefined, now);
	}
	await persistStatus(status);
}

function asContentMessage(message: Parameters<typeof isContentMessage>[0]) {
	if (!isContentMessage(message)) throw new Error('Unsupported extension message.');
	return message;
}

async function persistStatus(status: ExtensionStatus): Promise<void> {
	await chrome.storage.local.set({ [EXTENSION_STATUS_KEY]: status });
	await chrome.action.setBadgeBackgroundColor({ color: badgeColor(status) });
	await chrome.action.setBadgeText({ text: badgeText(status) });
}

function badgeText(status: ExtensionStatus): string {
	if (status.state === 'idle') return '';
	if (status.state === 'error') return '!';
	return status.completeness.state === 'complete' ? '✓' : '!';
}

function badgeColor(status: ExtensionStatus): string {
	if (status.state === 'captured' && status.completeness.state === 'complete') return '#087f5b';
	if (status.state === 'idle') return '#64748b';
	return '#b45309';
}
