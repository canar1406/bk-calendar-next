import './style.css';
import { EXTENSION_STATUS_KEY, type ExtensionStatus } from '../background/status.ts';
import {
	buildStoredDiffDetails,
	buildPopupViewModel,
	selectCurrentProfile,
	summarizeStoredProfiles,
	WEB_REVIEW_URL
} from './view-model.ts';
import type { TrackingMode } from '../background/tracking-policy.ts';
import type { PollingIntervalMinutes } from '../background/polling.ts';
import { LAST_DIFF_STORAGE_KEY } from '../shared/diff-log.ts';
import { createPopupThemeController } from './theme.ts';
import {
	courseColorStorageKey,
	isCourseColorPreferences,
	summarizeCourseAppearances,
	type CourseAppearanceSummary
} from '../../../../packages/google-calendar/src/course-appearance.ts';
import type { ManagedEvent } from '../../../../packages/timetable/src/index.ts';

const statusTitle = requireElement<HTMLParagraphElement>('status-title');
const statusDetail = requireElement<HTMLParagraphElement>('status-detail');
const statusDot = requireElement<HTMLSpanElement>('status-dot');
const profileLabel = requireElement<HTMLParagraphElement>('profile-label');
const capturedLabel = requireElement<HTMLParagraphElement>('captured-label');
const addedCount = requireElement<HTMLElement>('added-count');
const changedCount = requireElement<HTMLElement>('changed-count');
const removedCount = requireElement<HTMLElement>('removed-count');
const removedCard = requireElement<HTMLElement>('removed-card');
const warning = requireElement<HTMLElement>('deletion-warning');
const warningText = requireElement<HTMLParagraphElement>('deletion-warning-text');
const diffDetails = requireElement<HTMLElement>('diff-details');
const diffList = requireElement<HTMLUListElement>('diff-list');
const primaryAction = requireElement<HTMLButtonElement>('primary-action');
const credentialForm = requireElement<HTMLFormElement>('credential-form');
const usernameInput = requireElement<HTMLInputElement>('mybk-username');
const passwordInput = requireElement<HTMLInputElement>('mybk-password');
const consentInput = requireElement<HTMLInputElement>('credential-consent');
const trackingMode = requireElement<HTMLSelectElement>('tracking-mode');
const pollingInterval = requireElement<HTMLSelectElement>('polling-interval');
const credentialState = requireElement<HTMLElement>('credential-state');
const credentialMessage = requireElement<HTMLParagraphElement>('credential-message');
const removeCredentials = requireElement<HTMLButtonElement>('remove-credentials');
const googleState = requireElement<HTMLElement>('google-state');
const connectGoogle = requireElement<HTMLButtonElement>('connect-google');
const disconnectGoogle = requireElement<HTMLButtonElement>('disconnect-google');
const webBridgeState = requireElement<HTMLElement>('web-bridge-state');
const openWeb = requireElement<HTMLButtonElement>('open-web');
const webSyncCourses = requireElement<HTMLElement>('web-sync-courses');
const themePreference = requireElement<HTMLSelectElement>('theme-preference');
const settingsDisclosure = requireElement<HTMLDetailsElement>('settings-disclosure');
const PROFILE_STORAGE_KEY = 'bkalendar-next:profiles';
const themeController = createPopupThemeController(
	document.documentElement,
	themePreference,
	chrome.storage.local
);
let primaryActionKind:
	'background-check' | 'open-web-review' | 'show-diff' | 'open-settings' | 'connect-google' =
	'background-check';
let primaryActionUrl = '';
let credentialsConfigured = false;
let settingsLoaded = false;
let currentTrackingMode: TrackingMode = 'off';
let googleConnected = false;

void initializePopup();
const webBridgeTimer = window.setInterval(() => {
	void refreshWebBridgeConnection();
}, 2_000);

window.addEventListener(
	'pagehide',
	() => {
		window.clearInterval(webBridgeTimer);
	},
	{ once: true }
);

async function initializePopup(): Promise<void> {
	await renderSettings();
	await renderStoredState();
	await themeController.initialize();
}

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local') return;
	if (
		changes[EXTENSION_STATUS_KEY] ||
		changes[PROFILE_STORAGE_KEY] ||
		Object.keys(changes).some((key) => key.startsWith('bkalendar-next:course-colors:'))
	) {
		void renderStoredState();
	}
});

credentialForm.addEventListener('submit', (event) => {
	event.preventDefault();
	void saveCredentials();
});

trackingMode.addEventListener('change', () => {
	void setTrackingMode(trackingMode.value as TrackingMode);
});

pollingInterval.addEventListener('change', () => {
	void setPollingInterval(Number(pollingInterval.value) as PollingIntervalMinutes);
});

removeCredentials.addEventListener('click', () => {
	void removeStoredCredentials();
});

connectGoogle.addEventListener('click', () => {
	void changeGoogleConnection(true);
});

disconnectGoogle.addEventListener('click', () => {
	void changeGoogleConnection(false);
});

openWeb.addEventListener('click', () => {
	void chrome.tabs.create({ url: WEB_REVIEW_URL });
});

themePreference.addEventListener('change', () => {
	void themeController.update(
		themePreference.value as Parameters<typeof themeController.update>[0]
	);
});

primaryAction.addEventListener('click', () => {
	void handlePrimaryAction();
});

async function renderStoredState(): Promise<void> {
	const stored = await chrome.storage.local.get(null);
	const status = stored[EXTENSION_STATUS_KEY] as ExtensionStatus | undefined;
	const profiles = summarizeStoredProfiles(stored[PROFILE_STORAGE_KEY]);
	const currentProfile = selectCurrentProfile(profiles);
	const details = buildStoredDiffDetails(
		stored[PROFILE_STORAGE_KEY],
		stored[LAST_DIFF_STORAGE_KEY]
	);
	const courseAppearances = currentProfile
		? readCourseAppearances(
				stored[PROFILE_STORAGE_KEY],
				currentProfile.profileId,
				stored[courseColorStorageKey(currentProfile.profileId)]
			)
		: [];
	const viewModel = buildPopupViewModel(
		status ?? { state: 'idle' },
		currentProfile,
		settingsLoaded ? credentialsConfigured : undefined,
		settingsLoaded ? currentTrackingMode : undefined,
		settingsLoaded ? googleConnected : undefined
	);

	statusDot.dataset.state = viewModel.tone;
	statusTitle.textContent = viewModel.title;
	statusDetail.textContent = viewModel.detail;
	profileLabel.textContent = viewModel.profileLabel ?? 'Chưa có hồ sơ học kỳ';
	capturedLabel.textContent = viewModel.capturedLabel
		? `Kiểm tra lúc ${viewModel.capturedLabel}`
		: 'Dữ liệu chỉ được lưu trên thiết bị này';
	addedCount.textContent = String(viewModel.counts.added);
	changedCount.textContent = String(viewModel.counts.changed);
	removedCount.textContent = String(viewModel.counts.removed);
	removedCard.dataset.blocked = String(viewModel.deletionBlocked);
	warning.hidden = viewModel.warning === undefined;
	warningText.textContent = viewModel.warning ?? '';
	primaryAction.textContent = viewModel.actionLabel;
	primaryActionKind = viewModel.actionKind;
	primaryActionUrl = viewModel.actionUrl ?? '';
	renderSyncedCourseAppearances(courseAppearances);
	diffDetails.hidden = details.length === 0;
	diffList.replaceChildren(
		...details.map((detail) => {
			const item = document.createElement('li');
			item.dataset.kind = detail.kind;
			const courseCode = detail.courseCode ?? detail.title.split(' · ')[0] ?? '';
			const appearance = courseAppearances.find(
				(candidate) =>
					candidate.courseCode.toLocaleUpperCase('vi') === courseCode.toLocaleUpperCase('vi')
			);
			if (appearance) {
				item.dataset.courseColor = 'true';
				item.style.setProperty('--course-color', appearance.background);
			}
			const title = document.createElement('strong');
			title.textContent = appearance?.icon ? `${appearance.icon} ${detail.title}` : detail.title;
			const description = document.createElement('span');
			description.textContent = detail.description;
			item.append(title, description);
			return item;
		})
	);
	if (
		new URLSearchParams(location.search).get('view') === 'diff' ||
		location.hash === '#diff-details'
	) {
		requestAnimationFrame(() => diffDetails.scrollIntoView({ block: 'start' }));
	}
}

function readCourseAppearances(
	profilesValue: unknown,
	profileId: string,
	preferencesValue: unknown
): CourseAppearanceSummary[] {
	if (!isCourseColorPreferences(preferencesValue) || !Array.isArray(profilesValue)) return [];
	const profile = profilesValue.find(
		(item) =>
			item !== null &&
			typeof item === 'object' &&
			(item as { profileId?: unknown }).profileId === profileId
	) as
		| {
				pendingSnapshot?: { events?: unknown };
				acceptedSnapshot?: { events?: unknown };
		  }
		| undefined;
	const eventsValue = profile?.pendingSnapshot?.events ?? profile?.acceptedSnapshot?.events;
	if (!Array.isArray(eventsValue)) return [];
	const events = eventsValue.filter(
		(event): event is ManagedEvent =>
			event !== null &&
			typeof event === 'object' &&
			typeof (event as { courseCode?: unknown }).courseCode === 'string' &&
			typeof (event as { title?: unknown }).title === 'string'
	);
	return summarizeCourseAppearances(events, preferencesValue);
}

function renderSyncedCourseAppearances(appearances: CourseAppearanceSummary[]): void {
	if (appearances.length === 0) {
		const empty = document.createElement('p');
		empty.textContent = 'Chưa nhận cấu hình màu và icon môn học từ web.';
		webSyncCourses.replaceChildren(empty);
		return;
	}
	webSyncCourses.replaceChildren(
		...appearances.map((appearance) => {
			const item = document.createElement('div');
			item.className = 'web-sync-course';
			item.style.setProperty('--course-color', appearance.background);
			const swatch = document.createElement('span');
			swatch.className = 'web-sync-course-swatch';
			swatch.setAttribute('aria-hidden', 'true');
			const copy = document.createElement('div');
			const title = document.createElement('strong');
			title.textContent = `${appearance.icon ? `${appearance.icon} ` : ''}${appearance.courseCode}`;
			const detail = document.createElement('span');
			detail.textContent = `${appearance.title} · ${appearance.colorName}${appearance.icon ? '' : ' · Không icon'}`;
			copy.append(title, detail);
			item.append(swatch, copy);
			return item;
		})
	);
}

async function handlePrimaryAction(): Promise<void> {
	if (primaryActionKind === 'open-settings') {
		settingsDisclosure.open = true;
		usernameInput.focus();
		return;
	}
	if (primaryActionKind === 'connect-google') {
		await changeGoogleConnection(true);
		return;
	}
	if (primaryActionKind === 'show-diff') {
		diffDetails.scrollIntoView({ block: 'start', behavior: 'smooth' });
		return;
	}
	if (primaryActionKind === 'open-web-review') {
		if (primaryActionUrl) await chrome.tabs.create({ url: primaryActionUrl });
		return;
	}

	primaryAction.disabled = true;
	statusTitle.textContent = 'Đang kiểm tra MyBK trong nền…';
	statusDetail.textContent =
		'Tiện ích đang dùng cửa sổ nền đã thu nhỏ để đăng nhập và đọc thời khóa biểu.';
	try {
		await sendRuntimeMessage({ type: 'bkalendar:tracking:run-now' });
	} catch (error) {
		settingsDisclosure.open = true;
		setCredentialMessage(
			error instanceof Error ? error.message : 'Không thể kiểm tra MyBK trong nền.',
			'error'
		);
	} finally {
		primaryAction.disabled = false;
		await renderStoredState();
	}
}

async function renderSettings(): Promise<void> {
	const response = await sendRuntimeMessage({
		type: 'bkalendar:settings:get'
	});
	credentialsConfigured = response.configured === true;
	settingsLoaded = true;
	currentTrackingMode = response.trackingMode ?? 'review';
	googleConnected = response.googleConnected === true;
	trackingMode.value = response.trackingMode ?? 'review';
	pollingInterval.value = String(response.pollingIntervalMinutes ?? 10);
	credentialState.textContent = response.configured ? 'Đã lưu an toàn' : 'Chưa cấu hình';
	credentialState.dataset.configured = String(response.configured);
	removeCredentials.disabled = !response.configured;
	settingsDisclosure.open = response.configured !== true;
	renderGoogleConnection(response.googleConnected === true);
	renderWebBridgeConnection(response.webConnected === true);
}

async function refreshWebBridgeConnection(): Promise<void> {
	try {
		const response = await sendRuntimeMessage({
			type: 'bkalendar:web-bridge:status:get'
		});
		renderWebBridgeConnection(response.webConnected === true);
	} catch {
		renderWebBridgeConnection(false);
	}
}

function renderWebBridgeConnection(connected: boolean): void {
	webBridgeState.textContent = connected ? 'Đã kết nối cục bộ' : 'Chưa kết nối';
	webBridgeState.dataset.connected = String(connected);
	openWeb.textContent = connected ? 'BKalendar Web đang mở' : 'Mở BKalendar Web';
	openWeb.disabled = connected;
}

async function setPollingInterval(intervalMinutes: PollingIntervalMinutes): Promise<void> {
	try {
		const response = await sendRuntimeMessage({
			type: 'bkalendar:polling:set-interval',
			intervalMinutes
		});
		pollingInterval.value = String(response.pollingIntervalMinutes ?? intervalMinutes);
		setCredentialMessage(`Đã đặt kiểm tra MyBK mỗi ${intervalMinutes} phút.`, 'success');
	} catch (error) {
		await renderSettings();
		setCredentialMessage(
			error instanceof Error ? error.message : 'Không thể đổi chu kỳ kiểm tra MyBK.',
			'error'
		);
	}
}

async function saveCredentials(): Promise<void> {
	setCredentialMessage('Đang mã hóa và kiểm tra MyBK…');
	try {
		const response = await sendRuntimeMessage({
			type: 'bkalendar:credentials:save',
			username: usernameInput.value,
			password: passwordInput.value,
			consent: consentInput.checked,
			trackingMode: trackingMode.value as TrackingMode
		});
		passwordInput.value = '';
		consentInput.checked = false;
		credentialsConfigured = response.configured === true;
		settingsLoaded = true;
		credentialState.textContent = response.configured ? 'Đã lưu an toàn' : 'Chưa cấu hình';
		credentialState.dataset.configured = String(response.configured);
		removeCredentials.disabled = !response.configured;
		setCredentialMessage(
			trackingMode.value === 'off'
				? 'Đã lưu tài khoản MyBK. Theo dõi nền hiện đang tắt.'
				: 'Đã lưu và kiểm tra MyBK thành công.',
			'success'
		);
		await renderStoredState();
	} catch (error) {
		setCredentialMessage(
			error instanceof Error ? error.message : 'Không thể lưu đăng nhập MyBK.',
			'error'
		);
	}
}

async function setTrackingMode(mode: TrackingMode): Promise<void> {
	try {
		await sendRuntimeMessage({ type: 'bkalendar:tracking:set-mode', trackingMode: mode });
		currentTrackingMode = mode;
		setCredentialMessage(
			mode === 'off' ? 'Đã tắt theo dõi nền.' : 'Đã lưu chế độ và kiểm tra MyBK.',
			'success'
		);
	} catch (error) {
		setCredentialMessage(
			error instanceof Error ? error.message : 'Không thể đổi chế độ theo dõi.',
			'error'
		);
		await renderSettings();
		await renderStoredState();
	}
}

async function removeStoredCredentials(): Promise<void> {
	try {
		await sendRuntimeMessage({ type: 'bkalendar:credentials:remove' });
		usernameInput.value = '';
		passwordInput.value = '';
		consentInput.checked = false;
		credentialsConfigured = false;
		settingsLoaded = true;
		trackingMode.value = 'off';
		credentialState.textContent = 'Chưa cấu hình';
		credentialState.dataset.configured = 'false';
		removeCredentials.disabled = true;
		setCredentialMessage('Đã xóa thông tin đăng nhập khỏi thiết bị.', 'success');
		await renderStoredState();
	} catch (error) {
		setCredentialMessage(
			error instanceof Error ? error.message : 'Không thể xóa đăng nhập MyBK.',
			'error'
		);
	}
}

async function changeGoogleConnection(connect: boolean): Promise<void> {
	setCredentialMessage(connect ? 'Đang kết nối Google Calendar…' : 'Đang ngắt Google Calendar…');
	try {
		const response = await sendRuntimeMessage({
			type: connect ? 'bkalendar:google:connect' : 'bkalendar:google:disconnect'
		});
		googleConnected = response.googleConnected === true;
		renderGoogleConnection(response.googleConnected === true);
		await renderStoredState();
		setCredentialMessage(
			connect ? 'Đã kết nối Google Calendar.' : 'Đã ngắt Google Calendar.',
			'success'
		);
	} catch (error) {
		setCredentialMessage(
			error instanceof Error ? error.message : 'Không thể thay đổi kết nối Google.',
			'error'
		);
	}
}

function renderGoogleConnection(connected: boolean): void {
	googleState.textContent = connected ? 'Đã kết nối' : 'Chưa kết nối';
	googleState.dataset.connected = String(connected);
	connectGoogle.disabled = connected;
	disconnectGoogle.disabled = !connected;
}

async function sendRuntimeMessage(message: unknown): Promise<{
	configured?: boolean;
	trackingMode?: TrackingMode;
	googleConnected?: boolean;
	pollingIntervalMinutes?: PollingIntervalMinutes;
	webConnected?: boolean;
}> {
	const response = (await chrome.runtime.sendMessage(message)) as {
		ok?: boolean;
		message?: string;
		configured?: boolean;
		trackingMode?: TrackingMode;
		googleConnected?: boolean;
		pollingIntervalMinutes?: PollingIntervalMinutes;
		webConnected?: boolean;
	};
	if (!response?.ok) throw new Error(response?.message || 'Extension background không phản hồi.');
	return response;
}

function setCredentialMessage(message: string, tone: 'success' | 'error' | 'idle' = 'idle'): void {
	credentialMessage.textContent = message;
	credentialMessage.dataset.tone = tone;
}

function requireElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing popup element: ${id}`);
	return element as T;
}
