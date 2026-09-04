<script lang="ts">
	import { onMount } from 'svelte';
	import {
		applyTheme,
		normalizeThemePreference,
		THEME_STORAGE_KEY,
		type ThemePreference
	} from '$lib/theme.ts';

	let preference: ThemePreference = 'system';
	let systemQuery: MediaQueryList | undefined;

	onMount(() => {
		preference = normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
		systemQuery = window.matchMedia('(prefers-color-scheme: dark)');
		applyTheme(document.documentElement, preference, systemQuery.matches);

		const handleSystemChange = (event: MediaQueryListEvent) => {
			if (preference === 'system') {
				applyTheme(document.documentElement, preference, event.matches);
			}
		};
		systemQuery.addEventListener('change', handleSystemChange);
		return () => systemQuery?.removeEventListener('change', handleSystemChange);
	});

	function updatePreference(): void {
		localStorage.setItem(THEME_STORAGE_KEY, preference);
		applyTheme(
			document.documentElement,
			preference,
			systemQuery?.matches ?? window.matchMedia('(prefers-color-scheme: dark)').matches
		);
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
