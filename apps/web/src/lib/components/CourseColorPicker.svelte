<script lang="ts">
	import type { ManagedEvent } from '../../../../../packages/timetable/src/index.ts';
	import {
		COURSE_ICONS,
		COURSE_COLOR_PALETTES,
		GOOGLE_EVENT_COLORS,
		buildCourseColorAssignments,
		colorForId,
		courseIdentity,
		type CourseColorMode,
		type CourseColorPreferences
	} from '../course-colors.ts';

	export let events: ManagedEvent[] = [];
	export let preferences: CourseColorPreferences;
	export let onChange: (preferences: CourseColorPreferences) => void = () => {};

	interface CourseSummary {
		identity: string;
		courseCode: string;
		title: string;
	}

	let iconQuery = '';
	let customIcon = '';
	$: courses = summarizeCourses(events);
	$: assignments = buildCourseColorAssignments(events, preferences);
	$: currentPalette =
		COURSE_COLOR_PALETTES[
			((preferences.seed % COURSE_COLOR_PALETTES.length) + COURSE_COLOR_PALETTES.length) %
				COURSE_COLOR_PALETTES.length
		]!;
	$: filteredIcons = COURSE_ICONS.filter((icon) => {
		const query = iconQuery.trim().toLocaleLowerCase('vi-VN');
		return (
			query === '' ||
			icon.label.toLocaleLowerCase('vi-VN').includes(query) ||
			icon.category.toLocaleLowerCase('vi-VN').includes(query)
		);
	});

	function update(next: CourseColorPreferences): void {
		onChange(next);
	}

	function setMode(mode: CourseColorMode): void {
		update({ ...preferences, mode });
	}

	function reroll(): void {
		update({
			...preferences,
			mode: 'course',
			seed: preferences.seed + 1,
			overrides: {}
		});
	}

	function selectPalette(index: number, event: MouseEvent): void {
		update({
			...preferences,
			mode: 'course',
			seed: index,
			overrides: {}
		});
		closePicker(event);
	}

	function setMonoColor(colorId: string, event: MouseEvent): void {
		update({ ...preferences, mode: 'mono', monoColorId: colorId });
		closePicker(event);
	}

	function setCourseColor(course: string, colorId: string, event: MouseEvent): void {
		update({
			...preferences,
			mode: 'course',
			overrides: { ...preferences.overrides, [course]: colorId }
		});
		closePicker(event);
	}

	function setCourseIcon(course: string, icon: string, event: MouseEvent): void {
		update({
			...preferences,
			icons: { ...preferences.icons, [course]: icon }
		});
		closePicker(event);
	}

	function applyCustomIcon(course: string, event: MouseEvent): void {
		const icon = customIcon.trim();
		if (!icon) return;
		setCourseIcon(course, icon, event);
		customIcon = '';
	}

	function closePicker(event: MouseEvent): void {
		(event.currentTarget as HTMLElement).closest('details')?.removeAttribute('open');
	}

	function summarizeCourses(source: ManagedEvent[]): CourseSummary[] {
		const courses = new Map<string, CourseSummary>();
		for (const event of source) {
			const identity = courseIdentity(event);
			if (!courses.has(identity)) {
				courses.set(identity, {
					identity,
					courseCode: event.courseCode,
					title: event.title
				});
			}
		}
		return [...courses.values()].sort((left, right) =>
			left.courseCode.localeCompare(right.courseCode, 'vi')
		);
	}
</script>

<section class="course-appearance" aria-labelledby="course-appearance-title">
	<div class="appearance-heading">
		<div>
			<p class="section-number">MÀU</p>
			<div>
				<h2 id="course-appearance-title">Màu môn học</h2>
				<p>Màu và icon sẽ được giữ ổn định khi BKalendar cập nhật sự kiện.</p>
			</div>
		</div>
		{#if preferences.mode === 'course'}
			<div class="palette-actions">
				<button class="reroll-button" type="button" on:click={reroll}>Đổi bảng màu</button>
				<details class="palette-library">
					<summary>Chọn bảng phối</summary>
					<div class="palette-library-panel">
						<p>Google hỗ trợ 11 màu sự kiện. Chọn cách phối màu cho các môn.</p>
						<div class="palette-presets">
							{#each COURSE_COLOR_PALETTES as palette, index}
								<button
									type="button"
									class:selected={palette.id === currentPalette.id}
									on:click={(event) => selectPalette(index, event)}
								>
									<span class="palette-preview" aria-hidden="true">
										{#each palette.colorIds.slice(0, 6) as colorId}
											<i style:background-color={colorForId(colorId).background}></i>
										{/each}
									</span>
									<span>
										<strong>{palette.name}</strong>
										<small>{palette.description}</small>
									</span>
								</button>
							{/each}
						</div>
					</div>
				</details>
			</div>
		{/if}
	</div>

	<div class="color-mode" aria-label="Chế độ màu">
		<button
			type="button"
			aria-pressed={preferences.mode === 'mono'}
			on:click={() => setMode('mono')}>Một màu</button
		>
		<button
			type="button"
			aria-pressed={preferences.mode === 'course'}
			on:click={() => setMode('course')}>Mỗi môn một màu</button
		>
	</div>

	{#if preferences.mode === 'mono'}
		<div class="mono-color">
			<div>
				<span
					class="course-color-preview"
					style:background-color={colorForId(preferences.monoColorId).background}
				></span>
				<div>
					<strong>Màu chung</strong>
					<span>{colorForId(preferences.monoColorId).name}</span>
				</div>
			</div>
			<details class="appearance-picker">
				<summary aria-label="Đổi màu chung">Đổi màu</summary>
				<div class="color-palette" aria-label="Bảng màu Google Calendar">
					{#each GOOGLE_EVENT_COLORS as color}
						<button
							type="button"
							class="course-color-swatch"
							class:selected={color.id === preferences.monoColorId}
							style:background-color={color.background}
							aria-label={color.name}
							title={color.name}
							on:click={(event) => setMonoColor(color.id, event)}
						></button>
					{/each}
				</div>
			</details>
		</div>
	{:else}
		<div class="course-appearance-list">
			{#each courses as course}
				{@const selectedColor = colorForId(assignments[course.identity] ?? '7')}
				{@const selectedIcon = preferences.icons[course.identity] ?? ''}
				<article class="course-appearance-row">
					<span
						class="course-color-preview"
						style:background-color={selectedColor.background}
						aria-hidden="true"
					>
						{selectedIcon}
					</span>
					<div class="course-identity">
						<strong>{course.courseCode}</strong>
						<span>{course.title}</span>
					</div>

					<details class="appearance-picker color-picker">
						<summary aria-label={`Đổi màu ${course.courseCode}`}>
							<span
								class="summary-swatch"
								style:background-color={selectedColor.background}
								aria-hidden="true"
							></span>
							<span>{selectedColor.name}</span>
						</summary>
						<div class="color-palette" aria-label={`Bảng màu cho ${course.courseCode}`}>
							{#each GOOGLE_EVENT_COLORS as color}
								<button
									type="button"
									class="course-color-swatch"
									class:selected={color.id === assignments[course.identity]}
									style:background-color={color.background}
									aria-label={`${course.courseCode}: ${color.name}`}
									title={color.name}
									on:click={(event) => setCourseColor(course.identity, color.id, event)}
								></button>
							{/each}
						</div>
					</details>

					<details class="appearance-picker icon-picker">
						<summary aria-label={`Đổi icon ${course.courseCode}`}>
							<span>{selectedIcon || '＋'}</span>
							<span>{selectedIcon ? 'Icon' : 'Thêm icon'}</span>
						</summary>
						<div class="icon-palette" aria-label={`Icon cho ${course.courseCode}`}>
							<div class="icon-tools">
								<input
									type="search"
									bind:value={iconQuery}
									placeholder={`Tìm trong ${COURSE_ICONS.length} icon…`}
									aria-label={`Tìm icon cho ${course.courseCode}`}
								/>
								<p class="icon-count">
									{filteredIcons.length} lựa chọn · tìm theo tên hoặc nhóm như STEM, Y khoa, Thể thao
								</p>
								<div class="custom-icon">
									<input
										type="text"
										bind:value={customIcon}
										placeholder="Dán emoji bất kỳ"
										aria-label={`Dán emoji bất kỳ cho ${course.courseCode}`}
										maxlength="12"
									/>
									<button
										type="button"
										disabled={!customIcon.trim()}
										on:click={(event) => applyCustomIcon(course.identity, event)}>Áp dụng</button
									>
								</div>
							</div>
							<div class="icon-grid">
								{#each filteredIcons as icon}
									<button
										type="button"
										class:selected={icon.value === selectedIcon}
										aria-label={`${course.courseCode}: ${icon.label}`}
										title={`${icon.category} · ${icon.label}`}
										on:click={(event) => setCourseIcon(course.identity, icon.value, event)}
									>
										<span aria-hidden="true">{icon.value || '∅'}</span>
										<small>{icon.label}</small>
									</button>
								{/each}
							</div>
						</div>
					</details>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.course-appearance {
		margin-bottom: 28px;
		padding: 26px 30px;
		border: 1px solid var(--line);
		border-radius: 16px;
		background: linear-gradient(145deg, var(--surface-raised), var(--surface));
		box-shadow: 0 18px 55px rgba(0, 0, 0, 0.12);
	}

	.appearance-heading,
	.appearance-heading > div,
	.mono-color,
	.mono-color > div,
	.course-appearance-row {
		display: flex;
		align-items: center;
	}

	.appearance-heading {
		justify-content: space-between;
		gap: 20px;
	}

	.appearance-heading > div {
		gap: 16px;
	}

	.appearance-heading h2,
	.appearance-heading p {
		margin: 0;
	}

	.appearance-heading h2 {
		font-size: 1.25rem;
		letter-spacing: -0.03em;
	}

	.appearance-heading div div p {
		margin-top: 4px;
		color: var(--muted);
		font-size: 0.74rem;
	}

	.reroll-button,
	.color-mode button,
	.appearance-picker summary {
		border: 1px solid var(--line);
		border-radius: 9px;
		color: var(--ink);
		background: var(--surface-raised);
		font: inherit;
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
	}

	.reroll-button {
		min-height: 38px;
		padding: 0 13px;
		color: var(--blue);
	}

	.palette-actions {
		display: flex;
		align-items: center;
		gap: 7px;
	}

	.palette-library {
		position: relative;
	}

	.palette-library > summary {
		display: flex;
		min-height: 38px;
		align-items: center;
		padding: 0 13px;
		border: 1px solid var(--line);
		border-radius: 9px;
		color: var(--ink);
		background: var(--surface-raised);
		font-size: 0.72rem;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}

	.palette-library > summary::-webkit-details-marker {
		display: none;
	}

	.palette-library-panel {
		position: absolute;
		z-index: 50;
		top: calc(100% + 7px);
		right: 0;
		width: 390px;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--surface-raised);
		box-shadow: 0 20px 55px rgba(0, 0, 0, 0.3);
	}

	.palette-library-panel > p {
		margin: 0 0 10px;
		color: var(--muted);
		font-size: 0.67rem;
		line-height: 1.5;
	}

	.palette-presets {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 7px;
	}

	.palette-presets > button {
		display: grid;
		grid-template-columns: 58px 1fr;
		min-height: 56px;
		align-items: center;
		gap: 9px;
		padding: 8px;
		border: 1px solid var(--line);
		border-radius: 10px;
		color: var(--ink);
		background: var(--surface);
		text-align: left;
		cursor: pointer;
	}

	.palette-presets > button:hover,
	.palette-presets > button:focus-visible,
	.palette-presets > button.selected {
		border-color: var(--blue);
		background: color-mix(in srgb, var(--blue) 8%, var(--surface));
	}

	.palette-preview {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3px;
	}

	.palette-preview i {
		width: 17px;
		height: 17px;
		border-radius: 5px;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
	}

	.palette-presets strong,
	.palette-presets small {
		display: block;
	}

	.palette-presets strong {
		font-size: 0.7rem;
	}

	.palette-presets small {
		margin-top: 2px;
		color: var(--muted);
		font-size: 0.58rem;
		line-height: 1.35;
	}

	.color-mode {
		display: inline-grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 4px;
		margin: 20px 0 14px;
		padding: 4px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: color-mix(in srgb, var(--paper) 55%, var(--surface));
	}

	.color-mode button {
		min-height: 36px;
		padding: 0 13px;
		border: 0;
		background: transparent;
	}

	.color-mode button[aria-pressed='true'] {
		color: var(--blue);
		background: var(--surface-raised);
		box-shadow: 0 5px 14px rgba(0, 0, 0, 0.12);
	}

	.course-appearance-list {
		display: grid;
		gap: 7px;
	}

	.course-appearance-row,
	.mono-color {
		position: relative;
		gap: 12px;
		min-height: 58px;
		padding: 9px 10px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: color-mix(in srgb, var(--surface-raised) 78%, transparent);
	}

	.mono-color {
		justify-content: space-between;
	}

	.mono-color > div {
		gap: 11px;
	}

	.mono-color strong,
	.mono-color span,
	.course-identity strong,
	.course-identity span {
		display: block;
	}

	.mono-color strong,
	.course-identity strong {
		font-size: 0.77rem;
	}

	.mono-color div div > span,
	.course-identity span {
		margin-top: 2px;
		overflow: hidden;
		color: var(--muted);
		font-size: 0.68rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.course-color-preview {
		display: grid;
		width: 36px;
		height: 36px;
		flex: 0 0 auto;
		place-items: center;
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 10px;
		font-size: 1rem;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
	}

	.course-identity {
		min-width: 0;
		flex: 1;
	}

	.appearance-picker {
		position: relative;
		flex: 0 0 auto;
	}

	.appearance-picker summary {
		display: flex;
		min-height: 36px;
		align-items: center;
		gap: 7px;
		padding: 0 10px;
		list-style: none;
	}

	.appearance-picker summary::-webkit-details-marker {
		display: none;
	}

	.summary-swatch {
		width: 13px;
		height: 13px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
	}

	.color-palette,
	.icon-palette {
		position: absolute;
		z-index: 40;
		top: calc(100% + 7px);
		right: 0;
		padding: 10px;
		border: 1px solid var(--line);
		border-radius: 13px;
		background: var(--surface-raised);
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
	}

	.color-palette {
		display: grid;
		grid-template-columns: repeat(6, 28px);
		gap: 7px;
	}

	.course-color-swatch {
		width: 28px;
		min-height: 28px;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
	}

	.course-color-swatch.selected {
		border-color: var(--ink);
		outline: 2px solid var(--surface-raised);
		box-shadow:
			0 0 0 3px var(--blue),
			inset 0 0 0 1px rgba(255, 255, 255, 0.35);
	}

	.icon-palette {
		width: 292px;
		max-height: 350px;
		overflow-y: auto;
	}

	.icon-tools {
		position: sticky;
		z-index: 2;
		top: -10px;
		display: grid;
		gap: 7px;
		margin: -2px -2px 9px;
		padding: 2px 2px 9px;
		background: var(--surface-raised);
	}

	.icon-tools input {
		width: 100%;
		min-height: 34px;
		padding: 0 9px;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: var(--ink);
		background: var(--surface);
		font: inherit;
		font-size: 0.68rem;
	}

	.icon-count {
		margin: -1px 1px 0;
		color: var(--muted);
		font-size: 0.58rem;
		line-height: 1.4;
	}

	.custom-icon {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px;
	}

	.custom-icon button {
		min-height: 34px;
		padding: 0 9px;
		border: 1px solid var(--line);
		border-radius: 8px;
		color: var(--blue);
		background: var(--surface);
		font-size: 0.64rem;
		font-weight: 600;
		cursor: pointer;
	}

	.custom-icon button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.icon-grid {
		display: grid;
		grid-template-columns: repeat(4, 58px);
		gap: 6px;
	}

	.icon-grid > button {
		display: grid;
		min-height: 52px;
		place-items: center;
		gap: 2px;
		padding: 5px;
		border: 1px solid var(--line);
		border-radius: 9px;
		color: var(--ink);
		background: var(--surface);
		cursor: pointer;
	}

	.icon-grid > button > span {
		font-size: 1rem;
	}

	.icon-grid small {
		color: var(--muted);
		font-size: 0.56rem;
	}

	.icon-grid > button.selected {
		border-color: var(--blue);
		background: color-mix(in srgb, var(--blue) 10%, var(--surface));
	}

	@media (max-width: 720px) {
		.course-appearance {
			padding: 22px;
		}

		.course-appearance-row {
			display: grid;
			grid-template-columns: auto 1fr auto;
		}

		.icon-picker {
			grid-column: 3;
		}

		.color-picker {
			grid-column: 2 / 3;
			grid-row: 2;
			justify-self: start;
		}

		.color-picker .color-palette {
			right: auto;
			left: 0;
		}
	}

	@media (max-width: 480px) {
		.appearance-heading {
			align-items: flex-start;
			flex-direction: column;
		}

		.palette-actions {
			width: 100%;
		}

		.palette-library {
			flex: 1;
		}

		.palette-library > summary,
		.reroll-button {
			justify-content: center;
			width: 100%;
		}

		.palette-library-panel {
			right: auto;
			left: 0;
			width: min(390px, calc(100vw - 48px));
		}

		.color-mode {
			width: 100%;
		}

		.course-appearance-row {
			grid-template-columns: auto 1fr;
		}

		.color-picker,
		.icon-picker {
			grid-row: auto;
			grid-column: auto;
			justify-self: stretch;
		}

		.appearance-picker summary {
			justify-content: center;
		}

		.icon-palette {
			right: auto;
			left: 0;
			width: min(292px, calc(100vw - 48px));
		}

		.color-palette {
			right: auto;
			left: 0;
			grid-template-columns: repeat(4, 28px);
		}

		.icon-grid {
			grid-template-columns: repeat(3, 58px);
		}
	}
</style>
