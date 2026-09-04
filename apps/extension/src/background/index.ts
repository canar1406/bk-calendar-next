import {
	createCaptureStatus,
	createErrorStatus,
	EXTENSION_STATUS_KEY,
	type ExtensionStatus
} from './status.ts';
import { stageMyBkCapture } from './capture-workflow.ts';
import { createProfileStore } from '../../../../packages/timetable/src/storage.ts';
import { isContentMessage, isPopupMessage, type PopupMessage } from '../shared/messages.ts';
import { createChromeStorage } from '../storage/chrome.ts';
import { createChromeCredentialVault } from '../auth/chrome-vault.ts';
import { createFetchMyBkHttpClient, fetchMyBkTimetable } from './mybk-client.ts';
import {
	decideTrackingAction,
	isTrackingMode,
	type ChangeSummary,
	type TrackingMode
} from './tracking-policy.ts';
import {
	GoogleCalendarRestGateway,
	createManagedCalendar,
	findManagedCalendars
} from '../../../../packages/google-calendar/src/index.ts';
import { syncPendingProfile } from '../../../../packages/google-calendar/src/profile-sync.ts';
import { GOOGLE_WEB_CLIENT_ID, disconnectGoogle, requestGoogleToken } from './google-auth.ts';
import {
	TRACKING_NOTIFICATION_ID,
	buildTrackingNotification,
	isTrackingNotification,
	type TrackingNotificationKind
} from './tracking-notification.ts';
import { LAST_DIFF_STORAGE_KEY, createDiffLog } from '../shared/diff-log.ts';

const TRACKING_ALARM = 'bkalendar-next:track-mybk';
const TRACKING_MODE_KEY = 'bkalendar-next:tracking-mode';
const DEFAULT_TRACKING_MODE: TrackingMode = 'review';
const ALARM_PERIOD_MINUTES = 30;
let activeTrackingRun: Promise<void> | undefined;

chrome.runtime.onInstalled.addListener(() => {
	void initializeExtension();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
	if (sender.id !== chrome.runtime.id) return false;

	if (isContentMessage(message)) {
		void handleContentMessage(message)
			.then(() => sendResponse({ ok: true }))
			.catch((error) => sendResponse({ ok: false, message: safeMessage(error) }));
		return true;
	}
	if (isPopupMessage(message)) {
		void handlePopupMessage(message)
			.then((response) => sendResponse({ ok: true, ...response }))
			.catch((error) => sendResponse({ ok: false, message: safeMessage(error) }));
		return true;
	}
	return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
	if (alarm.name !== TRACKING_ALARM) return;
	void runBackgroundTracking();
});

chrome.notifications.onClicked.addListener((notificationId) => {
	if (!isTrackingNotification(notificationId)) return;
	void openDiffDetails(notificationId);
});

void hardenLocalStorage();

async function initializeExtension(): Promise<void> {
	await hardenLocalStorage();
	await initializeStatus();
	await chrome.alarms.create(TRACKING_ALARM, {
		periodInMinutes: ALARM_PERIOD_MINUTES
	});
}

async function hardenLocalStorage(): Promise<void> {
	await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

async function handlePopupMessage(message: PopupMessage): Promise<{
	configured?: boolean;
	trackingMode?: TrackingMode;
	googleConnected?: boolean;
}> {
	const vault = createChromeCredentialVault();
	if (message.type === 'bkalendar:settings:get') {
		return {
			configured: await vault.hasCredentials(),
			trackingMode: await readTrackingMode(),
			googleConnected: await hasGoogleConnection()
		};
	}
	if (message.type === 'bkalendar:google:connect') {
		await requestGoogleToken(chrome.identity, true, GOOGLE_WEB_CLIENT_ID);
		await runBackgroundTracking();
		return {
			configured: await vault.hasCredentials(),
			trackingMode: await readTrackingMode(),
			googleConnected: true
		};
	}
	if (message.type === 'bkalendar:google:disconnect') {
		await disconnectGoogle(chrome.identity);
		return {
			configured: await vault.hasCredentials(),
			trackingMode: await readTrackingMode(),
			googleConnected: false
		};
	}
	if (message.type === 'bkalendar:credentials:save') {
		if (!message.consent) {
			throw new Error('Bạn cần xác nhận cho phép lưu đăng nhập MyBK trên thiết bị này.');
		}
		await vault.save({ username: message.username, password: message.password });
		await saveTrackingMode(message.trackingMode);
		if (message.trackingMode !== 'off') await runBackgroundTracking();
		return {
			configured: true,
			trackingMode: message.trackingMode,
			googleConnected: await hasGoogleConnection()
		};
	}
	if (message.type === 'bkalendar:credentials:remove') {
		await vault.remove();
		await saveTrackingMode('off');
		return {
			configured: false,
			trackingMode: 'off',
			googleConnected: await hasGoogleConnection()
		};
	}
	if (message.type === 'bkalendar:tracking:set-mode') {
		if (message.trackingMode !== 'off' && !(await vault.hasCredentials())) {
			throw new Error('Hãy lưu tài khoản MyBK trước khi bật theo dõi nền.');
		}
		await saveTrackingMode(message.trackingMode);
		if (message.trackingMode !== 'off') await runBackgroundTracking();
		return {
			configured: await vault.hasCredentials(),
			trackingMode: message.trackingMode,
			googleConnected: await hasGoogleConnection()
		};
	}
	await runBackgroundTracking(true);
	return {
		configured: await vault.hasCredentials(),
		trackingMode: await readTrackingMode(),
		googleConnected: await hasGoogleConnection()
	};
}

async function runBackgroundTracking(force = false): Promise<void> {
	if (activeTrackingRun) return await activeTrackingRun;
	const run = performBackgroundTracking(force);
	activeTrackingRun = run;
	try {
		await run;
	} finally {
		if (activeTrackingRun === run) activeTrackingRun = undefined;
	}
}

async function performBackgroundTracking(force: boolean): Promise<void> {
	const mode = await readTrackingMode();
	if (!force && mode === 'off') return;
	const vault = createChromeCredentialVault();
	const credentials = await vault.read();
	if (!credentials) {
		if (force) throw new Error('Chưa lưu tài khoản MyBK.');
		return;
	}
	try {
		const capture = await fetchMyBkTimetable(createFetchMyBkHttpClient(), credentials);
		await processCapture(capture, mode);
	} catch (error) {
		const now = new Date().toISOString();
		await persistStatus(createErrorStatus(error, now));
		await notifyTrackingError('BKalendar chưa thể cập nhật', safeMessage(error));
		if (force) throw error;
	}
}

async function processCapture(
	capture: Parameters<typeof stageMyBkCapture>[1],
	mode: TrackingMode
): Promise<void> {
	const { changes, staged, store } = await stageCapture(capture);
	const action = decideTrackingAction(mode, changes);
	if (!action.shouldNotify) return;

	if (mode === 'auto-safe' && changes.removed > 0 && !changes.canDelete) {
		await persistDiffLog(
			createDiffLog(staged.profileId, 'review', staged.diff, new Date().toISOString())
		);
		await notifyTrackingError(
			'BKalendar chưa tự xóa',
			'MyBK chưa trả về dữ liệu đầy đủ nên BKalendar đã chặn cập nhật có nguy cơ xóa nhầm.'
		);
		return;
	}

	if (!action.shouldApplyUpserts && !action.shouldApplyRemovals) {
		await persistDiffLog(
			createDiffLog(staged.profileId, 'review', staged.diff, new Date().toISOString())
		);
		await persistStatus(createCaptureStatus(capture, new Date().toISOString(), changes, 'review'));
		await notifyChanges('review', changes, staged.profile.semester);
		return;
	}

	const accessToken = await requestGoogleToken(chrome.identity, false, GOOGLE_WEB_CLIENT_ID);
	const synced = await syncPendingProfile(store, staged.profileId, {
		gateway: new GoogleCalendarRestGateway(accessToken),
		findCalendars: async (summary) => await findManagedCalendars(fetch, accessToken, summary),
		createCalendar: async (summary) => await createManagedCalendar(fetch, accessToken, summary)
	});
	if (synced.result.failed.length > 0 || !synced.promoted) {
		throw new Error('Google Calendar chưa áp dụng đầy đủ thay đổi.');
	}
	await persistDiffLog(
		createDiffLog(staged.profileId, 'applied', synced.diff, new Date().toISOString())
	);
	await persistStatus(createCaptureStatus(capture, new Date().toISOString(), changes, 'applied'));
	await notifyChanges(
		'applied',
		{
			added: synced.result.inserted,
			changed: synced.result.patched,
			removed: synced.result.deleted,
			unchanged: synced.result.unchanged,
			canDelete: true
		},
		staged.profile.semester
	);
}

async function notifyChanges(
	kind: TrackingNotificationKind,
	changes: ChangeSummary,
	semester: number
): Promise<void> {
	const notification = buildTrackingNotification(kind, changes);
	await chrome.notifications.create(`${TRACKING_NOTIFICATION_ID}:${semester}`, {
		type: 'basic',
		iconUrl: 'icons/icon-128.png',
		title: notification.title,
		message: notification.message
	});
}

async function notifyTrackingError(title: string, message: string): Promise<void> {
	await chrome.notifications.create(`${TRACKING_NOTIFICATION_ID}:error`, {
		type: 'basic',
		iconUrl: 'icons/icon-128.png',
		title,
		message
	});
}

async function readTrackingMode(): Promise<TrackingMode> {
	const stored = await chrome.storage.local.get(TRACKING_MODE_KEY);
	const value = stored[TRACKING_MODE_KEY];
	return isTrackingMode(value) ? value : DEFAULT_TRACKING_MODE;
}

async function saveTrackingMode(mode: TrackingMode): Promise<void> {
	await chrome.storage.local.set({ [TRACKING_MODE_KEY]: mode });
}

async function stageCapture(capture: Parameters<typeof stageMyBkCapture>[1]): Promise<{
	changes: ChangeSummary;
	staged: Awaited<ReturnType<typeof stageMyBkCapture>>;
	store: ReturnType<typeof createProfileStore>;
}> {
	const now = new Date().toISOString();
	const store = createProfileStore(createChromeStorage(chrome.storage.local));
	const staged = await stageMyBkCapture(store, capture, now);
	const changes = {
		added: staged.diff.added.length,
		changed: staged.diff.changed.length,
		removed: staged.diff.removed.length,
		unchanged: staged.diff.unchanged.length,
		canDelete: staged.diff.canDelete
	};
	await persistStatus(createCaptureStatus(capture, now, changes));
	return { changes, staged, store };
}

async function handleContentMessage(message: ReturnType<typeof asContentMessage>): Promise<void> {
	const now = new Date().toISOString();
	let status: ExtensionStatus;
	if (message.type === 'bkalendar:capture') {
		try {
			const mode = await readTrackingMode();
			if (mode === 'auto-safe') {
				await runSerializedCapture(message.capture, mode);
			} else {
				await processCapture(message.capture, mode);
			}
			return;
		} catch (error) {
			status = createErrorStatus(error, now);
		}
	} else {
		status = createErrorStatus(undefined, now);
	}
	await persistStatus(status);
}

async function runSerializedCapture(
	capture: Parameters<typeof stageMyBkCapture>[1],
	mode: TrackingMode
): Promise<void> {
	if (activeTrackingRun) await activeTrackingRun;
	const run = processCapture(capture, mode);
	activeTrackingRun = run;
	try {
		await run;
	} finally {
		if (activeTrackingRun === run) activeTrackingRun = undefined;
	}
}

function safeMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'BKalendar gặp lỗi không xác định.';
}

async function hasGoogleConnection(): Promise<boolean> {
	try {
		await requestGoogleToken(chrome.identity, false, GOOGLE_WEB_CLIENT_ID);
		return true;
	} catch {
		return false;
	}
}

async function persistDiffLog(log: ReturnType<typeof createDiffLog>): Promise<void> {
	await chrome.storage.local.set({ [LAST_DIFF_STORAGE_KEY]: log });
}

async function openDiffDetails(notificationId: string): Promise<void> {
	await chrome.notifications.clear(notificationId);
	try {
		await chrome.action.openPopup();
	} catch {
		await chrome.tabs.create({
			url: chrome.runtime.getURL('src/popup/index.html?view=diff')
		});
	}
}

/*
 * Content messages still support immediate capture when the user happens to have
 * MyBK open. Background tracking uses the same staging path above.
 */

async function initializeStatus(): Promise<void> {
	const stored = await chrome.storage.local.get(EXTENSION_STATUS_KEY);
	if (stored[EXTENSION_STATUS_KEY] !== undefined) return;
	await persistStatus({ state: 'idle' });
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
