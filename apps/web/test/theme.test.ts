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
});
