import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	HCMUT_CAS_RENEW_URL,
	MYBK_TIMETABLE_URL,
	captureInHiddenTab,
	createHiddenCaptureRegistry,
	submitCasCredentials,
	type HiddenTabApi,
	type HiddenTabUpdateListener
} from '../src/background/hidden-tab-capture.ts';

function completeCapture(raw = 'captured') {
	return {
		raw,
		completeness: { state: 'complete' as const, parsedRows: 1, expectedRows: 1 }
	};
}

function createFakeApi(calls: string[]): {
	api: HiddenTabApi;
	emit(url: string, status?: string): Promise<void>;
} {
	let listener: HiddenTabUpdateListener | undefined;
	return {
		api: {
			async createTab(properties) {
				calls.push(`create-tab:${properties.url}:${String(properties.active)}`);
				return { id: 42 };
			},
			async createWindow(properties) {
				calls.push(
					`create-window:${properties.url}:${String(properties.focused)}:${properties.state}:${properties.type}`
				);
				return { id: 99, tabs: [{ id: 42 }] };
			},
			async updateWindow(windowId, properties) {
				calls.push(`update-window:${windowId}:${String(properties.focused)}:${properties.state}`);
			},
			async update(tabId, properties) {
				calls.push(`update:${tabId}:${properties.url}`);
				return { id: tabId, url: properties.url };
			},
			async remove(tabId) {
				calls.push(`remove:${tabId}`);
			},
			async removeWindow(windowId) {
				calls.push(`remove-window:${windowId}`);
			},
			onUpdated: {
				addListener(nextListener) {
					listener = nextListener;
					calls.push('listener:add');
				},
				removeListener(nextListener) {
					assert.equal(nextListener, listener);
					calls.push('listener:remove');
					listener = undefined;
				}
			}
		},
		async emit(url, status = 'complete') {
			assert.ok(listener, 'navigation listener must be registered before navigation');
			listener(42, { url, status }, { id: 42, url });
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	};
}

describe('hidden MyBK tab capture', () => {
	it('registers capture and navigation before opening the TKB URL in an inactive tab', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		let resolveCapture!: (capture: ReturnType<typeof completeCapture>) => void;

		const pending = captureInHiddenTab({
			api: fake.api,
			url: MYBK_TIMETABLE_URL,
			credentials: { username: 'student', password: 'secret' },
			waitForCapture: (tabId) => {
				calls.push(`capture:wait:${tabId}`);
				return new Promise((resolve) => {
					resolveCapture = resolve;
				});
			},
			submitCredentials: async () => true
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		assert.deepEqual(calls.slice(0, 4), [
			'create-tab:about:blank:false',
			'capture:wait:42',
			'listener:add',
			`update:42:${MYBK_TIMETABLE_URL}`
		]);

		resolveCapture(completeCapture());
		const result = await pending;

		assert.equal(result.raw, 'captured');
		assert.deepEqual(calls.slice(-2), ['listener:remove', 'remove:42']);
	});

	it('returns an authenticated /app landing page to the exact timetable URL', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		let resolveCapture!: (capture: ReturnType<typeof completeCapture>) => void;
		const pending = captureInHiddenTab({
			api: fake.api,
			url: MYBK_TIMETABLE_URL,
			credentials: { username: 'student', password: 'secret' },
			waitForCapture: () =>
				new Promise((resolve) => {
					resolveCapture = resolve;
				}),
			submitCredentials: async () => true
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await fake.emit('https://mybk.hcmut.edu.vn/app/');
		assert.equal(calls.filter((call) => call === `update:42:${MYBK_TIMETABLE_URL}`).length, 2);

		resolveCapture(completeCapture());
		await pending;
	});

	it('sends the inactive tab from MyBK login to CAS renew authentication', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		let resolveCapture!: (capture: ReturnType<typeof completeCapture>) => void;
		const pending = captureInHiddenTab({
			api: fake.api,
			url: MYBK_TIMETABLE_URL,
			credentials: { username: 'student', password: 'secret' },
			waitForCapture: () =>
				new Promise((resolve) => {
					resolveCapture = resolve;
				}),
			submitCredentials: async () => true
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await fake.emit('https://mybk.hcmut.edu.vn/app/login');
		assert.ok(calls.includes(`update:42:${HCMUT_CAS_RENEW_URL}`));

		resolveCapture(completeCapture());
		await pending;
	});

	it('returns the CAS service callback to TKB instead of starting a second login', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		let resolveCapture!: (capture: ReturnType<typeof completeCapture>) => void;
		const pending = captureInHiddenTab({
			api: fake.api,
			url: MYBK_TIMETABLE_URL,
			credentials: { username: 'student', password: 'secret' },
			waitForCapture: () =>
				new Promise((resolve) => {
					resolveCapture = resolve;
				}),
			submitCredentials: async () => true
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await fake.emit('https://mybk.hcmut.edu.vn/app/login/cas?ticket=ST-123');
		assert.equal(calls.at(-1), `update:42:${MYBK_TIMETABLE_URL}`);
		assert.equal(calls.includes(`update:42:${HCMUT_CAS_RENEW_URL}`), false);

		resolveCapture(completeCapture());
		await pending;
	});

	it('submits saved credentials only after the inactive tab reaches HCMUT CAS', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		let resolveCapture!: (capture: ReturnType<typeof completeCapture>) => void;
		const submitted: Array<{ tabId: number; username: string; password: string }> = [];
		const pending = captureInHiddenTab({
			api: fake.api,
			url: MYBK_TIMETABLE_URL,
			credentials: { username: 'student', password: 'secret' },
			waitForCapture: () =>
				new Promise((resolve) => {
					resolveCapture = resolve;
				}),
			submitCredentials: async (tabId, credentials) => {
				submitted.push({ tabId, ...credentials });
				return true;
			}
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await fake.emit(HCMUT_CAS_RENEW_URL);
		assert.deepEqual(submitted, [{ tabId: 42, username: 'student', password: 'secret' }]);

		resolveCapture(completeCapture());
		await pending;
	});

	it('supports a configured non-MyBK source URL and submits its native login form in the background', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		let resolveCapture!: (capture: ReturnType<typeof completeCapture>) => void;
		let submitted = 0;
		const pending = captureInHiddenTab({
			api: fake.api,
			url: 'https://tkb.hcmut.edu.vn/',
			sourceKind: 'lecturer',
			credentials: { username: 'lecturer', password: 'secret' },
			waitForCapture: () =>
				new Promise((resolve) => {
					resolveCapture = resolve;
				}),
			submitCredentials: async () => {
				submitted += 1;
				return true;
			}
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await fake.emit('https://tkb.hcmut.edu.vn/login');
		assert.equal(submitted, 1);
		resolveCapture(completeCapture());
		await pending;
	});

	it('restarts CAS authentication when the TKB URL returns an expired-session page', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		let resolveCapture!: (capture: ReturnType<typeof completeCapture>) => void;
		let sessionExpired!: (reason?: string) => Promise<void>;
		const pending = captureInHiddenTab({
			api: fake.api,
			url: MYBK_TIMETABLE_URL,
			credentials: { username: 'student', password: 'secret' },
			waitForCapture: (tabId) =>
				new Promise((resolve) => {
					resolveCapture = resolve;
				}),
			registerSessionExpired: (tabId, handler) => {
				calls.push(`session-handler:${tabId}`);
				sessionExpired = handler;
				return () => calls.push('session-handler:remove');
			},
			submitCredentials: async () => true
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await fake.emit(MYBK_TIMETABLE_URL);
		assert.ok(calls.includes(`session-handler:42`));
		await sessionExpired('Phiên đăng nhập đã hết hạn');
		assert.ok(calls.includes(`update:42:${HCMUT_CAS_RENEW_URL}`));

		resolveCapture(completeCapture());
		await pending;
	});

	it('closes the inactive tab and removes its listener when capture fails', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);

		await assert.rejects(
			() =>
				captureInHiddenTab({
					api: fake.api,
					url: MYBK_TIMETABLE_URL,
					credentials: { username: 'student', password: 'secret' },
					waitForCapture: async () => {
						throw new Error('capture failed');
					},
					submitCredentials: async () => true
				}),
			/capture failed/
		);
		assert.deepEqual(calls.slice(-2), ['listener:remove', 'remove:42']);
	});

	it('rejects a tracked capture immediately when the content script reports an error', async () => {
		const registry = createHiddenCaptureRegistry();
		const pending = registry.wait(42, 5_000);

		assert.equal(registry.reject(42, new Error('Không đọc được TKB trên trang MyBK.')), true);
		await assert.rejects(pending, /Không đọc được TKB trên trang MyBK/);
		assert.equal(registry.size, 0);
	});

	it('cancels the capture waiter when navigation leaves the supported MyBK flow', async () => {
		const calls: string[] = [];
		const fake = createFakeApi(calls);
		const registry = createHiddenCaptureRegistry();
		const pending = captureInHiddenTab({
			api: fake.api,
			url: MYBK_TIMETABLE_URL,
			credentials: { username: 'student', password: 'secret' },
			waitForCapture: (tabId) => registry.wait(tabId, 5_000),
			cancelCapture: (tabId, error) => registry.reject(tabId, error),
			submitCredentials: async () => true
		});
		const rejected = assert.rejects(pending, /không được hỗ trợ/);

		await new Promise((resolve) => setTimeout(resolve, 0));
		await fake.emit('https://mybk.hcmut.edu.vn/app/trang-khong-ho-tro');
		await rejected;
		assert.equal(registry.size, 0);
	});
});

describe('CAS credential injection', () => {
	it('executes credential submission in the target tab without logging credentials', async () => {
		let captured:
			| {
					target: { tabId: number };
					args?: unknown[];
			  }
			| undefined;

		const submitted = await submitCasCredentials(
			{
				async executeScript(injection) {
					captured = injection;
					return [{ result: true }];
				}
			},
			42,
			{ username: 'student', password: 'secret' }
		);

		assert.equal(submitted, true);
		assert.deepEqual(captured?.target, { tabId: 42 });
		assert.deepEqual(captured?.args, ['student', 'secret']);
		assert.equal(submitCasCredentials.toString().includes('console.'), false);
	});
});
