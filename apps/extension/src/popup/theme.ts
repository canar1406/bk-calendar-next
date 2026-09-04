import {
	normalizeThemePreference,
	resolveTheme,
	THEME_STORAGE_KEY,
	type ThemePreference
} from '../shared/theme.ts';

export interface ThemeStorage {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
}

export function createPopupThemeController(
	root: Pick<HTMLElement, 'dataset'>,
	select: HTMLSelectElement,
	storage: ThemeStorage,
	systemPrefersDark: () => boolean = () => window.matchMedia('(prefers-color-scheme: dark)').matches
): {
	initialize(): Promise<void>;
	update(preference: ThemePreference): Promise<void>;
} {
	return {
		async initialize() {
			const stored = await storage.get(THEME_STORAGE_KEY);
			const preference = normalizeThemePreference(stored[THEME_STORAGE_KEY]);
			select.value = preference;
			root.dataset.theme = resolveTheme(preference, systemPrefersDark());
		},
		async update(preference) {
			await storage.set({ [THEME_STORAGE_KEY]: preference });
			root.dataset.theme = resolveTheme(preference, systemPrefersDark());
		}
	};
}
