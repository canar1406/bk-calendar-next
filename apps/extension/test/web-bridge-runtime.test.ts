import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { handleWebBridgeRuntimeRequest } from '../src/background/web-bridge-runtime.ts';

const trustedUrl = 'https://canar1406.github.io/bk-calendar-next/?semester=261';

describe('trusted web bridge runtime', () => {
	it('stores validated course appearance through the background context', async () => {
		const writes: unknown[] = [];
		const preferences = {
			schemaVersion: 1 as const,
			mode: 'course' as const,
			seed: 3,
			monoColorId: '7',
			overrides: { MT1003: '5' },
			icons: { MT1003: '🧮' }
		};

		const result = await handleWebBridgeRuntimeRequest(
			{
				type: 'bkalendar:web-bridge:appearance:save',
				profileId: 'student-2024:261',
				preferences
			},
			trustedUrl,
			{
				async readProfiles() {
					return [];
				},
				async readState() {
					throw new Error('not used');
				},
				async saveProfile() {
					throw new Error('not used');
				},
				async saveAppearance(profileId, value) {
					writes.push({ profileId, preferences: value });
				}
			}
		);

		assert.deepEqual(result, { handled: true });
		assert.deepEqual(writes, [{ profileId: 'student-2024:261', preferences }]);
	});

	it('rejects messages from pages outside the official GitHub Pages path', async () => {
		let writes = 0;
		const context = {
			async readProfiles() {
				return [];
			},
			async readState() {
				throw new Error('not used');
			},
			async saveProfile() {
				writes += 1;
			},
			async saveAppearance() {
				writes += 1;
			}
		};
		const message = {
			type: 'bkalendar:web-bridge:appearance:save',
			profileId: 'student-2024:261',
			preferences: {
				schemaVersion: 1,
				mode: 'course',
				seed: 0,

				monoColorId: '7',
				overrides: {},
				icons: {}
			}
		};

		assert.deepEqual(
			await handleWebBridgeRuntimeRequest(message, 'https://evil.example/', context),
			{ handled: false }
		);
		assert.deepEqual(
			await handleWebBridgeRuntimeRequest(
				message,
				'https://canar1406.github.io/bk-calendar-next-evil/',
				context
			),
			{ handled: false }
		);
		assert.equal(writes, 0);
	});
});
