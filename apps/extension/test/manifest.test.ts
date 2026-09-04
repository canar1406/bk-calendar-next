import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

interface ExtensionManifest {
	manifest_version: number;
	key?: string;
	permissions?: string[];
	host_permissions?: string[];
	oauth2?: {
		client_id?: string;
		scopes?: string[];
	};
	background?: {
		service_worker?: string;
		type?: string;
	};
	action?: {
		default_popup?: string;
		default_icon?: Record<string, string>;
	};
	icons?: Record<string, string>;
	content_scripts?: Array<{
		matches?: string[];
		js?: string[];
	}>;
}

const manifestPath = new URL('../manifest.json', import.meta.url);
const myBkTimetableUrl = 'https://mybk.hcmut.edu.vn/app/he-thong-quan-ly/sinh-vien/tkb*';
const myBkLoginUrl = 'https://mybk.hcmut.edu.vn/app/login*';
const hcmutSsoUrl = 'https://sso.hcmut.edu.vn/cas/login*';
const reviewUrl = 'https://canar1406.github.io/bk-calendar-next/*';
const googleCalendarApiUrl = 'https://www.googleapis.com/calendar/v3/*';

async function readManifest(): Promise<ExtensionManifest> {
	return JSON.parse(await readFile(manifestPath, 'utf8')) as ExtensionManifest;
}

describe('MV3 manifest', () => {
	it('uses local storage, alarms, and only the MyBK/CAS hosts needed for background tracking', async () => {
		const manifest = await readManifest();

		assert.equal(manifest.manifest_version, 3);
		assert.deepEqual(manifest.permissions, ['storage', 'alarms', 'notifications', 'identity']);
		assert.deepEqual(manifest.host_permissions, [
			myBkTimetableUrl,
			myBkLoginUrl,
			hcmutSsoUrl,
			reviewUrl,
			googleCalendarApiUrl
		]);
		assert.equal(JSON.stringify(manifest).includes('<all_urls>'), false);
		assert.ok((manifest.key?.length ?? 0) > 300);
		assert.match(manifest.oauth2?.client_id ?? '', /\.apps\.googleusercontent\.com$/);
		assert.deepEqual(manifest.oauth2?.scopes, [
			'https://www.googleapis.com/auth/calendar.app.created'
		]);
	});

	it('wires the local background, content, and popup build outputs', async () => {
		const manifest = await readManifest();

		assert.deepEqual(manifest.background, {
			service_worker: 'background.js',
			type: 'module'
		});
		assert.equal(manifest.action?.default_popup, 'src/popup/index.html');
		assert.deepEqual(manifest.icons, {
			'16': 'icons/icon-16.png',
			'32': 'icons/icon-32.png',
			'48': 'icons/icon-48.png',
			'128': 'icons/icon-128.png'
		});
		assert.deepEqual(manifest.action?.default_icon, manifest.icons);
		assert.deepEqual(manifest.content_scripts, [
			{
				matches: [myBkTimetableUrl],
				js: ['content.js']
			},
			{
				matches: [reviewUrl],
				js: ['web-review.js']
			}
		]);
	});
});
