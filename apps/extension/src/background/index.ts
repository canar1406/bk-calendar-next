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
import {
	decideTrackingAction,
	isTrackingMode,
	requiresGoogleConnection,
	shouldRunAutomaticSync,
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
	createGoogleTokenStore,
	createMemoryTokenStorageArea,
	selectTokenStorageArea
} from './google-token-store.ts';
import {
	TRACKING_NOTIFICATION_ID,
	buildTrackingNotification,
	isTrackingNotification,
	type TrackingNotificationKind
} from './tracking-notification.ts';
import { LAST_DIFF_STORAGE_KEY, createDiffLog } from '../shared/diff-log.ts';
import { courseColorStorageKey } from '../../../../packages/google-calendar/src/course-appearance.ts';
import { prepareEventsWithCourseAppearance } from '../shared/course-appearance.ts';
import {
	MYBK_TIMETABLE_URL,
	captureInHiddenTab,
	createHiddenCaptureRegistry,
	submitCasCredentials
} from './hidden-tab-capture.ts';
import {
	DEFAULT_POLLING_INTERVAL_MINUTES,
	normalizePollingIntervalMinutes,
	type PollingIntervalMinutes
} from './polling.ts';
import { createLocalExtensionState, PROFILE_STORAGE_KEY } from '../bridge/web-review.ts';
import { handleWebBridgeRuntimeRequest } from './web-bridge-runtime.ts';
import {
	isWebBridgeRuntimeRequest,
	type WebBridgeStatePush
} from '../shared/web-bridge-runtime.ts';
import { detectWebBridgeConnection, WEB_APP_URL_PATTERN } from './web-bridge-presence.ts';

const TRACKING_ALARM = 'bkalendar-next:track-mybk';
const TRACKING_MODE_KEY = 'bkalendar-next:tracking-mode';
const POLLING_INTERVAL_KEY = 'bkalendar-next:polling-interval-minutes';
const DEFAULT_TRACKING_MODE: TrackingMode = 'review';
let activeTrackingRun: Promise<void> | undefined;
const hiddenCaptureRegistry = createHiddenCaptureRegistry();
const googleTokenStore = createGoogleTokenStore(
	selectTokenStorageArea(chrome.storage.session, createMemoryTokenStorageArea())
);

chrome.runtime.onInstalled.addListener(() => {
	void initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
	void handleStartup();
});
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
	if (sender.id !== chrome.runtime.id) return false;

	if (isWebBridgeRuntimeRequest(message)) {
		void handleWebBridgeRuntimeMessage(message, sender.tab?.url ?? sender.url)
			.then((value) => sendResponse({ ok: true, value }))
			.catch((error) => sendResponse({ ok: false, message: safeMessage(error) }));
		return true;
	}
	if (isContentMessage(message)) {
		void handleContentMessage(message, sender.tab?.id)
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

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local') return;
	if (hasWebStateChange(changes)) void broadcastWebState();
	if (hasAppearanceChange(changes)) void runAutomaticPresentationCheck();
});

void hardenLocalStorage();

async function initializeExtension(): Promise<void> {
	await hardenLocalStorage();
	await initializeStatus();
	await scheduleTrackingAlarm();
}

async function handleStartup(): Promise<void> {
	await googleTokenStore.remove();
	await initializeExtension();
	await runBackgroundTracking();
}

async function scheduleTrackingAlarm(): Promise<void> {
	await chrome.alarms.create(TRACKING_ALARM, {
		periodInMinutes: await readPollingInterval()
	});
}

async function hardenLocalStorage(): Promise<void> {
	await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

async function handleWebBridgeRuntimeMessage(
	message: unknown,
	senderUrl: string | undefined
): Promise<unknown> {
	const result = await handleWebBridgeRuntimeRequest(message, senderUrl, {
		async readProfiles() {
			const stored = await chrome.storage.local.get(PROFILE_STORAGE_KEY);
			return stored[PROFILE_STORAGE_KEY];
		},
		async readState() {
			return await readLocalExtensionState();
		},
		async saveProfile(profile) {
			const store = createProfileStore(createChromeStorage(chrome.storage.local));
			await store.save(profile);
		},
		async saveAppearance(profileId, preferences) {
			await chrome.storage.local.set({
				[courseColorStorageKey(profileId)]: preferences
			});
		}
	});
	if (!result.handled) throw new Error('Web BKalendar không được phép truy cập bridge.');
	return result.value;
}

async function readLocalExtensionState() {
	const stored = await chrome.storage.local.get(null);
	return createLocalExtensionState(
		stored[PROFILE_STORAGE_KEY],
		stored[EXTENSION_STATUS_KEY],
		undefined,
		stored
	);
}

function hasWebStateChange(changes: Record<string, chrome.storage.StorageChange>): boolean {
	return (
		changes[PROFILE_STORAGE_KEY] !== undefined ||
		changes[EXTENSION_STATUS_KEY] !== undefined ||
		Object.keys(changes).some((key) => key.startsWith('bkalendar-next:course-colors:'))
	);
}

function hasAppearanceChange(changes: Record<string, chrome.storage.StorageChange>): boolean {
	return Object.keys(changes).some((key) => key.startsWith('bkalendar-next:course-colors:'));
}

async function runAutomaticPresentationCheck(): Promise<void> {
	if ((await readTrackingMode()) !== 'auto-safe') return;
	await runBackgroundTracking();
}

async function broadcastWebState(): Promise<void> {
	const state = await readLocalExtensionState();
	const message: WebBridgeStatePush = {
		type: 'bkalendar:web-bridge:state:push',
		state
	};
	const tabs = await chrome.tabs.query({
		url: WEB_APP_URL_PATTERN
	});
	await Promise.all(
		tabs.map(async (tab) => {
			if (typeof tab.id !== 'number') return;
			await chrome.tabs.sendMessage(tab.id, message).catch(() => {});
		})
	);
}

async function hasWebBridgeConnection(): Promise<boolean> {
	return await detectWebBridgeConnection({
		queryTabs: async (properties) => await chrome.tabs.query(properties),
		sendMessage: async (tabId, message) => await chrome.tabs.sendMessage(tabId, message)
	});
}

async function handlePopupMessage(message: PopupMessage): Promise<{
	configured?: boolean;
	trackingMode?: TrackingMode;
	googleConnected?: boolean;
	pollingIntervalMinutes?: PollingIntervalMinutes;
	webConnected?: boolean;
}> {
	const vault = createChromeCredentialVault();
	if (message.type === 'bkalendar:web-bridge:status:get') {
		return { webConnected: await hasWebBridgeConnection() };
	}
	if (message.type === 'bkalendar:settings:get') {
		return {
			configured: await vault.hasCredentials(),
			trackingMode: await readTrackingMode(),
			googleConnected: await hasGoogleConnection(),
			pollingIntervalMinutes: await readPollingInterval(),
			webConnected: await hasWebBridgeConnection()
		};
	}
	if (message.type === 'bkalendar:google:connect') {
		await requestGoogleToken(chrome.identity, true, GOOGLE_WEB_CLIENT_ID, googleTokenStore);
		return {
			configured: await vault.hasCredentials(),
			trackingMode: await readTrackingMode(),
			googleConnected: true,
			pollingIntervalMinutes: await readPollingInterval()
		};
	}
	if (message.type === 'bkalendar:google:disconnect') {
		await disconnectGoogle(chrome.identity, googleTokenStore);
		return {
			configured: await vault.hasCredentials(),
			trackingMode: await readTrackingMode(),
			googleConnected: false,
			pollingIntervalMinutes: await readPollingInterval()
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
			googleConnected: await hasGoogleConnection(),
			pollingIntervalMinutes: await readPollingInterval()
		};
	}
	if (message.type === 'bkalendar:credentials:remove') {
		await vault.remove();
		await saveTrackingMode('off');
		return {
			configured: false,
			trackingMode: 'off',
			googleConnected: await hasGoogleConnection(),
			pollingIntervalMinutes: await readPollingInterval()
		};
	}
	if (message.type === 'bkalendar:polling:set-interval') {
		await chrome.storage.local.set({
			[POLLING_INTERVAL_KEY]: message.intervalMinutes
		});
		await scheduleTrackingAlarm();
		return {
			configured: await vault.hasCredentials(),
			trackingMode: await readTrackingMode(),
			googleConnected: await hasGoogleConnection(),
			pollingIntervalMinutes: message.intervalMinutes
		};
	}
	if (message.type === 'bkalendar:tracking:set-mode') {
		if (message.trackingMode !== 'off' && !(await vault.hasCredentials())) {
			throw new Error('Hãy lưu tài khoản MyBK trước khi bật theo dõi nền.');
		}
		if (requiresGoogleConnection(message.trackingMode)) {
			try {
				await requestGoogleToken(chrome.identity, true, GOOGLE_WEB_CLIENT_ID, googleTokenStore);
			} catch {
				throw new Error(
					'Chế độ tự động cần Google Calendar. Hãy bấm “Kết nối” và cấp quyền trước khi bật.'
				);
			}
		}
		await saveTrackingMode(message.trackingMode);
		if (message.trackingMode !== 'off') await runBackgroundTracking();
		return {
			configured: await vault.hasCredentials(),
			trackingMode: message.trackingMode,
			googleConnected: await hasGoogleConnection(),
			pollingIntervalMinutes: await readPollingInterval()
		};
	}
	await runBackgroundTracking(true);
	return {
		configured: await vault.hasCredentials(),
		trackingMode: await readTrackingMode(),
		googleConnected: await hasGoogleConnection(),
		pollingIntervalMinutes: await readPollingInterval()
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
		const capture = await captureInHiddenTab({
			api: {
				createWindow: (properties) => chrome.windows.create(properties),
				updateWindow: (windowId, properties) => chrome.windows.update(windowId, properties),
				update: (tabId, properties) => chrome.tabs.update(tabId, properties),
				remove: (tabId) => chrome.tabs.remove(tabId),
				removeWindow: (windowId) => chrome.windows.remove(windowId),
				onUpdated: chrome.tabs.onUpdated
			},
			url: MYBK_TIMETABLE_URL,
			credentials,
			waitForCapture: (tabId) => hiddenCaptureRegistry.wait(tabId, 30_000),
			cancelCapture: (tabId, error) => hiddenCaptureRegistry.reject(tabId, error),
			submitCredentials: (tabId, savedCredentials) =>
				submitCasCredentials(chrome.scripting, tabId, savedCredentials)
		});
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
	const shouldAutomaticallySync = shouldRunAutomaticSync(mode);
	if (!action.shouldNotify && !shouldAutomaticallySync) return;

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

	if (!action.shouldApplyUpserts && !action.shouldApplyRemovals && !shouldAutomaticallySync) {
		await persistDiffLog(
			createDiffLog(staged.profileId, 'review', staged.diff, new Date().toISOString())
		);
		await persistStatus(createCaptureStatus(capture, new Date().toISOString(), changes, 'review'));
		await notifyChanges('review', changes, staged.profile.semester);
		return;
	}

	const accessToken = await requestGoogleToken(
		chrome.identity,
		false,
		GOOGLE_WEB_CLIENT_ID,
		googleTokenStore
	);
	const appearanceKey = courseColorStorageKey(staged.profileId);
	const storedAppearance = await chrome.storage.local.get(appearanceKey);
	const synced = await syncPendingProfile(store, staged.profileId, {
		gateway: new GoogleCalendarRestGateway(accessToken),
		findCalendars: async (summary) => await findManagedCalendars(fetch, accessToken, summary),
		createCalendar: async (summary) => await createManagedCalendar(fetch, accessToken, summary),
		prepareEvents: (events) =>
			prepareEventsWithCourseAppearance(events, storedAppearance[appearanceKey])
	});
	if (synced.result.failed.length > 0 || !synced.promoted) {
		throw new Error('Google Calendar chưa áp dụng đầy đủ thay đổi.');
	}
	await persistDiffLog(
		createDiffLog(staged.profileId, 'applied', synced.diff, new Date().toISOString())
	);
	await persistStatus(
		createCaptureStatus(
			capture,
			new Date().toISOString(),
			{
				added: synced.result.inserted,
				changed: synced.result.patched,
				removed: synced.result.deleted,
				unchanged: synced.result.unchanged,
				canDelete: changes.canDelete
			},
			'applied'
		)
	);
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

async function readPollingInterval(): Promise<PollingIntervalMinutes> {
	const stored = await chrome.storage.local.get(POLLING_INTERVAL_KEY);
	return normalizePollingIntervalMinutes(
		stored[POLLING_INTERVAL_KEY] ?? DEFAULT_POLLING_INTERVAL_MINUTES
	);
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

async function handleContentMessage(
	message: ReturnType<typeof asContentMessage>,
	tabId?: number
): Promise<void> {
	const now = new Date().toISOString();
	let status: ExtensionStatus;
	if (message.type === 'bkalendar:capture') {
		if (typeof tabId === 'number' && hiddenCaptureRegistry.resolve(tabId, message.capture)) return;
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
		if (
			typeof tabId === 'number' &&
			hiddenCaptureRegistry.reject(
				tabId,
				new Error(
					message.reason
						? `Không đọc được bảng TKB trên trang MyBK: ${message.reason}`
						: 'Không đọc được bảng TKB trên trang MyBK.'
				)
			)
		) {
			return;
		}
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
		await requestGoogleToken(chrome.identity, false, GOOGLE_WEB_CLIENT_ID, googleTokenStore);
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
