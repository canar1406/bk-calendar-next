import {
	createCaptureStatus,
	createErrorStatus,
	EXTENSION_STATUS_KEY,
	type ExtensionStatus
} from './status.ts';
import { stageMyBkCapture } from './capture-workflow.ts';
import {
	createProfileStore,
	type ProfileStore,
	type SyncProfile
} from '../../../../packages/timetable/src/storage.ts';
import { isContentMessage, isPopupMessage, type PopupMessage } from '../shared/messages.ts';
import { createChromeStorage } from '../storage/chrome.ts';
import { createChromeCredentialVault } from '../auth/chrome-vault.ts';
import type { MyBkCredentials } from '../auth/credential-vault.ts';
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
	GoogleCalendarApiError,
	createManagedCalendar,
	findLegacyCalendars,
	findManagedCalendars,
	isGoogleCalendarAuthError,
	syncManagedPresentation
} from '../../../../packages/google-calendar/src/index.ts';
import { syncPendingProfile } from '../../../../packages/google-calendar/src/profile-sync.ts';
import {
	GOOGLE_WEB_CLIENT_ID,
	disconnectGoogle,
	requestGoogleToken,
	runWithGoogleTokenRetry
} from './google-auth.ts';
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
import {
	courseColorStorageKey,
	isCourseColorPreferences
} from '../../../../packages/google-calendar/src/course-appearance.ts';
import { prepareEventsWithCourseAppearance } from '../shared/course-appearance.ts';
import {
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
import { ensureWebBridgeConnection, WEB_APP_URL_PATTERN } from './web-bridge-presence.ts';
import {
	SELECTED_SOURCE_KIND_KEY,
	normalizeSelectedSourceKind,
	sourceOptionFor
} from '../shared/source-kind.ts';
import {
	syncPresentationWithCalendarRecovery,
	throwIfCalendarMissing
} from './presentation-recovery.ts';
import { createFetchMyBkHttpClient, fetchMyBkTimetable } from './mybk-client.ts';

const TRACKING_ALARM = 'bkalendar-next:track-mybk';
const TRACKING_MODE_KEY = 'bkalendar-next:tracking-mode';
const POLLING_INTERVAL_KEY = 'bkalendar-next:polling-interval-minutes';
const THEME_STORAGE_KEY = 'bkalendar-next:theme';
const THEME_RESOLVED_STORAGE_KEY = 'bkalendar-next:theme-resolved';
const COURSE_APPEARANCE_STORAGE_PREFIX = 'bkalendar-next:course-colors:';
const DEFAULT_TRACKING_MODE: TrackingMode = 'review';
let activeTrackingRun: Promise<void> | undefined;
const appearanceSyncRuns = new Map<string, Promise<void>>();
const appearanceWritesInFlight = new Set<string>();
const recentAppearanceSyncs = new Map<string, { fingerprint: string; completedAt: number }>();
const hiddenCaptureRegistry = createHiddenCaptureRegistry();
let offscreenCaptureWaiter:
	| { resolve(capture: Parameters<typeof stageMyBkCapture>[1]): void; reject(error: unknown): void }
	| undefined;
let offscreenCredentials: MyBkCredentials | undefined;
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
	for (const key of Object.keys(changes).filter(isCourseAppearanceStorageKey)) {
		const profileId = key.slice(COURSE_APPEARANCE_STORAGE_PREFIX.length);
		if (appearanceWritesInFlight.delete(profileId)) continue;
		void queueCourseAppearanceSync(profileId);
	}
});

void hardenLocalStorage();

async function initializeExtension(): Promise<void> {
	await hardenLocalStorage();
	await initializeStatus();
	await scheduleTrackingAlarm();
	await ensureWebBridgeConnectionInOpenTabs();
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
			appearanceWritesInFlight.add(profileId);
			try {
				await chrome.storage.local.set({
					[courseColorStorageKey(profileId)]: preferences
				});
				await queueCourseAppearanceSync(profileId);
			} finally {
				setTimeout(() => appearanceWritesInFlight.delete(profileId), 1_000);
			}
		},
		async saveTheme(preference, resolvedTheme) {
			await chrome.storage.local.set({
				[THEME_STORAGE_KEY]: preference,
				[THEME_RESOLVED_STORAGE_KEY]: resolvedTheme
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
		changes[THEME_STORAGE_KEY] !== undefined ||
		Object.keys(changes).some((key) => key.startsWith('bkalendar-next:course-colors:'))
	);
}

function isCourseAppearanceStorageKey(key: string): boolean {
	return key.startsWith(COURSE_APPEARANCE_STORAGE_PREFIX);
}

function queueCourseAppearanceSync(profileId: string): Promise<void> {
	const existing = appearanceSyncRuns.get(profileId);
	if (existing) return existing;
	const run = syncCourseAppearanceToGoogle(profileId).finally(() => {
		if (appearanceSyncRuns.get(profileId) === run) appearanceSyncRuns.delete(profileId);
	});
	appearanceSyncRuns.set(profileId, run);
	return run;
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

async function syncCourseAppearanceToGoogle(profileId: string): Promise<void> {
	if ((await readTrackingMode()) !== 'auto-safe') return;
	const store = createProfileStore(createChromeStorage(chrome.storage.local));
	const profile = await store.get(profileId);
	const snapshot = profile?.acceptedSnapshot;
	const calendarId = profile?.calendarId;
	if (!profile || !snapshot || !calendarId) return;
	const appearance = await chrome.storage.local.get(courseColorStorageKey(profileId));
	const preferences = appearance[courseColorStorageKey(profileId)];
	if (!isCourseColorPreferences(preferences)) return;
	const fingerprint = JSON.stringify(preferences);
	const recent = recentAppearanceSyncs.get(profileId);
	if (recent && recent.fingerprint === fingerprint && Date.now() - recent.completedAt < 1_500) {
		return;
	}

	try {
		const result = await runWithGoogleTokenRetry(
			chrome.identity,
			GOOGLE_WEB_CLIENT_ID,
			googleTokenStore,
			async (accessToken) => {
				const gateway = new GoogleCalendarRestGateway(accessToken);
				const recovered = await syncPresentationWithCalendarRecovery({
					calendarId,
					sync: async (activeCalendarId) =>
						await syncManagedPresentation(
							gateway,
							activeCalendarId,
							prepareEventsWithCourseAppearance(snapshot.events, preferences)
						),
					recover: async () => await recoverCalendarForProfile(store, profile, accessToken)
				});
				const attempt = recovered.result;
				throwIfCalendarMissing(attempt.failed);
				const authFailure = attempt.failed.find((failure) =>
					isGoogleCalendarAuthError(new Error(failure.message))
				);
				if (authFailure) throw new Error(authFailure.message);
				if (attempt.failed.length > 0) {
					throw new Error('Google Calendar chưa áp dụng đầy đủ màu và icon môn học.');
				}
				return attempt;
			},
			isGoogleCalendarAuthError
		);
		recentAppearanceSyncs.set(profileId, { fingerprint, completedAt: Date.now() });
		if (result.patched === 0) return;

		const now = new Date().toISOString();
		const storedStatus = await chrome.storage.local.get(EXTENSION_STATUS_KEY);
		const status = storedStatus[EXTENSION_STATUS_KEY] as ExtensionStatus | undefined;
		if (status?.state === 'captured') {
			await persistStatus({
				...status,
				capturedAt: now,
				changes: {
					added: 0,
					changed: result.patched,
					removed: 0,
					unchanged: result.unchanged,
					canDelete: true
				},
				syncState: 'applied'
			});
		}
		await chrome.notifications.create(`${TRACKING_NOTIFICATION_ID}:appearance`, {
			type: 'basic',
			iconUrl: 'icons/icon-128.png',
			title: 'BKalendar đã cập nhật màu và icon',
			message: `${result.patched} sự kiện đã được cập nhật. Nhấn để xem chi tiết.`
		});
	} catch (error) {
		if (error instanceof GoogleCalendarApiError && error.status === 404) {
			await notifyTrackingError(
				'Calendar BKalendar cũ không còn tồn tại',
				'BKalendar đã thử tìm lại calendar của tài khoản Google hiện tại nhưng chưa thể cập nhật. Hãy chạy kiểm tra TKB để tạo lại sự kiện.'
			);
		} else {
			await notifyTrackingError(
				'BKalendar chưa cập nhật được màu và icon',
				'Thiết lập đã lưu cục bộ nhưng Google Calendar chưa được patch. Hãy kiểm tra kết nối Google rồi thử lại.'
			);
		}
		if (error instanceof Error) {
			const storedStatus = await chrome.storage.local.get(EXTENSION_STATUS_KEY);
			const status = storedStatus[EXTENSION_STATUS_KEY] as ExtensionStatus | undefined;
			if (status?.state === 'captured') {
				await persistStatus({
					state: 'error',
					checkedAt: new Date().toISOString(),
					message: error.message
				});
			}
		}
	}
}

async function recoverCalendarForProfile(
	store: ProfileStore,
	profile: SyncProfile,
	accessToken: string
): Promise<string> {
	const managed = (await findManagedCalendars(fetch, accessToken, profile.calendarName))[0];
	if (managed?.id) {
		await store.save({ ...profile, calendarId: managed.id, calendarOrigin: 'managed' });
		return managed.id;
	}
	const legacy = (
		await findLegacyCalendars(fetch, accessToken, profile.sourceKind, profile.semester)
	)[0];
	if (legacy?.id) {
		await store.save({ ...profile, calendarId: legacy.id, calendarOrigin: 'legacy' });
		return legacy.id;
	}
	const created = await createManagedCalendar(fetch, accessToken, profile.calendarName);
	await store.save({ ...profile, calendarId: created.id, calendarOrigin: 'managed' });
	return created.id;
}

async function hasWebBridgeConnection(): Promise<boolean> {
	return await ensureWebBridgeConnection({
		queryTabs: async (properties) => await chrome.tabs.query(properties),
		sendMessage: async (tabId, message) => await chrome.tabs.sendMessage(tabId, message),
		inject: async (tabId) => {
			await chrome.scripting.executeScript({
				target: { tabId },
				files: ['web-review.js']
			});
		}
	});
}

async function ensureWebBridgeConnectionInOpenTabs(): Promise<void> {
	await hasWebBridgeConnection().catch(() => false);
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
	const sourceKind = await readSelectedSourceKind();
	try {
		const source = sourceOptionFor(sourceKind);
		const capture =
			sourceKind === 'student-2024'
				? await captureStudent2024Offscreen(source.url, credentials)
				: await captureInHiddenTab({
						api: {
							createTab: (properties) => chrome.tabs.create(properties),
							createWindow: (properties) => chrome.windows.create(properties),
							updateWindow: (windowId, properties) => chrome.windows.update(windowId, properties),
							update: (tabId, properties) => chrome.tabs.update(tabId, properties),
							remove: (tabId) => chrome.tabs.remove(tabId),
							removeWindow: (windowId) => chrome.windows.remove(windowId),
							onUpdated: chrome.tabs.onUpdated
						},
						url: source.url,
						sourceKind,
						credentials,
						waitForCapture: (tabId) => hiddenCaptureRegistry.wait(tabId, 30_000),
						registerSessionExpired: (tabId, handler) =>
							hiddenCaptureRegistry.registerSessionExpired(tabId, handler),
						cancelCapture: (tabId, error) => hiddenCaptureRegistry.reject(tabId, error),
						submitCredentials: (tabId, savedCredentials) =>
							submitCasCredentials(chrome.scripting, tabId, savedCredentials)
					});
		await processCapture(capture, mode);
	} catch (error) {
		const now = new Date().toISOString();
		await persistStatus(createErrorStatus(error, now, sourceKind));
		await notifyTrackingError('BKalendar chưa thể cập nhật', safeMessage(error));
		if (force) throw error;
	}
}

async function captureStudent2024Offscreen(
	url: string,
	credentials: MyBkCredentials
): Promise<Parameters<typeof stageMyBkCapture>[1]> {
	await ensureOffscreenDocument();
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		offscreenCredentials = credentials;
		const capture = await new Promise<Parameters<typeof stageMyBkCapture>[1]>((resolve, reject) => {
			offscreenCaptureWaiter = { resolve, reject };
			void chrome.runtime
				.sendMessage({ type: 'bkalendar:offscreen:navigate', url })
				.then((response) => {
					if (!response?.ok) reject(new Error(response?.message ?? 'Không tạo được vùng đọc MyBK ẩn.'));
				})
				.catch(reject);
			timeout = setTimeout(() => {
				if (offscreenCaptureWaiter?.reject === reject) {
					offscreenCaptureWaiter = undefined;
					reject(
						new Error(
							'Vùng đọc nền không nhận được bảng TKB sau 15 giây. Hãy mở lại MyBK một lần rồi thử lại.'
						)
					);
				}
			}, 15_000);
		});
		return capture;
	} finally {
		if (timeout) clearTimeout(timeout);
		offscreenCaptureWaiter = undefined;
		offscreenCredentials = undefined;
		await chrome.offscreen.closeDocument().catch(() => {});
	}
}

async function ensureOffscreenDocument(): Promise<void> {
	const hasDocument = await chrome.offscreen.hasDocument?.();
	if (hasDocument) return;
	await chrome.offscreen.createDocument({
		url: 'src/offscreen/index.html',
		reasons: ['DOM_SCRAPING'],
		justification: 'Đọc bảng thời khóa biểu MyBK trong vùng nền không hiển thị.'
	});
}

async function fetchStudent2024WithFallback(
	url: string,
	credentials: MyBkCredentials
): Promise<Parameters<typeof stageMyBkCapture>[1]> {
	try {
		return await fetchMyBkTimetable(createFetchMyBkHttpClient(), credentials);
	} catch (fetchError) {
		// Some MyBK deployments return only the authenticated app shell to a
		// service-worker fetch and render the timetable after browser-side
		// navigation. Retry through the inactive-tab DOM path before reporting
		// the fetch error to the user.
		try {
			return await captureInHiddenTab({
				api: {
					createTab: (properties) => chrome.tabs.create(properties),
					createWindow: (properties) => chrome.windows.create(properties),
					updateWindow: (windowId, properties) => chrome.windows.update(windowId, properties),
					update: (tabId, properties) => chrome.tabs.update(tabId, properties),
					remove: (tabId) => chrome.tabs.remove(tabId),
					removeWindow: (windowId) => chrome.windows.remove(windowId),
					onUpdated: chrome.tabs.onUpdated
				},
				url,
				sourceKind: 'student-2024',
				credentials,
				waitForCapture: (tabId) => hiddenCaptureRegistry.wait(tabId, 30_000),
				registerSessionExpired: (tabId, handler) =>
					hiddenCaptureRegistry.registerSessionExpired(tabId, handler),
				cancelCapture: (tabId, error) => hiddenCaptureRegistry.reject(tabId, error),
				submitCredentials: (tabId, savedCredentials) =>
					submitCasCredentials(chrome.scripting, tabId, savedCredentials)
			});
		} catch (tabError) {
			throw new Error(
				'MyBK chưa trả về được bảng thời khóa biểu. Hãy mở MyBK một lần, kiểm tra đúng tài khoản, rồi thử lại.',
				{ cause: tabError instanceof Error ? tabError : fetchError }
			);
		}
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

	const appearanceKey = courseColorStorageKey(staged.profileId);
	const storedAppearance = await chrome.storage.local.get(appearanceKey);
	const synced = await runWithGoogleTokenRetry(
		chrome.identity,
		GOOGLE_WEB_CLIENT_ID,
		googleTokenStore,
		async (accessToken) => {
			const attempt = await syncPendingProfile(store, staged.profileId, {
				gateway: new GoogleCalendarRestGateway(accessToken),
				findCalendars: async (summary) => await findManagedCalendars(fetch, accessToken, summary),
				findLegacyCalendars: async (sourceKind, semester) =>
					await findLegacyCalendars(fetch, accessToken, sourceKind, semester),
				createCalendar: async (summary) => await createManagedCalendar(fetch, accessToken, summary),
				prepareEvents: (events) =>
					prepareEventsWithCourseAppearance(events, storedAppearance[appearanceKey])
			});
			const authFailure = attempt.result.failed.find((failure) =>
				isGoogleCalendarAuthError(new Error(failure.message))
			);
			if (authFailure) throw new Error(authFailure.message);
			return attempt;
		},
		isGoogleCalendarAuthError
	);
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

async function readSelectedSourceKind() {
	const stored = await chrome.storage.local.get(SELECTED_SOURCE_KIND_KEY);
	return normalizeSelectedSourceKind(stored[SELECTED_SOURCE_KIND_KEY]);
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
		try {
			if (typeof tabId !== 'number' && offscreenCaptureWaiter) {
				offscreenCaptureWaiter.resolve(message.capture);
				offscreenCaptureWaiter = undefined;
				return;
			}
			const selectedSourceKind = await readSelectedSourceKind();
			if (
				message.capture.sourceKind !== undefined &&
				message.capture.sourceKind !== selectedSourceKind
			) {
				const mismatch = new Error('Bảng thời khóa biểu không khớp với loại lịch đang theo dõi.');
				if (typeof tabId === 'number' && hiddenCaptureRegistry.reject(tabId, mismatch)) {
					return;
				}
				throw new Error('Bảng thời khóa biểu không khớp với loại lịch đang theo dõi.');
			}
			if (typeof tabId === 'number' && hiddenCaptureRegistry.resolve(tabId, message.capture)) {
				return;
			}
			const mode = await readTrackingMode();
			if (mode === 'auto-safe') {
				await runSerializedCapture(message.capture, mode);
			} else {
				await processCapture(message.capture, mode);
			}
			return;
		} catch (error) {
			status = createErrorStatus(error, now, await readSelectedSourceKind());
		}
	} else {
		if (
			message.type === 'bkalendar:session-expired' &&
			typeof tabId === 'number' &&
			hiddenCaptureRegistry.signalSessionExpired(tabId, message.reason)
		) {
			return;
		}
		if (message.type === 'bkalendar:session-expired') {
			if (offscreenCaptureWaiter && offscreenCredentials) {
				await chrome.runtime.sendMessage({
					type: 'bkalendar:offscreen:submit-credentials',
					username: offscreenCredentials.username,
					password: offscreenCredentials.password
				});
				return;
			}
			const sourceKind = await readSelectedSourceKind();
			if ((await readTrackingMode()) !== 'off') {
				await runBackgroundTracking();
				return;
			}
			status = createErrorStatus(
				new Error(
					'Phiên MyBK đã hết hạn. Hãy bật theo dõi nền để extension đăng nhập lại tự động.'
				),
				now,
				sourceKind
			);
			await persistStatus(status);
			return;
		}
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
