import './style.css';
import { EXTENSION_STATUS_KEY, type ExtensionStatus } from '../background/status.ts';
import {
	buildPopupViewModel,
	selectCurrentProfile,
	summarizeStoredProfiles
} from './view-model.ts';

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
const primaryAction = requireElement<HTMLAnchorElement>('primary-action');
const PROFILE_STORAGE_KEY = 'bkalendar-next:profiles';

void renderStoredState();

chrome.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local') return;
	if (changes[EXTENSION_STATUS_KEY] || changes[PROFILE_STORAGE_KEY]) {
		void renderStoredState();
	}
});

async function renderStoredState(): Promise<void> {
	const stored = await chrome.storage.local.get([EXTENSION_STATUS_KEY, PROFILE_STORAGE_KEY]);
	const status = stored[EXTENSION_STATUS_KEY] as ExtensionStatus | undefined;
	const profiles = summarizeStoredProfiles(stored[PROFILE_STORAGE_KEY]);
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
}

function requireElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing popup element: ${id}`);
	return element as T;
}
