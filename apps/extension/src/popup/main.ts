import './style.css';
import { EXTENSION_STATUS_KEY, type ExtensionStatus } from '../background/status.ts';
import {
	buildStoredDiffDetails,
	buildPopupViewModel,
	selectCurrentProfile,
	summarizeStoredProfiles
} from './view-model.ts';
import type { TrackingMode } from '../background/tracking-policy.ts';
import { LAST_DIFF_STORAGE_KEY } from '../shared/diff-log.ts';

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
const primaryAction = requireElement<HTMLAnchorElement>('primary-action');
const credentialForm = requireElement<HTMLFormElement>('credential-form');
const usernameInput = requireElement<HTMLInputElement>('mybk-username');
const passwordInput = requireElement<HTMLInputElement>('mybk-password');
const consentInput = requireElement<HTMLInputElement>('credential-consent');
const trackingMode = requireElement<HTMLSelectElement>('tracking-mode');
const credentialState = requireElement<HTMLElement>('credential-state');
const credentialMessage = requireElement<HTMLParagraphElement>('credential-message');
const removeCredentials = requireElement<HTMLButtonElement>('remove-credentials');
const googleState = requireElement<HTMLElement>('google-state');
const connectGoogle = requireElement<HTMLButtonElement>('connect-google');
const disconnectGoogle = requireElement<HTMLButtonElement>('disconnect-google');
const PROFILE_STORAGE_KEY = 'bkalendar-next:profiles';

void renderStoredState();
void renderSettings();

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local') return;
	if (changes[EXTENSION_STATUS_KEY] || changes[PROFILE_STORAGE_KEY]) {
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

removeCredentials.addEventListener('click', () => {
	void removeStoredCredentials();
});

connectGoogle.addEventListener('click', () => {
	void changeGoogleConnection(true);
});

disconnectGoogle.addEventListener('click', () => {
	void changeGoogleConnection(false);
});

async function renderStoredState(): Promise<void> {
	const stored = await chrome.storage.local.get([
		EXTENSION_STATUS_KEY,
		PROFILE_STORAGE_KEY,
		LAST_DIFF_STORAGE_KEY
	]);
	const status = stored[EXTENSION_STATUS_KEY] as ExtensionStatus | undefined;
	const profiles = summarizeStoredProfiles(stored[PROFILE_STORAGE_KEY]);
	const details = buildStoredDiffDetails(
		stored[PROFILE_STORAGE_KEY],
		stored[LAST_DIFF_STORAGE_KEY]
	);
	const viewModel = buildPopupViewModel(
		status ?? { state: 'idle' },
		selectCurrentProfile(profiles)
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
	primaryAction.href = viewModel.actionUrl;
	diffDetails.hidden = details.length === 0;
	diffList.replaceChildren(
		...details.map((detail) => {
			const item = document.createElement('li');
			item.dataset.kind = detail.kind;
			const title = document.createElement('strong');
			title.textContent = detail.title;
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

async function renderSettings(): Promise<void> {
	const response = await sendRuntimeMessage({
		type: 'bkalendar:settings:get'
	});
	trackingMode.value = response.trackingMode ?? 'review';
	credentialState.textContent = response.configured ? 'Đã lưu an toàn' : 'Chưa cấu hình';
	credentialState.dataset.configured = String(response.configured);
	removeCredentials.disabled = !response.configured;
	renderGoogleConnection(response.googleConnected === true);
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
		credentialState.textContent = response.configured ? 'Đã lưu an toàn' : 'Chưa cấu hình';
		credentialState.dataset.configured = String(response.configured);
		removeCredentials.disabled = !response.configured;
		setCredentialMessage('Đã lưu và kiểm tra MyBK thành công.', 'success');
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
		setCredentialMessage(
			mode === 'off' ? 'Đã tắt theo dõi nền.' : 'Đã lưu chế độ và kiểm tra MyBK.',
			'success'
		);
	} catch (error) {
		trackingMode.value = 'off';
		setCredentialMessage(
			error instanceof Error ? error.message : 'Không thể đổi chế độ theo dõi.',
			'error'
		);
	}
}

async function removeStoredCredentials(): Promise<void> {
	try {
		await sendRuntimeMessage({ type: 'bkalendar:credentials:remove' });
		usernameInput.value = '';
		passwordInput.value = '';
		consentInput.checked = false;
		trackingMode.value = 'off';
		credentialState.textContent = 'Chưa cấu hình';
		credentialState.dataset.configured = 'false';
		removeCredentials.disabled = true;
		setCredentialMessage('Đã xóa thông tin đăng nhập khỏi thiết bị.', 'success');
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
		renderGoogleConnection(response.googleConnected === true);
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
}> {
	const response = (await chrome.runtime.sendMessage(message)) as {
		ok?: boolean;
		message?: string;
		configured?: boolean;
		trackingMode?: TrackingMode;
		googleConnected?: boolean;
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
