<script lang="ts">
	import '@fontsource/be-vietnam-pro/400.css';
	import '@fontsource/be-vietnam-pro/500.css';
	import '@fontsource/be-vietnam-pro/600.css';
	import '@fontsource/be-vietnam-pro/700.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import '../app.css';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
</script>

<ThemeSwitcher />
<slot />
