<script lang="ts">
	import { base } from '$app/paths';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import {
		GoogleCalendarRestGateway,
		createManagedCalendar,
		requestGoogleAccessToken,
		revokeGoogleAccessToken,
		type SyncResult
	} from '../../../../packages/google-calendar/src/index.ts';
	import {
		createBrowserStorage,
		createProfileStore
	} from '../../../../packages/timetable/src/storage.ts';
	import ChangeSummary from '$lib/components/ChangeSummary.svelte';
	import ScheduleBoard from '$lib/components/ScheduleBoard.svelte';
	import {
		requestPendingSnapshotFromExtension,
		type ExtensionMessageWindow
	} from '$lib/extension-handoff.ts';
	import { loadGoogleIdentity } from '$lib/google-identity.ts';
	import { syncPendingProfile } from '$lib/google-sync.ts';
	import { createIcalendarExport, triggerIcalendarDownload } from '$lib/ical-download.ts';
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
	let result: Prepared | undefined;
	let sourceIsSample = false;
	let errorMessage = '';
	let busy = false;
	let syncingGoogle = false;
	let googleMessage = '';
	let googleResult: SyncResult | undefined;
	let calendarExportMessage = '';
	let extensionHandoffMessage = '';

	const googleClientId = env.PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

	onMount(() => {
		void receiveExtensionSnapshot();
	});

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

	async function importTimetable(): Promise<void> {
		errorMessage = '';
		if (source.trim() === '') {
			errorMessage = 'Hãy dán bảng thời khóa biểu từ MyBK trước khi tiếp tục.';
			return;
		}

		busy = true;
		try {
			if (sourceIsSample) {
				result = await prepareTimetable(source, undefined, {
					capturedAt: new Date().toISOString(),
					completeness: inferCaptureCompleteness(source),
					provenance: 'sample'
				});
			} else {
				const store = createProfileStore(createBrowserStorage(window.localStorage));
				result = await stageTimetableImport(store, source, {
					capturedAt: new Date().toISOString(),
					completeness: inferCaptureCompleteness(source),
					provenance: 'user'
				});
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
		source = sample;
		sourceIsSample = true;
		result = undefined;
		errorMessage = '';
	}

	async function downloadIcalendar(): Promise<void> {
		if (!result || result.snapshot.provenance === 'sample') return;
		calendarExportMessage = '';
		const calendarName = `BKalendar • HK ${result.snapshot.semester}`;
		const file = createIcalendarExport(result.snapshot, calendarName);
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
		let accessToken = '';
		try {
			const identity = await loadGoogleIdentity();
			accessToken = await requestGoogleAccessToken(identity, googleClientId);
			const store = createProfileStore(createBrowserStorage(window.localStorage));
			const synced = await syncPendingProfile(store, result.profileId, {
				gateway: new GoogleCalendarRestGateway(accessToken),
				createCalendar: async (summary) => await createManagedCalendar(fetch, accessToken, summary),
				onProgress(progress) {
					googleResult = { ...progress, failed: [...progress.failed] };
				}
			});
			googleResult = synced.result;
			result = { ...result, profile: synced.profile };
			googleMessage =
				synced.result.failed.length > 0
					? `Có ${synced.result.failed.length} thao tác chưa thành công. Snapshot vẫn đang chờ để thử lại.`
					: synced.promoted
						? 'Đã đồng bộ và lưu bản thời khóa biểu này làm mốc so sánh.'
						: 'Đã cập nhật các mục an toàn. Phần có thể đã xóa vẫn bị chặn vì dữ liệu chưa đầy đủ.';
		} catch (error) {
			googleMessage = error instanceof Error ? error.message : 'Không thể đồng bộ Google Calendar.';
		} finally {
			if (accessToken) {
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
	<p>Dữ liệu chỉ được xử lý trên thiết bị của bạn</p>
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
			<label for="timetable-source">Nội dung sao chép từ bảng thời khóa biểu MyBK</label>
			<textarea
				id="timetable-source"
				bind:value={source}
				on:input={() => (sourceIsSample = false)}
				rows="10"
				placeholder="Sao chép toàn bộ bảng trên MyBK rồi dán vào đây…"
				spellcheck="false"></textarea>
			<div class="form-footer">
				<p>Không dán tên đăng nhập, mật khẩu hoặc cookie MyBK.</p>
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
				<span>Cập nhật MyBK</span>
				<strong>{result.snapshot.sourceUpdatedAt?.slice(0, 10) ?? 'Không rõ'}</strong>
			</div>
			<div><span>Profile</span><strong>{result.profileId}</strong></div>
		</section>

		<ScheduleBoard events={result.snapshot.events} />
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
</footer>
