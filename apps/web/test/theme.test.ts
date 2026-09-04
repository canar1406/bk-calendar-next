import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
	applyTheme,
	normalizeThemePreference,
	resolveTheme,
	type ThemePreference
} from '../src/lib/theme.ts';

describe('web theme preference', () => {
	it('resolves light, dark, and system preferences', () => {
		assert.equal(resolveTheme('light', true), 'light');
		assert.equal(resolveTheme('dark', false), 'dark');
		assert.equal(resolveTheme('system', true), 'dark');
		assert.equal(resolveTheme('system', false), 'light');
	});

	it('falls back to system for unknown stored values', () => {
		assert.equal(normalizeThemePreference('unknown'), 'system');
		assert.equal(normalizeThemePreference(undefined), 'system');
	});

	it('applies the resolved theme to the document root', () => {
		const root = { dataset: {} as DOMStringMap };
		applyTheme(root, 'dark', false);
		assert.equal(root.dataset.theme, 'dark');
	});

	it('keeps the preference type intentionally small', () => {
		const preference: ThemePreference = 'system';
		assert.equal(preference, 'system');
	});

	it('binds the document colors to theme tokens instead of fixed light colors', async () => {
		const css = await readFile(new URL('../src/app.css', import.meta.url), 'utf8');
		assert.match(css, /color:\s*var\(--ink\)/);
		assert.match(css, /background:\s*var\(--paper\)/);
		assert.match(css, /--on-accent:\s*#071722/);
		assert.match(css, /\.snapshot-summary[\s\S]*background:\s*var\(--summary-bg\)/);
		assert.match(css, /\.extension-cta[\s\S]*color:\s*var\(--cta-ink\)/);
	});

	it('keeps the theme switcher in page toolbars instead of floating over content', async () => {
		const layout = await readFile(new URL('../src/routes/+layout.svelte', import.meta.url), 'utf8');
		const home = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
		const privacy = await readFile(
			new URL('../src/routes/privacy/+page.svelte', import.meta.url),
			'utf8'
		);
		const terms = await readFile(
			new URL('../src/routes/terms/+page.svelte', import.meta.url),
			'utf8'
		);
		const css = await readFile(new URL('../src/app.css', import.meta.url), 'utf8');

		assert.doesNotMatch(layout, /<ThemeSwitcher/);
		assert.match(home, /site-header-actions[\s\S]*<ThemeSwitcher/);
		assert.match(privacy, /legal-toolbar[\s\S]*<ThemeSwitcher/);
		assert.match(terms, /legal-toolbar[\s\S]*<ThemeSwitcher/);
		assert.doesNotMatch(css, /\.theme-switcher\s*\{[\s\S]*?position:\s*fixed/);
	});

	it('uses a layered dark palette instead of one flat navy surface', async () => {
		const css = await readFile(new URL('../src/app.css', import.meta.url), 'utf8');

		assert.match(css, /--surface-raised:/);
		assert.match(css, /html\[data-theme='dark'\]\s+body[\s\S]*radial-gradient/);
		assert.match(css, /html\[data-theme='dark'\]\s+\.extension-intro/);
		assert.match(css, /html\[data-theme='dark'\]\s+\.extension-intro-copy/);
		assert.match(css, /html\[data-theme='dark'\]\s+\.extension-benefits\s*>\s*div/);
		assert.match(css, /html\[data-theme='dark'\]\s+\.extension-cta[\s\S]*background:\s*rgba/);
		assert.match(css, /\.extension-cta\s*\{[\s\S]*border-radius:\s*8px/);
		assert.match(css, /html\[data-theme='dark'\]\s+\.import-section\s*\{/);
		assert.match(css, /html\[data-theme='dark'\]\s+textarea[\s\S]*border-radius:/);
		assert.match(css, /html\[data-theme='dark'\]\s+\.primary-button[\s\S]*linear-gradient/);
		assert.match(css, /html\[data-theme='dark'\]\s+\.text-button/);
		assert.match(
			css,
			/html\[data-theme='dark'\]\s+\.theme-switcher option[\s\S]*color:\s*#102a43[\s\S]*background:\s*#f8fafc/
		);
	});
});
