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
		clearGoogleAccessToken,
		type SyncResult
	} from '../../../../packages/google-calendar/src/index.ts';
	import {
		createBrowserStorage,
		createProfileStore
	} from '../../../../packages/timetable/src/storage.ts';
	import {
		diffSnapshots,
		type ScheduleKind,
		type SourceKind
	} from '../../../../packages/timetable/src/index.ts';
	import { looksLikeExamSource } from '../../../../packages/core/src/index.ts';
	import ChangeSummary from '$lib/components/ChangeSummary.svelte';
	import CourseColorPicker from '$lib/components/CourseColorPicker.svelte';
	import ScheduleBoard from '$lib/components/ScheduleBoard.svelte';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
	import WallpaperExport from '$lib/components/WallpaperExport.svelte';
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
	import {
		createIcalendarExport,
		triggerIcalendarDownload,
		shareIcalendarFile
	} from '$lib/ical-download.ts';
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

	const examSample = `Học kỳ 1 Năm học 2026 - 2027
Mã MH\tTên môn học\tNhóm - tổ\tNgày thi\tGiờ thi\tSố phút\tPhòng thi\tLoại thi
DEMO1001\tMôn minh họa 1\tDEMO-A\t20/12/2026\t07:30\t90\tPHÒNG-DEMO-1\tCuối kỳ
DEMO1002\tMôn minh họa 2\tDEMO-B\t22/12/2026\t13:00\t120\tPHÒNG-DEMO-2\tCuối kỳ
Trình bày từ dòng 1 đến 2 / 2 dòng`;

	type Prepared = PreparedTimetable & {
		profile?: Awaited<ReturnType<typeof stageTimetableImport>>['profile'];
	};

	let source = '';
	let sourceKind: SourceKind = 'student-2024';
	let scheduleKind: ScheduleKind | 'auto' = 'auto';
	let semesterOverride = '';
	let selectedWeekKey = '';
	let result: Prepared | undefined;
	let sourceIsSample = false;
	let errorMessage = '';
	let busy = false;
	let clientReady = false;
	let syncingGoogle = false;
	let googleMessage = '';
	let googleResult: SyncResult | undefined;
	let calendarExportMessage = '';
	let extensionHandoffMessage = '';
	let extensionConnectionState: 'checking' | 'connected' | 'missing' = 'checking';
	let courseColorPreferences = defaultCourseColorPreferences();
	let courseColorAssignments: Record<string, string> = {};
	let courseAppearanceSummary: CourseAppearanceSummary[] = [];

	const googleClientId =
		env.PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
		'937100842777-d5d9ug5hi8ka60bnkkjv5e62ip7e2dre.apps.googleusercontent.com';
	const sourceDescriptions: Record<SourceKind, string> = {
		'student-2024': 'MyBK mới · mybk.hcmut.edu.vn/app',
		'student-legacy': 'MyBK cũ · mybk.hcmut.edu.vn/stinfo',
		lecturer: 'Lịch giảng viên · tkb.hcmut.edu.vn',
		postgraduate: 'Lịch sau đại học · grad.hcmut.edu.vn'
	};
	$: selectedSourceDescription = sourceDescriptions[sourceKind];

	onMount(() => {
		clientReady = true;
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
		scheduleKind = snapshot.scheduleKind ?? 'classes';
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
				scheduleKind = response.snapshot.scheduleKind ?? 'classes';
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
			errorMessage =
				'Hãy dán bảng thời khóa biểu hoặc lịch thi từ nguồn đã chọn trước khi tiếp tục.';
			return;
		}

		busy = true;
		try {
			const detectedKind =
				scheduleKind === 'auto'
					? looksLikeExamSource(source)
						? 'exams'
						: 'classes'
					: scheduleKind;
			const semesterText = semesterOverride.trim();
			if (detectedKind === 'exams' && semesterText && !/^(?:20)?\d{2}[123]$/u.test(semesterText)) {
				throw new Error('Mã học kỳ không hợp lệ. Ví dụ: 261 hoặc 20261.');
			}
			const options = {
				capturedAt: new Date().toISOString(),
				completeness: inferCaptureCompleteness(source, sourceKind, detectedKind),
				sourceKind,
				scheduleKind: detectedKind,
				...(detectedKind === 'exams' && semesterText ? { semester: Number(semesterText) } : {})
			};
			googleMessage = '';
			googleResult = undefined;
			calendarExportMessage = '';
			if (sourceIsSample) {
				result = await prepareTimetable(source, undefined, {
					...options,
					provenance: 'sample'
				});
				loadCourseAppearance(result, false);
			} else {
				const store = createProfileStore(createBrowserStorage(window.localStorage));
				result = await stageTimetableImport(store, source, {
					...options,
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
		source = scheduleKind === 'exams' ? examSample : sample;
		semesterOverride = '';
		sourceIsSample = true;
		result = undefined;
		courseColorPreferences = defaultCourseColorPreferences();
		courseColorAssignments = {};
		errorMessage = '';
	}

	function changeSourceKind(): void {
		result = undefined;
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

	async function downloadIcalendar(share = false): Promise<void> {
		if (!result || result.snapshot.provenance === 'sample') return;
		calendarExportMessage = '';
		try {
			const calendarName =
				result.profile?.calendarName ??
				`BKalendar • ${result.snapshot.scheduleKind === 'exams' ? 'Lịch thi • ' : ''}HK ${result.snapshot.semester}`;
			const events = colorizeEventsForSync(
				result.snapshot.events,
				courseColorAssignments,
				courseColorPreferences.icons
			);
			const file = createIcalendarExport({ ...result.snapshot, events }, calendarName);
			const action = await (share ? shareIcalendarFile(file) : triggerIcalendarDownload(file));
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
		const snapshotForSync = result.snapshot;
		const profileId = result.profileId;
		const colorsForSync = { ...courseColorAssignments };
		const iconsForSync = { ...courseColorPreferences.icons };
		try {
			const identity = await loadGoogleIdentity();
			const store = createProfileStore(createBrowserStorage(window.localStorage));
			await stageTransferredSnapshot(store, snapshotForSync);
			const synced = await syncWithGoogleReauth({
				async requestToken() {
					return await requestGoogleAccessToken(identity, googleClientId);
				},
				async run(accessToken) {
					const attempt = await syncPendingProfile(store, profileId, {
						gateway: new GoogleCalendarRestGateway(accessToken),
						findCalendars: async (summary) =>
							await findManagedCalendars(fetch, accessToken, summary),
						findLegacyCalendars: async (sourceKind, semester) =>
							await findLegacyCalendars(fetch, accessToken, sourceKind, semester),
						createCalendar: async (summary) =>
							await createManagedCalendar(fetch, accessToken, summary),
						prepareEvents: (events) => colorizeEventsForSync(events, colorsForSync, iconsForSync),
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
				beforeRetry() {
					clearGoogleAccessToken(identity, googleClientId);
				}
			});
			googleResult = synced.result;
			if (result?.snapshot === snapshotForSync) {
				result = { ...result, profile: synced.profile };
			}
			publishProfileToExtension({
				targetWindow: window as unknown as ExtensionMessageWindow,
				profile: synced.profile
			});
			const firstFailedReason = synced.result.failed[0]?.message;
			googleMessage =
				synced.result.failed.length > 0
					? `Có ${synced.result.failed.length} thao tác chưa thành công. Snapshot vẫn đang chờ để thử lại.${firstFailedReason ? ` (${firstFailedReason})` : ''}`
					: synced.promoted
						? 'Đã đồng bộ và lưu bản lịch này làm mốc so sánh.'
						: 'Đã cập nhật các mục an toàn. Phần có thể đã xóa vẫn bị chặn vì dữ liệu chưa đầy đủ.';
		} catch (error) {
			googleMessage = error instanceof Error ? error.message : 'Không thể đồng bộ Google Calendar.';
		} finally {
			syncingGoogle = false;
		}
	}
</script>

<svelte:head>
	<title>BKalendar Next · Lịch học và lịch thi HCMUT</title>
</svelte:head>

<header class="site-header">
	<a class="brand" href={`${base}/`} aria-label="BKalendar Next">
		<span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
		<span>BKalendar Next</span>
	</a>
	<div class="site-header-actions">
		<p>Dữ liệu chỉ được xử lý trên thiết bị của bạn</p>
		<ThemeSwitcher />
	</div>
</header>

<main>
	<section class="intro">
		<div>
			<h1>Lịch học, lịch thi. Gọn trên mọi màn hình.</h1>
			<p>
				Dán dữ liệu MyBK, xem lại thay đổi rồi đồng bộ Google, tải .ics hoặc tạo hình nền PNG.
				Website không lưu mật khẩu, cookie hay token Google vào bộ nhớ lâu dài.
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
				<h2 id="import-title">Dán lịch học hoặc lịch thi</h2>
			</div>
			<button class="text-button" type="button" disabled={!clientReady} on:click={useSample}
				>Dùng dữ liệu mẫu</button
			>
		</div>

		<form on:submit|preventDefault={importTimetable}>
			<div class="import-options">
				<label class="source-kind-field" for="schedule-kind">
					<span>Nội dung lịch</span>
					<select id="schedule-kind" bind:value={scheduleKind} on:change={changeSourceKind}>
						<option value="auto">Tự nhận diện lịch học / lịch thi</option>
						<option value="classes">Thời khóa biểu môn học</option>
						<option value="exams">Lịch thi</option>
					</select>
					<small>Lịch thi có ngày cụ thể, không lặp lại hằng tuần.</small>
				</label>
				{#if scheduleKind !== 'classes'}
					<label class="source-kind-field" for="exam-semester">
						<span>Học kỳ của lịch thi (nếu bảng thiếu tiêu đề)</span>
						<input
							id="exam-semester"
							type="text"
							inputmode="numeric"
							maxlength="5"
							bind:value={semesterOverride}
							placeholder="Ví dụ: 261 · Bỏ trống để tự đọc"
						/>
						<small>Không cần nhập nếu đã sao chép tiêu đề học kỳ.</small>
					</label>
				{/if}
			</div>
			<label class="source-kind-field" for="schedule-source">
				<span>Nguồn dữ liệu</span>
				<select id="schedule-source" bind:value={sourceKind} on:change={changeSourceKind}>
					<option value="student-2024">Sinh viên (mybk.hcmut.edu.vn/app)</option>
					<option value="student-legacy">Sinh viên (mybk.hcmut.edu.vn/stinfo)</option>
					<option value="lecturer">Giảng viên (tkb.hcmut.edu.vn)</option>
					<option value="postgraduate">Sau đại học (grad.hcmut.edu.vn)</option>
				</select>
				<small>Chọn đúng nguồn để BKalendar dùng parser và cấu trúc tuần học tương ứng.</small>
			</label>
			<label for="timetable-source">Nội dung sao chép từ bảng lịch (kèm tiêu đề cột)</label>
			<p class="source-kind-current">{selectedSourceDescription}</p>
			{#if scheduleKind !== 'classes'}
				<p class="import-help">
					Lịch thi: tên môn · ngày thi · giờ thi · số phút hoặc giờ kết thúc · phòng. Chấp nhận ngày
					DD/MM/YYYY hoặc YYYY-MM-DD; giữ các cột phân cách bằng tab khi sao chép.
				</p>
			{/if}
			<textarea
				id="timetable-source"
				disabled={!clientReady}
				bind:value={source}
				on:input={() => (sourceIsSample = false)}
				rows="10"
				placeholder={`Sao chép toàn bộ bảng từ ${selectedSourceDescription} rồi dán vào đây…`}
				spellcheck="false"></textarea>
			<div class="form-footer">
				<p>Không dán tên đăng nhập, mật khẩu, cookie hoặc token.</p>
				<button class="primary-button" type="submit" disabled={busy || !clientReady}>
					{busy ? 'Đang đọc lịch…' : 'Đọc lịch'}
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
			<div>
				<span>{result.snapshot.scheduleKind === 'exams' ? 'Ca thi' : 'Buổi học'}</span><strong
					>{result.snapshot.events.length}</strong
				>
			</div>
			<div>
				<span>Cập nhật nguồn</span>
				<strong>{result.snapshot.sourceUpdatedAt?.slice(0, 10) ?? 'Không rõ'}</strong>
			</div>
			<div><span>Profile</span><strong>{result.profileId}</strong></div>
		</section>

		{#if result.snapshot.warnings.length > 0}
			<div class="import-warnings" role="status">
				<strong>Cần kiểm tra dữ liệu</strong>
				<ul>
					{#each result.snapshot.warnings as warning}<li>{warning}</li>{/each}
				</ul>
			</div>
		{/if}
		<ScheduleBoard
			events={result.snapshot.events}
			colorAssignments={courseColorAssignments}
			courseIcons={courseColorPreferences.icons}
			scheduleKind={result.snapshot.scheduleKind ?? 'classes'}
			bind:selectedWeekKey
		/>
		<CourseColorPicker
			events={result.snapshot.events}
			preferences={courseColorPreferences}
			onChange={updateCourseAppearance}
		/>
		<ChangeSummary diff={result.diff} />

		<WallpaperExport
			snapshot={result.snapshot}
			weekKey={selectedWeekKey}
			colorAssignments={courseColorAssignments}
			courseIcons={courseColorPreferences.icons}
		/>

		<section class="destination" aria-labelledby="destination-title">
			<div class="section-heading">
				<div>
					<p class="section-number">04</p>
					<h2 id="destination-title">Đưa lịch tới nơi bạn dùng</h2>
				</div>
			</div>
			<div class="destination-options">
				<div>
					<h3>Google Calendar (@hcmut.edu.vn)</h3>
					<p>
						Đồng bộ bằng tài khoản Google Bách Khoa (<code>@hcmut.edu.vn</code>) và cập nhật đúng
						các sự kiện do BKalendar quản lý.
					</p>
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
					<details class="import-instructions">
						<summary>Google báo giới hạn đăng nhập?</summary>
						<p>
							Giới hạn người dùng OAuth khác với quota đồng bộ. Nếu gặp “Sign-in limit” hoặc “Access
							blocked”, mình phải kiểm tra Audience / Test users và Verification Center trong Google
							Cloud. Đăng nhập lại liên tục không gỡ được giới hạn này.
						</p>
						<p>
							Với lỗi quota tạm thời (429 / rateLimitExceeded), BKalendar thử lại có giới hạn; hãy
							đợi vài phút nếu vẫn bị chặn. Bạn vẫn có thể tải .ics hoặc PNG mà không đăng nhập.
						</p>
					</details>
				</div>
				<div>
					<h3>Apple Calendar / Google Calendar (.ics)</h3>
					<p>File chứa từng buổi theo ngày giờ cụ thể. Nhập một lần, không tự cập nhật.</p>
					<button
						class="secondary-button"
						type="button"
						disabled={result.snapshot.provenance === 'sample'}
						on:click={() => downloadIcalendar()}
					>
						{result.snapshot.provenance === 'sample'
							? 'Không thể xuất dữ liệu mẫu'
							: 'Tải file .ics'}
					</button>
					<button
						class="text-button"
						type="button"
						disabled={result.snapshot.provenance === 'sample'}
						on:click={() => downloadIcalendar(true)}
					>
						Chia sẻ file lịch
					</button>
					<p class="sync-message" aria-live="polite">{calendarExportMessage}</p>
					<details class="import-instructions">
						<summary>Cách nhập file .ics</summary>
						<p>
							Mac: mở Calendar → File → Import, chọn file và lịch đích. Google Calendar trên máy
							tính: Cài đặt → Nhập và xuất → Nhập, chọn file .ics.
						</p>
						<p>
							Trên iPhone, nút Chia sẻ chỉ mở bảng chia sẻ hệ thống nếu trình duyệt hỗ trợ; không
							đảm bảo có đích Calendar. Nếu Files / Safari không có nút thêm lịch, hãy nhập trên Mac
							cùng iCloud hoặc Google Calendar web rồi đồng bộ điện thoại.
						</p>
						<p>
							Không nhập cùng file nhiều lần để tránh bản sao. Đối chiếu múi giờ Việt Nam (UTC+07).
						</p>
					</details>
				</div>
			</div>
		</section>
	{/if}
</main>

<footer>
	<p>BKalendar Next · Local-first · Asia/Ho_Chi_Minh</p>
	<p>
		<a href={`${base}/privacy/`}>Chính sách quyền riêng tư</a>
		·
		<a href={`${base}/terms/`}>Điều khoản dịch vụ</a>
		· Dev by
		<a href="https://home.heavietnam.com" target="_blank" rel="noreferrer">Heavn</a>
	</p>
</footer>
