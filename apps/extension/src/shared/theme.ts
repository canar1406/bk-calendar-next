export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'bkalendar-next:theme';
export const THEME_RESOLVED_STORAGE_KEY = 'bkalendar-next:theme-resolved';

export function normalizeThemePreference(value: unknown): ThemePreference {
	return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function resolveTheme(
	preference: ThemePreference,
	systemPrefersDark: boolean
): ResolvedTheme {
	if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
	return preference;
}

export function normalizeResolvedTheme(value: unknown): ResolvedTheme | undefined {
	return value === 'light' || value === 'dark' ? value : undefined;
}
