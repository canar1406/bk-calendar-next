<script lang="ts">
	import { base } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import {
		GoogleCalendarRestGateway,
		createManagedCalendar,
		findLegacyCalendars,
		findManagedCalendars,
		isGoogleCalendarAuthError,
		requestGoogleAccessToken,
		revokeGoogleAccessToken,
		type SyncResult
	} from '../../../../packages/google-calendar/src/index.ts';
	import {
		createBrowserStorage,
		createProfileStore
	} from '../../../../packages/timetable/src/storage.ts';
	import { diffSnapshots, type SourceKind } from '../../../../packages/timetable/src/index.ts';
	import ChangeSummary from '$lib/components/ChangeSummary.svelte';
	import CourseColorPicker from '$lib/components/CourseColorPicker.svelte';
	import ScheduleBoard from '$lib/components/ScheduleBoard.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import {
		publishCourseAppearanceToExtension,
		publishProfileToExtension,
		requestExtensionStateFromExtension,
		requestPendingSnapshotFromExtension,
		subscribeToExtensionState,
		type ExtensionMessageWindow
	} from '$lib/extension-handoff.ts';
	import type { ExtensionState } from '../../../../packages/timetable/src/index.ts';
	import { loadGoogleIdentity } from '$lib/google-identity.ts';
	import { syncPendingProfile, syncWithGoogleReauth } from '$lib/google-sync.ts';
	import { createIcalendarExport, triggerIcalendarDownload } from '$lib/ical-download.ts';
	import {
		buildCourseColorAssignments,
		colorizeEventsForSync,
		createCourseColorStore,
		defaultCourseColorPreferences,
		summarizeCourseAppearances,
		type CourseAppearanceSummary,
		type CourseColorPreferences
	} from '$lib/course-colors.ts';
	import {
		inferCaptureCompleteness,
		prepareTimetable,
		stageTimetableImport,
		stageTransferredSnapshot,
		type PreparedTimetable
	} from '$lib/workflow.ts';

	const sample = `20261 - Học kỳ 1 Năm học 2026 - 2027(Hiện hành)
Ngày cập nhật gần nhất của HK này: 28/08/2026 14:57:54
HỌC KỲ\tMÃ MH\tTÊN MÔN HỌC\tTÍN CHỈ\tTC HỌC PHÍ\tNHÓM - TỔ\tTHỨ\tTIẾT\tGIỜ HỌC\tPHÒNG\tCƠ SỞ\tTUẦN HỌC
20261\tDEMO1001\tMôn học minh họa buổi sáng\t3\t3\tDEMO-A\t2\t2 - 4\t7:00 - 9:50\tPHÒNG-DEMO-1\tBK-CS2\t35|--|37|
20261\tDEMO1002\tMôn học minh họa buổi chiều\t3\t3\tDEMO-B\t4\t7 - 9\t12:00 - 14:50\tPHÒNG-DEMO-2\tBK-CS1\t35|36|37|
20261\tDEMO1003\tThực hành minh họa\t1\t1\tDEMO-C\t6\t4 - 6\t9:00 - 11:50\tPHÒNG-DEMO-3\tBK-CS2\t35|36|37|
Trình bày từ dòng 1 đến 3 / 3 dòng`;

	type Prepared = PreparedTimetable & {
		profile?: Awaited<ReturnType<typeof stageTimetableImport>>['profile'];
	};

	let source = '';
	let sourceKind: SourceKind = 'student-2024';
	let result: Prepared | undefined;
	let sourceIsSample = false;
	let errorMessage = '';
	let busy = false;
	let syncingGoogle = false;
	let googleMessage = '';
	let googleResult: SyncResult | undefined;
	let calendarExportMessage = '';
	let extensionHandoffMessage = '';
	let extensionConnectionState: 'checking' | 'connected' | 'missing' = 'checking';
	let courseColorPreferences = defaultCourseColorPreferences();
	let courseColorAssignments: Record<string, string> = {};
	let courseAppearanceSummary: CourseAppearanceSummary[] = [];

	const googleClientId = env.PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';
	const sourceDescriptions: Record<SourceKind, string> = {
		'student-2024': 'MyBK mới · mybk.hcmut.edu.vn/app',
		'student-legacy': 'MyBK cũ · mybk.hcmut.edu.vn/stinfo',
		lecturer: 'Lịch giảng viên · tkb.hcmut.edu.vn',
		postgraduate: 'Lịch sau đại học · grad.hcmut.edu.vn'
	};
	$: selectedSourceDescription = sourceDescriptions[sourceKind];

	onMount(() => {
		const targetWindow = window as unknown as ExtensionMessageWindow;
		const unsubscribe = subscribeToExtensionState(targetWindow, (state) => {
			extensionConnectionState = 'connected';
			void applyExtensionState(state);
		});
		void receiveExtensionSnapshot();
		void receiveExtensionState();
		return unsubscribe;
	});

	async function receiveExtensionState(): Promise<void> {
		try {
			const response = await requestExtensionStateFromExtension({
				targetWindow: window as unknown as ExtensionMessageWindow
			});
			if (response.status === 'ready') {
				extensionConnectionState = 'connected';
				await applyExtensionState(response.state);
			} else if (response.status === 'empty') {
				extensionConnectionState = 'connected';
			} else {
				extensionConnectionState = 'missing';
			}
		} catch {
			extensionConnectionState = 'missing';
		}
	}

	async function applyExtensionState(state: ExtensionState): Promise<void> {
		for (const [key, preferences] of Object.entries(state.appearances)) {
			if (key.startsWith('bkalendar-next:course-colors:')) {
				window.localStorage.setItem(key, JSON.stringify(preferences));
			}
		}
		if (state.theme) {
			window.localStorage.setItem('bkalendar-next:theme', state.theme);
			if (state.resolvedTheme) {
				window.localStorage.setItem('bkalendar-next:theme-resolved', state.resolvedTheme);
			}
			window.dispatchEvent(
				new CustomEvent('bkalendar:theme-updated', {
					detail: { preference: state.theme, resolvedTheme: state.resolvedTheme }
				})
			);
		}
		const store = createProfileStore(createBrowserStorage(window.localStorage));
		const orderedProfiles = [...state.profiles].sort(
			(left, right) => timestamp(right.lastCheckedAt) - timestamp(left.lastCheckedAt)
		);
		for (const profile of orderedProfiles) {
			if (!profile.pendingSnapshot && !profile.acceptedSnapshot) continue;
			const existing = await store.get(profile.profileId);
			if (existing && timestamp(existing.lastCheckedAt) > timestamp(profile.lastCheckedAt)) {
				continue;
			}
			await store.save(profile);
		}

		const newest = orderedProfiles.find(
			(profile) => profile.pendingSnapshot || profile.acceptedSnapshot
		);
		const snapshot = newest?.pendingSnapshot ?? newest?.acceptedSnapshot;
		if (!newest || !snapshot || snapshot.provenance === 'sample') return;
		const syncedProfile = await store.get(newest.profileId);
		if (!syncedProfile) return;
		result = {
			profileId: newest.profileId,
			snapshot,
			diff: diffSnapshots(newest.acceptedSnapshot, snapshot),
			profile: syncedProfile
		};
		sourceKind = snapshot.sourceKind;
		loadCourseAppearance(result, false);
		if (state.status.state === 'error') {
			extensionHandoffMessage = state.status.message;
		}
	}

	async function receiveExtensionSnapshot(): Promise<void> {
		if (new URLSearchParams(window.location.search).get('from') !== 'extension') return;
		extensionHandoffMessage = 'Đang nhận thời khóa biểu đã chụp từ extension…';

		try {
			const response = await requestPendingSnapshotFromExtension({
				targetWindow: window as unknown as ExtensionMessageWindow
			});
			if (response.status === 'ready') {
				const store = createProfileStore(createBrowserStorage(window.localStorage));
				result = await stageTransferredSnapshot(store, response.snapshot);
				sourceKind = response.snapshot.sourceKind;
				loadCourseAppearance(result, false);
				extensionHandoffMessage =
					'Đã nhận thời khóa biểu từ extension. Hãy xem lại thay đổi trước khi chọn nơi đồng bộ.';
			} else if (response.status === 'empty') {
				extensionHandoffMessage =
					'Extension đang hoạt động nhưng chưa có thời khóa biểu chờ xem lại. Hãy mở trang TKB MyBK trước.';
			} else if (response.status === 'timeout') {
				extensionHandoffMessage =
					'Không nhận được dữ liệu từ extension. Hãy kiểm tra extension đã được bật rồi thử lại.';
			}
		} catch (error) {
			extensionHandoffMessage =
				error instanceof Error
					? `Không thể nhận dữ liệu từ extension: ${error.message}`
					: 'Không thể nhận dữ liệu từ extension.';
		}
	}

	function timestamp(value: string | undefined): number {
		if (!value) return 0;
		const parsed = Date.parse(value);
		return Number.isNaN(parsed) ? 0 : parsed;
	}

	async function importTimetable(): Promise<void> {
		errorMessage = '';
		if (source.trim() === '') {
			errorMessage = 'Hãy dán bảng thời khóa biểu từ nguồn đã chọn trước khi tiếp tục.';
			return;
		}

		busy = true;
		try {
			if (sourceIsSample) {
				result = await prepareTimetable(source, undefined, {
					capturedAt: new Date().toISOString(),
					completeness: inferCaptureCompleteness(source, sourceKind),
					sourceKind,
					provenance: 'sample'
				});
				loadCourseAppearance(result, false);
			} else {
				const store = createProfileStore(createBrowserStorage(window.localStorage));
				result = await stageTimetableImport(store, source, {
					capturedAt: new Date().toISOString(),
					completeness: inferCaptureCompleteness(source, sourceKind),
					sourceKind,
					provenance: 'user'
				});
				loadCourseAppearance(result, true);
				if (result.profile) {
					publishProfileToExtension({
						targetWindow: window as unknown as ExtensionMessageWindow,
						profile: result.profile
					});
				}
			}
		} catch (error) {
			errorMessage =
				error instanceof Error
					? error.message
					: 'Không thể đọc thời khóa biểu. Hãy kiểm tra lại dữ liệu đã dán.';
		} finally {
			busy = false;
		}
	}

	function useSample(): void {
		sourceKind = 'student-2024';
		source = sample;
		sourceIsSample = true;
		result = undefined;
		courseColorPreferences = defaultCourseColorPreferences();
		courseColorAssignments = {};
		errorMessage = '';
	}

	function changeSourceKind(): void {
		result = undefined;
		sourceIsSample = false;
		errorMessage = '';
		courseColorPreferences = defaultCourseColorPreferences();
		courseColorAssignments = {};
		courseAppearanceSummary = [];
	}

	function loadCourseAppearance(prepared: Prepared, publish = true): void {
		courseColorPreferences =
			prepared.snapshot.provenance === 'sample'
				? defaultCourseColorPreferences()
				: createCourseColorStore(window.localStorage).load(prepared.profileId);
		courseColorAssignments = buildCourseColorAssignments(
			prepared.snapshot.events,
			courseColorPreferences
		);
		courseAppearanceSummary = summarizeCourseAppearances(
			prepared.snapshot.events,
			courseColorPreferences
		);
		if (publish && prepared.snapshot.provenance !== 'sample') {
			publishCourseAppearanceToExtension({
				targetWindow: window as unknown as ExtensionMessageWindow,
				profileId: prepared.profileId,
				preferences: courseColorPreferences
			});
		}
	}

	async function updateCourseAppearance(preferences: CourseColorPreferences): Promise<void> {
		courseColorPreferences = preferences;
		if (!result) return;
		courseColorAssignments = buildCourseColorAssignments(result.snapshot.events, preferences);
		courseAppearanceSummary = summarizeCourseAppearances(result.snapshot.events, preferences);
		if (result.snapshot.provenance !== 'sample') {
			createCourseColorStore(window.localStorage).save(result.profileId, preferences);
			publishCourseAppearanceToExtension({
				targetWindow: window as unknown as ExtensionMessageWindow,
				profileId: result.profileId,
				preferences
			});
			const store = createProfileStore(createBrowserStorage(window.localStorage));
			result = await stageTransferredSnapshot(store, result.snapshot);
		}
	}

	async function downloadIcalendar(): Promise<void> {
		if (!result || result.snapshot.provenance === 'sample') return;
		calendarExportMessage = '';
		const calendarName = `BKalendar • HK ${result.snapshot.semester}`;
		const events = colorizeEventsForSync(
			result.snapshot.events,
			courseColorAssignments,
			courseColorPreferences.icons
		);
		const file = createIcalendarExport({ ...result.snapshot, events }, calendarName);
		try {
			const action = await triggerIcalendarDownload(file);
			calendarExportMessage =
				action === 'shared' ? 'Đã mở bảng chia sẻ file lịch.' : 'Đã tạo file .ics để tải xuống.';
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return;
			calendarExportMessage = error instanceof Error ? error.message : 'Không thể xuất file lịch.';
		}
	}

	async function syncGoogleCalendar(): Promise<void> {
		if (!result || result.snapshot.provenance === 'sample' || syncingGoogle) return;
		googleMessage = '';
		googleResult = undefined;
		if (!googleClientId) {
			googleMessage =
				'Chưa cấu hình Google OAuth client ID. Hãy xem .env.example trước khi chạy ứng dụng.';
			return;
		}

		syncingGoogle = true;
		const issuedTokens = new Set<string>();
		try {
			const identity = await loadGoogleIdentity();
			const store = createProfileStore(createBrowserStorage(window.localStorage));
			const synced = await syncWithGoogleReauth({
				async requestToken() {
					const token = await requestGoogleAccessToken(identity, googleClientId);
					issuedTokens.add(token);
					return token;
				},
				async run(accessToken) {
					const attempt = await syncPendingProfile(store, result!.profileId, {
						gateway: new GoogleCalendarRestGateway(accessToken),
						findCalendars: async (summary) =>
							await findManagedCalendars(fetch, accessToken, summary),
						findLegacyCalendars: async (sourceKind, semester) =>
							await findLegacyCalendars(fetch, accessToken, sourceKind, semester),
						createCalendar: async (summary) =>
							await createManagedCalendar(fetch, accessToken, summary),
						prepareEvents: (events) =>
							colorizeEventsForSync(events, courseColorAssignments, courseColorPreferences.icons),
						onProgress(progress) {
							googleResult = { ...progress, failed: [...progress.failed] };
						}
					});
					const authFailure = attempt.result.failed.find((failure) =>
						isGoogleCalendarAuthError(new Error(failure.message))
					);
					if (authFailure) throw new Error(authFailure.message);
					return attempt;
				},
				onReauth() {
					googleMessage = 'Phiên Google đã hết hạn. BKalendar đang yêu cầu đăng nhập Google lại…';
				},
				async beforeRetry() {
					const oldToken = [...issuedTokens].at(-1);
					if (!oldToken) return;
					try {
						await revokeGoogleAccessToken(oldToken);
					} catch {
						// Revocation is best-effort; requesting a fresh interactive token is mandatory.
					}
				}
			});
			googleResult = synced.result;
			result = { ...result, profile: synced.profile };
			publishProfileToExtension({
				targetWindow: window as unknown as ExtensionMessageWindow,
				profile: synced.profile
			});
			googleMessage =
				synced.result.failed.length > 0
					? `Có ${synced.result.failed.length} thao tác chưa thành công. Snapshot vẫn đang chờ để thử lại.`
					: synced.promoted
						? 'Đã đồng bộ và lưu bản thời khóa biểu này làm mốc so sánh.'
						: 'Đã cập nhật các mục an toàn. Phần có thể đã xóa vẫn bị chặn vì dữ liệu chưa đầy đủ.';
		} catch (error) {
			googleMessage = error instanceof Error ? error.message : 'Không thể đồng bộ Google Calendar.';
		} finally {
			for (const accessToken of issuedTokens) {
				try {
					await revokeGoogleAccessToken(accessToken);
				} catch {
					// The short-lived token remains memory-only and will expire even if revocation fails.
				}
			}
			syncingGoogle = false;
		}
	}
</script>

<svelte:head>
	<title>BKalendar Next · Lịch học HCMUT dễ kiểm tra</title>
</svelte:head>

<header class="site-header">
	<a class="brand" href={`${base}/`} aria-label="BKalendar Next">
		<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
		<span>BKalendar</span>
	</a>
	<div class="site-header-actions">
		<p>Dữ liệu chỉ được xử lý trên thiết bị của bạn</p>
		<ThemeSwitcher />
	</div>
</header>

<main>
	<section class="intro">
		<div>
			<h1>Biến thời khóa biểu MyBK thành lịch bạn có thể tin tưởng.</h1>
			<p>
				Dán dữ liệu, xem lại từng buổi học và kiểm tra thay đổi trước khi xuất lịch. BKalendar không
				lưu mật khẩu, cookie hay token Google.
			</p>
		</div>
		<ol class="steps" aria-label="Quy trình">
			<li class="active"><span>01</span>Dán lịch</li>
			<li class:active={result !== undefined}><span>02</span>Xem lại</li>
			<li class:active={result !== undefined}><span>03</span>So sánh</li>
			<li><span>04</span>Chọn đích</li>
		</ol>
	</section>

	<section id="extension-intro" class="extension-intro" aria-labelledby="extension-intro-title">
		<div class="extension-intro-copy">
			<div class="extension-kicker">
				<span class="section-number">EXT</span>
				<span class="extension-status">Chrome · Edge · MV3</span>
			</div>
			<h2 id="extension-intro-title">Theo dõi MyBK tự động</h2>
			<p>
				Cài extension BKalendar để kiểm tra thời khóa biểu nền và tự cập nhật Google Calendar khi
				MyBK thay đổi — không cần sao chép lại mỗi lần.
			</p>
			<div
				class="extension-connection"
				data-state={extensionConnectionState}
				role="status"
				aria-live="polite"
			>
				<span aria-hidden="true"></span>
				{extensionConnectionState === 'checking'
					? 'Đang kiểm tra extension…'
					: extensionConnectionState === 'connected'
						? 'Extension đã kết nối cục bộ'
						: 'Chưa phát hiện extension'}
			</div>
			<div class="extension-sync-overview" aria-label="Dữ liệu đồng bộ với extension">
				<div>
					<strong>Web → Extension</strong>
					<span>Màu môn học, icon sự kiện, hồ sơ lịch và Calendar ID</span>
				</div>
				<div>
					<strong>Extension → Web</strong>
					<span>TKB MyBK mới nhất, diff thay đổi và trạng thái đồng bộ</span>
				</div>
			</div>
			{#if extensionConnectionState === 'connected'}
				<div class="extension-synced-courses">
					<strong>Đã đồng bộ sang extension</strong>
					{#if courseAppearanceSummary.length > 0}
						<div>
							{#each courseAppearanceSummary as appearance (appearance.course)}
								<span
									class="extension-synced-course"
									style={`--course-color: ${appearance.background}`}
								>
									<i aria-hidden="true"></i>
									<b>{appearance.icon || '•'} {appearance.courseCode}</b>
									<small>{appearance.colorName}</small>
								</span>
							{/each}
						</div>
					{:else}
						<p>Chưa có cấu hình màu và icon môn học để đồng bộ.</p>
					{/if}
				</div>
			{/if}
			{#if extensionConnectionState === 'missing'}
				<a
					class="extension-cta"
					href="https://github.com/canar1406/bk-calendar-next"
					target="_blank"
					rel="noreferrer"
				>
					Cài extension
					<span aria-hidden="true">↗</span>
				</a>
			{/if}
		</div>
		<div class="extension-benefits">
			<div>
				<strong>Tự động cập nhật Google Calendar</strong>
				<span>Patch đúng lịch BKalendar, không tạo bản sao mỗi lần kiểm tra.</span>
			</div>
			<div>
				<strong>Không gửi mật khẩu lên máy chủ BKalendar</strong>
				<span
					>Nếu bật theo dõi nền, thông tin đăng nhập được mã hóa và giữ trên thiết bị của bạn.</span
				>
			</div>
			<div>
				<strong>Bạn luôn kiểm soát</strong>
				<span>Chọn tắt theo dõi, xem diff, hoặc chỉ nhận thông báo sau khi cập nhật.</span>
			</div>
		</div>
	</section>

	<p class="extension-handoff-message" role="status" aria-live="polite" aria-atomic="true">
		{extensionHandoffMessage}
	</p>

	<section class="import-section" aria-labelledby="import-title">
		<div class="section-heading">
			<div>
				<p class="section-number">01</p>
				<h2 id="import-title">Dán thời khóa biểu</h2>
			</div>
			<button class="text-button" type="button" on:click={useSample}>Dùng dữ liệu mẫu</button>
		</div>

		<form on:submit|preventDefault={importTimetable}>
			<label class="source-kind-field" for="schedule-source">
				<span>Loại lịch</span>
				<select id="schedule-source" bind:value={sourceKind} on:change={changeSourceKind}>
					<option value="student-2024">Sinh viên (mybk.hcmut.edu.vn/app)</option>
					<option value="student-legacy">Sinh viên (mybk.hcmut.edu.vn/stinfo)</option>
					<option value="lecturer">Giảng viên (tkb.hcmut.edu.vn)</option>
					<option value="postgraduate">Sau đại học (grad.hcmut.edu.vn)</option>
				</select>
				<small>Chọn đúng nguồn để BKalendar dùng parser và cấu trúc tuần học tương ứng.</small>
			</label>
			<label for="timetable-source">Nội dung sao chép từ bảng thời khóa biểu</label>
			<p class="source-kind-current">{selectedSourceDescription}</p>
			<textarea
				id="timetable-source"
				bind:value={source}
				on:input={() => (sourceIsSample = false)}
				rows="10"
				placeholder={`Sao chép toàn bộ bảng từ ${selectedSourceDescription} rồi dán vào đây…`}
				spellcheck="false"></textarea>
			<div class="form-footer">
				<p>Không dán tên đăng nhập, mật khẩu, cookie hoặc token.</p>
				<button class="primary-button" type="submit" disabled={busy}>
					{busy ? 'Đang đọc lịch…' : 'Đọc thời khóa biểu'}
				</button>
			</div>
		</form>
		<p class="error" aria-live="polite">{errorMessage}</p>
		{#if result?.snapshot.provenance === 'sample'}
			<p class="sample-warning" role="status">
				Đây là dữ liệu minh họa. BKalendar không lưu, đồng bộ Google hoặc xuất file lịch từ dữ liệu
				này.
			</p>
		{/if}
	</section>

	{#if result}
		<section class="snapshot-summary" aria-label="Tóm tắt thời khóa biểu">
			<div><span>Học kỳ</span><strong>{result.snapshot.semester}</strong></div>
			<div><span>Buổi học</span><strong>{result.snapshot.events.length}</strong></div>
			<div>
				<span>Cập nhật nguồn</span>
				<strong>{result.snapshot.sourceUpdatedAt?.slice(0, 10) ?? 'Không rõ'}</strong>
			</div>
			<div><span>Profile</span><strong>{result.profileId}</strong></div>
		</section>

		<ScheduleBoard
			events={result.snapshot.events}
			colorAssignments={courseColorAssignments}
			courseIcons={courseColorPreferences.icons}
		/>
		<CourseColorPicker
			events={result.snapshot.events}
			preferences={courseColorPreferences}
			onChange={updateCourseAppearance}
		/>
		<ChangeSummary diff={result.diff} />

		<section class="destination" aria-labelledby="destination-title">
			<div class="section-heading">
				<div>
					<p class="section-number">04</p>
					<h2 id="destination-title">Đưa lịch tới nơi bạn dùng</h2>
				</div>
			</div>
			<div class="destination-options">
				<div>
					<h3>Google Calendar</h3>
					<p>Đồng bộ có xác nhận và cập nhật đúng các sự kiện do BKalendar quản lý.</p>
					<button
						class="google-button"
						type="button"
						disabled={syncingGoogle || result.snapshot.provenance === 'sample'}
						on:click={syncGoogleCalendar}
					>
						{result.snapshot.provenance === 'sample'
							? 'Không thể đồng bộ dữ liệu mẫu'
							: syncingGoogle
								? 'Đang đồng bộ…'
								: 'Xác nhận và đồng bộ Google'}
					</button>
					{#if googleResult}
						<p class="sync-counts">
							Thêm {googleResult.inserted} · Sửa {googleResult.patched} · Xóa
							{googleResult.deleted} · Chặn xóa {googleResult.skippedDeletes} · Không đổi
							{googleResult.unchanged}
						</p>
					{/if}
					<p class="sync-message" aria-live="polite">{googleMessage}</p>
				</div>
				<div>
					<h3>Apple Calendar và ứng dụng khác</h3>
					<p>Tải file một lần; thay đổi sau này không tự cập nhật.</p>
					<button
						class="secondary-button"
						type="button"
						disabled={result.snapshot.provenance === 'sample'}
						on:click={downloadIcalendar}
					>
						{result.snapshot.provenance === 'sample'
							? 'Không thể xuất dữ liệu mẫu'
							: 'Tải file .ics'}
					</button>
					<p class="sync-message" aria-live="polite">{calendarExportMessage}</p>
				</div>
			</div>
		</section>
	{/if}
</main>

<footer>
	<p>BKalendar Next · Local-first · Asia/Ho_Chi_Minh</p>
	<p>
		Dev by
		<a href="https://home.heavietnam.com" target="_blank" rel="noreferrer">Heavn</a>
	</p>
</footer>
