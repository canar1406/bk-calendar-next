<script lang="ts">
	import { onMount } from 'svelte';
	import {
		applyTheme,
		normalizeThemePreference,
		THEME_STORAGE_KEY,
		type ThemePreference
	} from '$lib/theme.ts';
	import { publishThemeToExtension } from '$lib/extension-handoff.ts';

	let preference: ThemePreference = 'system';
	let systemQuery: MediaQueryList | undefined;

	onMount(() => {
		preference = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
		systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const resolved = applyTheme(document.documentElement, preference, systemQuery.matches);
		publishThemeToExtension(window, preference, resolved);

		const handleSystemChange = (event: MediaQueryListEvent) => {
			if (preference === 'system') {
				const nextResolved = applyTheme(document.documentElement, preference, event.matches);
				publishThemeToExtension(window, preference, nextResolved);
			}
		};
		const handleExtensionTheme = (event: Event) => {
			const detail = (
				event as CustomEvent<{
					preference?: unknown;
					resolvedTheme?: unknown;
				}>
			).detail;
			const next = detail?.preference;
			preference = normalizeThemePreference(next);
			localStorage.setItem(THEME_STORAGE_KEY, preference);
			if (
				preference === 'system' &&
				(detail?.resolvedTheme === 'light' || detail?.resolvedTheme === 'dark')
			) {
				localStorage.setItem('bkalendar-next:theme-resolved', detail.resolvedTheme);
				document.documentElement.dataset.theme = detail.resolvedTheme;
				return;
			}
			applyTheme(document.documentElement, preference, systemQuery?.matches ?? false);
		};
		window.addEventListener('bkalendar:theme-updated', handleExtensionTheme);
		systemQuery.addEventListener('change', handleSystemChange);
		return () => {
			systemQuery?.removeEventListener('change', handleSystemChange);
			window.removeEventListener('bkalendar:theme-updated', handleExtensionTheme);
		};
	});

	function updatePreference(): void {
		localStorage.setItem(THEME_STORAGE_KEY, preference);
		const resolved = applyTheme(
			document.documentElement,
			preference,
			systemQuery?.matches ?? window.matchMedia('(prefers-color-scheme: dark)').matches
		);
		publishThemeToExtension(window, preference, resolved);
	}
</script>

<div class="theme-switcher">
	<label for="theme-preference">Giao diện</label>
	<select id="theme-preference" bind:value={preference} on:change={updatePreference}>
		<option value="system">Theo hệ thống</option>
		<option value="light">Sáng</option>
		<option value="dark">Tối</option>
	</select>
</div>
