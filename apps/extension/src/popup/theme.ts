import {
	normalizeThemePreference,
	normalizeResolvedTheme,
	resolveTheme,
	THEME_RESOLVED_STORAGE_KEY,
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
			const [storedPreference, storedResolved] = await Promise.all([
				storage.get(THEME_STORAGE_KEY),
				storage.get(THEME_RESOLVED_STORAGE_KEY)
			]);
			const preference = normalizeThemePreference(storedPreference[THEME_STORAGE_KEY]);
			const syncedResolvedTheme = normalizeResolvedTheme(
				storedResolved[THEME_RESOLVED_STORAGE_KEY]
			);
			select.value = preference;
			root.dataset.theme =
				preference === 'system' && syncedResolvedTheme
					? syncedResolvedTheme
					: resolveTheme(preference, systemPrefersDark());
		},
		async update(preference) {
			const resolved = resolveTheme(preference, systemPrefersDark());
			await storage.set({
				[THEME_STORAGE_KEY]: preference,
				[THEME_RESOLVED_STORAGE_KEY]: resolved
			});
			root.dataset.theme = resolved;
		}
	};
}
