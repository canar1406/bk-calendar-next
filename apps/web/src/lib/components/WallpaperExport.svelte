<script lang="ts">
	import { base } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import type { TimetableSnapshot } from '../../../../../packages/timetable/src/index.ts';
	import {
		buildWallpaperModel,
		downloadWallpaper,
		getAvailableExamPhases,
		renderWallpaper,
		WALLPAPER_EXAM_PHASES,
		WALLPAPER_FORMATS,
		WALLPAPER_MASCOTS,
		WALLPAPER_MOTTOS,
		WALLPAPER_THEMES,
		type WallpaperExamPhase,
		type WallpaperMascot,
		type WallpaperModel,
		type WallpaperOptions,
		type WallpaperTheme
	} from '../wallpaper.ts';

	export let snapshot: TimetableSnapshot;
	export let weekKey = '';
	export let colorAssignments: Record<string, string> = {};
	export let courseIcons: Record<string, string> = {};

	let format: WallpaperOptions['format'] = 'desktop';
	let theme: WallpaperTheme = 'naruto';
	let mascot: WallpaperMascot = 'auto';
	let motto: string = WALLPAPER_MOTTOS[0];
	let examPhase: WallpaperExamPhase = 'midterm';
	let overlayOpacity = 0.32;
	let customBackground: HTMLImageElement | null = null;
	let customBackgroundWidth = 0;
	let customBackgroundHeight = 0;
	let customBackgroundName = '';
	let customObjectUrl = '';
	let fileInput: HTMLInputElement | undefined;
	const themeImageCache = new Map<string, HTMLImageElement>();

	$: availableExamPhases =
		snapshot.scheduleKind === 'exams' ? getAvailableExamPhases(snapshot.events) : [];
	$: if (
		snapshot.scheduleKind === 'exams' &&
		availableExamPhases.length > 0 &&
		!availableExamPhases.includes(examPhase)
	) {
		examPhase = availableExamPhases[0]!;
	}

	let canvas: HTMLCanvasElement;
	let mounted = false;
	let ready = false;
	let rendering = false;
	let message = '';
	let model: WallpaperModel | undefined;
	let revision = 0;

	onMount(() => {
		mounted = true;
		return () => {
			revision++;
		};
	});

	onDestroy(() => {
		if (customObjectUrl) URL.revokeObjectURL(customObjectUrl);
	});

	$: if (mounted && canvas) {
		void refresh(snapshot, {
			format,
			theme,
			mascot,
			motto,
			examPhase,
			overlayOpacity,
			customBackground,
			customBackgroundWidth,
			customBackgroundHeight,
			weekKey,
			colorAssignments,
			courseIcons
		});
	}

	async function handleBackgroundUpload(event: Event): Promise<void> {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (customObjectUrl) URL.revokeObjectURL(customObjectUrl);
		const nextUrl = URL.createObjectURL(file);
		customObjectUrl = nextUrl;
		try {
			const img = new Image();
			img.decoding = 'async';
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () => reject(new Error('Không thể đọc file ảnh đã chọn.'));
				img.src = nextUrl;
			});
			customBackground = img;
			customBackgroundWidth = img.naturalWidth || img.width;
			customBackgroundHeight = img.naturalHeight || img.height;
			customBackgroundName = file.name;
			message = `Đã áp dụng ảnh nền "${file.name}" ngay trên trình duyệt.`;
		} catch (error) {
			message = error instanceof Error ? error.message : 'Không thể tải ảnh nền.';
		}
	}

	function clearCustomBackground(): void {
		if (customObjectUrl) {
			URL.revokeObjectURL(customObjectUrl);
			customObjectUrl = '';
		}
		customBackground = null;
		customBackgroundWidth = 0;
		customBackgroundHeight = 0;
		customBackgroundName = '';
		if (fileInput) fileInput.value = '';
	}

	async function loadThemeWallpaper(themeKey: WallpaperTheme): Promise<HTMLImageElement | null> {
		const filename = WALLPAPER_THEMES[themeKey]?.wallpaperFile;
		if (!filename) return null;
		const cached = themeImageCache.get(filename);
		if (cached) return cached;
		const url = `${base}/wallpapers/${filename}`;
		const img = new Image();
		img.decoding = 'async';
		await new Promise<void>((resolve, reject) => {
			img.onload = () => resolve();
			img.onerror = () => reject(new Error(`Không thể tải ảnh nền chủ đề ${filename}`));
			img.src = url;
		});
		themeImageCache.set(filename, img);
		return img;
	}

	async function refresh(current: TimetableSnapshot, options: WallpaperOptions): Promise<void> {
		const version = ++revision;
		ready = false;
		message = '';
		if (current.provenance === 'sample') return;
		rendering = true;
		try {
			let resolvedOptions = { ...options };
			if (!resolvedOptions.customBackground) {
				try {
					const themeImg = await loadThemeWallpaper(resolvedOptions.theme ?? 'naruto');
					if (version !== revision) return;
					if (themeImg) {
						resolvedOptions = {
							...resolvedOptions,
							customBackground: themeImg,
							customBackgroundWidth: themeImg.naturalWidth || themeImg.width,
							customBackgroundHeight: themeImg.naturalHeight || themeImg.height
						};
					}
				} catch {
					// Fallback to theme gradient if image cannot be loaded
				}
			}
			const next = buildWallpaperModel(current, resolvedOptions);
			const draft = document.createElement('canvas');
			await renderWallpaper(draft, next);
			if (version !== revision) return;
			// Do not invalidate the bound canvas and retrigger this reactive render.
			const target = canvas;
			target.width = next.width;
			target.height = next.height;
			target.getContext('2d')!.drawImage(draft, 0, 0);
			model = next;
			ready = true;
		} catch (error) {
			if (version === revision)
				message = error instanceof Error ? error.message : 'Không thể tạo hình nền.';
		} finally {
			if (version === revision) rendering = false;
		}
	}

	async function download(): Promise<void> {
		if (!ready || !model) return;
		try {
			await downloadWallpaper(canvas, model.filename);
			message = 'Đã tạo ảnh PNG. Chọn ảnh trong thư viện / thư mục tải xuống để đặt hình nền.';
		} catch (error) {
			message = error instanceof Error ? error.message : 'Không thể tải ảnh PNG.';
		}
	}
</script>

<section class="wallpaper-export" aria-labelledby="wallpaper-title">
	<div class="wallpaper-copy">
		<p class="section-number">XƯỞNG HÌNH NỀN ANIME · PNG</p>
		<h2 id="wallpaper-title">Mang lịch lên màn hình.</h2>
		<p class="wallpaper-description">
			{snapshot.scheduleKind === 'exams'
				? 'Chỉ hiển thị riêng đợt thi Giữa kỳ hoặc Cuối kỳ trên mỗi ảnh để bố cục thoáng đẹp và tôn nhân vật Anime.'
				: 'Xuất đúng tuần đang xem ở bảng lịch. Đổi tuần phía trên để tạo ảnh khác.'}
			Tuỳ chỉnh bộ Anime yêu thích có sẵn hình nhân vật hoặc tải ảnh riêng của bạn.
		</p>
		<div class="wallpaper-controls">
			{#if snapshot.scheduleKind === 'exams'}
				<label for="wallpaper-exam-phase"
					>Đợt thi hiển thị trên ảnh
					<select id="wallpaper-exam-phase" bind:value={examPhase}>
						{#each Object.entries(WALLPAPER_EXAM_PHASES) as [value, label]}
							<option
								{value}
								disabled={availableExamPhases.length > 0 &&
									!availableExamPhases.includes(value as WallpaperExamPhase)}
							>
								{label}
							</option>
						{/each}
					</select>
				</label>
			{/if}
			<div class="control-row">
				<label for="wallpaper-format"
					>Thiết bị
					<select id="wallpaper-format" bind:value={format}>
						{#each Object.entries(WALLPAPER_FORMATS) as [value, preset]}
							<option {value}>{preset.label}</option>
						{/each}
					</select>
				</label>
				<label for="wallpaper-theme"
					>Chủ đề Anime & Nhân vật
					<select id="wallpaper-theme" bind:value={theme}>
						{#each Object.entries(WALLPAPER_THEMES) as [value, preset]}
							<option {value}>{preset.label}</option>
						{/each}
					</select>
				</label>
			</div>

			<div class="control-row">
				<label for="wallpaper-mascot"
					>Linh vật & Biểu tượng góc
					<select id="wallpaper-mascot" bind:value={mascot}>
						{#each Object.entries(WALLPAPER_MASCOTS) as [value, label]}
							<option {value}>{label}</option>
						{/each}
					</select>
				</label>
				<label for="wallpaper-motto"
					>Bùa qua môn / Châm ngôn
					<input
						id="wallpaper-motto"
						type="text"
						maxlength="64"
						bind:value={motto}
						placeholder="Nhập lời chúc hoặc châm ngôn..."
					/>
				</label>
			</div>

			<div class="motto-presets" aria-label="Mẫu bùa qua môn nhanh">
				{#each WALLPAPER_MOTTOS as preset}
					<button
						type="button"
						class="motto-chip"
						class:active={motto === preset}
						on:click={() => (motto = preset)}
					>
						{preset}
					</button>
				{/each}
			</div>

			<div class="studio-extra-controls">
				{#if customBackground || WALLPAPER_THEMES[theme]?.wallpaperFile}
					<div class="overlay-card">
						<div class="overlay-card-header">
							<div class="overlay-card-titles">
								<label for="wallpaper-overlay">Độ tối lớp phủ nền</label>
								<span>Cân chỉnh độ sáng nhân vật Anime và độ rõ của thẻ lịch</span>
							</div>
							<output for="wallpaper-overlay" class="overlay-badge">
								{Math.round(overlayOpacity * 100)}%
							</output>
						</div>
						<input
							id="wallpaper-overlay"
							class="styled-range"
							type="range"
							min="0.12"
							max="0.80"
							step="0.02"
							style={`--range-progress: ${Math.round(((overlayOpacity - 0.12) / (0.8 - 0.12)) * 100)}%`}
							bind:value={overlayOpacity}
						/>
						<div class="overlay-scale" aria-hidden="true">
							<span>Rõ nhân vật (12%)</span>
							<span>Nổi thẻ lịch (80%)</span>
						</div>
					</div>
				{/if}

				<div class="upload-card" class:has-custom={Boolean(customBackground)}>
					<div class="upload-info">
						<span class="upload-icon" aria-hidden="true">
							<svg viewBox="0 0 20 20" width="16" height="16" fill="none">
								<rect
									x="2.5"
									y="3.5"
									width="15"
									height="13"
									rx="2.5"
									stroke="currentColor"
									stroke-width="1.5"
								/>
								<circle cx="7" cy="8" r="1.4" fill="currentColor" />
								<path
									d="M4.5 14l3.8-3.6a1 1 0 011.4 0l2.2 2.1 1.6-1.5a1 1 0 011.4 0L16 12.1"
									stroke="currentColor"
									stroke-width="1.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</span>
						<div class="upload-text">
							<strong>
								{customBackground ? customBackgroundName : 'Ảnh nền Anime / Waifu riêng'}
							</strong>
							<span>
								{customBackground
									? `${customBackgroundWidth}×${customBackgroundHeight}px · Đang dùng ảnh cá nhân`
									: 'Tuỳ chọn · Mặc định đã có sẵn ảnh nhân vật theo bộ Anime'}
							</span>
						</div>
					</div>
					<div class="upload-actions">
						<button type="button" class="upload-trigger" on:click={() => fileInput?.click()}>
							{customBackground ? 'Đổi ảnh' : 'Chọn ảnh'}
						</button>
						{#if customBackground}
							<button
								type="button"
								class="upload-reset"
								on:click={clearCustomBackground}
								title="Khôi phục ảnh nhân vật mặc định của chủ đề"
							>
								Mặc định
							</button>
						{/if}
					</div>
					<input
						bind:this={fileInput}
						class="sr-only-file"
						type="file"
						accept="image/*"
						aria-label="Tải ảnh nền Anime hoặc Waifu riêng từ máy"
						on:change={handleBackgroundUpload}
					/>
				</div>
			</div>
		</div>
		<button class="primary-button" type="button" disabled={!ready || rendering} on:click={download}>
			{snapshot.provenance === 'sample'
				? 'Không thể xuất dữ liệu mẫu'
				: rendering
					? 'Đang vẽ hình nền…'
					: 'Tải hình nền PNG'}
		</button>
		<p class="wallpaper-note">Ảnh tĩnh · Không tự cập nhật · Xử lý 100% cục bộ trên thiết bị</p>
		<p class="sync-message" role="status" aria-live="polite">{message}</p>
	</div>
	<div class="wallpaper-stage" class:phone={format === 'phone'} aria-busy={rendering}>
		<canvas
			bind:this={canvas}
			class:ready
			aria-label={`Xem trước hình nền ${snapshot.scheduleKind === 'exams' ? 'lịch thi' : 'thời khóa biểu'}, ${WALLPAPER_FORMATS[format].label}`}
		></canvas>
		{#if !ready}
			<p>
				{snapshot.provenance === 'sample'
					? 'Nhập lịch của bạn để tạo hình nền.'
					: rendering
						? 'Đang dựng bản xem trước…'
						: 'Chưa có bản xem trước.'}
			</p>
		{/if}
	</div>
</section>

<style>
	.wallpaper-export {
		display: grid;
		grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.3fr);
		align-items: center;
		gap: 36px;
		margin-bottom: 28px;
		padding: 36px;
		border: 1px solid var(--line);
		border-radius: 16px;
		background: linear-gradient(
			125deg,
			color-mix(in srgb, var(--cyan) 6%, var(--surface)),
			var(--surface-raised)
		);
	}
	h2 {
		margin: 12px 0;
		font-size: clamp(1.35rem, 2.5vw, 2rem);
		letter-spacing: -0.04em;
	}
	.wallpaper-description {
		color: var(--muted);
		line-height: 1.75;
		font-size: 0.85rem;
		max-width: 480px;
	}
	.wallpaper-controls {
		display: grid;
		gap: 14px;
		margin: 20px 0;
	}
	.control-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
	label {
		display: grid;
		gap: 6px;
		font-size: 0.76rem;
		font-weight: 600;
	}
	select,
	input[type='text'] {
		width: 100%;
		min-width: 0;
		min-height: 42px;
		padding: 8px 10px;
		border: 1px solid var(--line);
		border-radius: 9px;
		color: var(--ink);
		background: var(--surface);
		font-size: 0.82rem;
	}
	.motto-presets {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.motto-chip {
		padding: 5px 11px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--muted);
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.motto-chip.active,
	.motto-chip:hover {
		border-color: var(--cyan);
		color: var(--ink);
		background: color-mix(in srgb, var(--cyan) 15%, var(--surface));
	}
	.studio-extra-controls {
		display: grid;
		gap: 10px;
		margin-top: 2px;
	}
	.overlay-card {
		display: grid;
		gap: 10px;
		padding: 13px 15px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: color-mix(in srgb, var(--surface) 88%, var(--surface-raised));
	}
	.overlay-card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	.overlay-card-titles {
		display: grid;
		gap: 2px;
	}
	.overlay-card-titles label {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ink);
	}
	.overlay-card-titles span {
		font-size: 0.7rem;
		color: var(--muted);
		font-weight: 400;
	}
	.overlay-badge {
		padding: 3px 9px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--cyan) 40%, var(--line));
		background: color-mix(in srgb, var(--cyan) 14%, var(--surface));
		color: var(--ink);
		font-size: 0.72rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.styled-range {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 6px;
		margin: 2px 0;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--cyan) 0%,
			var(--cyan) var(--range-progress, 30%),
			color-mix(in srgb, var(--line) 85%, var(--surface-raised)) var(--range-progress, 30%),
			color-mix(in srgb, var(--line) 85%, var(--surface-raised)) 100%
		);
		outline: none;
		cursor: pointer;
	}
	.styled-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--ink);
		border: 3px solid var(--cyan);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		transition: transform 0.12s ease;
	}
	.styled-range::-webkit-slider-thumb:hover {
		transform: scale(1.12);
	}
	.styled-range::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: var(--ink);
		border: 3px solid var(--cyan);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
		transition: transform 0.12s ease;
	}
	.overlay-scale {
		display: flex;
		justify-content: space-between;
		font-size: 0.68rem;
		color: var(--muted);
	}
	.upload-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: color-mix(in srgb, var(--surface) 88%, var(--surface-raised));
		transition: border-color 0.15s ease;
	}
	.upload-card.has-custom {
		border-color: color-mix(in srgb, var(--cyan) 50%, var(--line));
		background: color-mix(in srgb, var(--cyan) 8%, var(--surface));
	}
	.upload-info {
		display: flex;
		align-items: center;
		gap: 11px;
		min-width: 0;
	}
	.upload-icon {
		display: grid;
		place-items: center;
		flex-shrink: 0;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface-raised);
		font-size: 1rem;
	}
	.upload-text {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.upload-text strong {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.upload-text span {
		font-size: 0.7rem;
		color: var(--muted);
		line-height: 1.35;
	}
	.upload-actions {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.upload-trigger,
	.upload-reset {
		min-height: 34px;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 0.74rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}
	.upload-trigger {
		border: 1px solid color-mix(in srgb, var(--cyan) 45%, var(--line));
		background: color-mix(in srgb, var(--cyan) 14%, var(--surface));
		color: var(--ink);
	}
	.upload-trigger:hover {
		border-color: var(--cyan);
		background: color-mix(in srgb, var(--cyan) 24%, var(--surface));
	}
	.upload-reset {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--muted);
	}
	.upload-reset:hover {
		color: var(--ink);
		border-color: var(--muted);
	}
	.sr-only-file {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.wallpaper-note {
		margin-top: 16px;
		color: var(--muted);
		font-size: 0.7rem;
		line-height: 1.7;
	}
	.wallpaper-stage {
		display: grid;
		position: relative;
		place-items: center;
		min-height: 300px;
		padding: 24px;
		overflow: hidden;
		border: 1px solid var(--line);
		border-radius: 16px;
		background: repeating-linear-gradient(
			135deg,
			transparent,
			transparent 8px,
			color-mix(in srgb, var(--cyan) 4%, transparent) 8px,
			color-mix(in srgb, var(--cyan) 4%, transparent) 9px
		);
	}
	.wallpaper-stage canvas {
		width: 100%;
		height: auto;
		display: none;
		border-radius: 10px;
		box-shadow: 0 18px 40px #001c3038;
	}
	.wallpaper-stage.phone canvas {
		max-width: 250px;
		border-radius: 24px;
		border: 6px solid #213344;
	}
	.wallpaper-stage canvas.ready {
		display: block;
	}
	.wallpaper-stage p {
		color: var(--muted);
		font-size: 0.82rem;
		text-align: center;
	}
	@media (max-width: 820px) {
		.wallpaper-export {
			grid-template-columns: minmax(0, 1fr);
			gap: 24px;
			padding: 24px;
		}
		.control-row {
			grid-template-columns: minmax(0, 1fr);
		}
		.wallpaper-stage {
			padding: 18px;
		}
	}
</style>
