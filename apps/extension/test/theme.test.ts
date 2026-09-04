import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import {
	normalizeThemePreference,
	THEME_RESOLVED_STORAGE_KEY,
	THEME_STORAGE_KEY,
	resolveTheme,
	type ThemePreference
} from '../src/shared/theme.ts';
import { createPopupThemeController } from '../src/popup/theme.ts';

describe('extension theme preference', () => {
	it('supports light, dark, and system modes', () => {
		assert.equal(resolveTheme('light', true), 'light');
		assert.equal(resolveTheme('dark', false), 'dark');
		assert.equal(resolveTheme('system', true), 'dark');
		assert.equal(resolveTheme('system', false), 'light');
	});

	it('normalizes invalid persisted values to system', () => {
		assert.equal(normalizeThemePreference('sepia'), 'system');
		assert.equal(normalizeThemePreference(undefined), 'system');
	});

	it('keeps the mode contract explicit', () => {
		const mode: ThemePreference = 'dark';
		assert.equal(mode, 'dark');
	});

	it('loads and persists the popup theme through local extension storage', async () => {
		const values: Record<string, unknown> = { [THEME_STORAGE_KEY]: 'dark' };
		const root = { dataset: {} as DOMStringMap };
		const select = { value: '' } as HTMLSelectElement;
		const controller = createPopupThemeController(
			root,
			select,
			{
				async get(key) {
					return { [key]: values[key] };
				},
				async set(items) {
					Object.assign(values, items);
				}
			},
			() => false
		);

		await controller.initialize();
		assert.equal(select.value, 'dark');
		assert.equal(root.dataset.theme, 'dark');

		await controller.update('system');
		assert.equal(values[THEME_STORAGE_KEY], 'system');
		assert.equal(root.dataset.theme, 'light');
	});

	it('uses the web-synchronized resolved theme when Edge reports the wrong system color', async () => {
		const values: Record<string, unknown> = {
			[THEME_STORAGE_KEY]: 'system',
			[THEME_RESOLVED_STORAGE_KEY]: 'dark'
		};
		const root = { dataset: {} as DOMStringMap };
		const select = { value: '' } as HTMLSelectElement;
		const controller = createPopupThemeController(
			root,
			select,
			{
				async get(key) {
					return { [key]: values[key] };
				},
				async set(items) {
					Object.assign(values, items);
				}
			},
			() => false
		);

		await controller.initialize();
		assert.equal(select.value, 'system');
		assert.equal(root.dataset.theme, 'dark');
	});

	it('applies the popup theme before waiting for settings and profile state', async () => {
		const source = await readFile(new URL('../src/popup/main.ts', import.meta.url), 'utf8');
		const initialize = source.match(
			/async function initializePopup\(\): Promise<void> \{([\s\S]*?)\n\}/
		)?.[1];

		assert.ok(initialize);
		assert.ok(
			initialize.indexOf('themeController.initialize()') < initialize.indexOf('renderSettings()')
		);
		assert.match(initialize, /Promise\.all/);
	});
});
