<script lang="ts">
	import type { ManagedEvent } from '../../../../../packages/timetable/src/index.ts';
	import {
		buildScheduleWeeks,
		selectDefaultScheduleWeek,
		type ScheduleWeek
	} from '../schedule-view.ts';
	import { colorForId, courseIdentity } from '../course-colors.ts';

	export let events: ManagedEvent[] = [];
	export let colorAssignments: Record<string, string> = {};
	export let courseIcons: Record<string, string> = {};

	const calendarTimeZone = 'Asia/Ho_Chi_Minh';
	const days = [
		{ weekday: 2, short: 'T2', label: 'Thứ hai' },
		{ weekday: 3, short: 'T3', label: 'Thứ ba' },
		{ weekday: 4, short: 'T4', label: 'Thứ tư' },
		{ weekday: 5, short: 'T5', label: 'Thứ năm' },
		{ weekday: 6, short: 'T6', label: 'Thứ sáu' },
		{ weekday: 7, short: 'T7', label: 'Thứ bảy' },
		{ weekday: 8, short: 'CN', label: 'Chủ nhật' }
	];

	const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
		timeZone: calendarTimeZone,
		hour: '2-digit',
		minute: '2-digit'
	});

	let weeks: ScheduleWeek[] = [];
	let selectedWeekKey = '';
	let selectedWeekIndex = -1;
	let selectedWeek: ScheduleWeek | undefined;
	let visibleEvents: ManagedEvent[] = [];
	let previousEventsSignature: string | undefined;
	let weekPickerElement: HTMLDetailsElement | undefined;

	$: eventsSignature = events
		.map(
			(event) =>
				`${event.stableKey}:${event.fingerprint ?? ''}:${event.start}:${event.end}:${event.activeWeekIndexes.join(',')}`
		)
		.join('|');
	$: if (eventsSignature !== previousEventsSignature) {
		previousEventsSignature = eventsSignature;
		weeks = buildScheduleWeeks(events);
		selectedWeekKey = selectDefaultScheduleWeek(weeks)?.key ?? '';
	}
	$: selectedWeekIndex = weeks.findIndex((week) => week.key === selectedWeekKey);
	$: selectedWeek = selectedWeekIndex >= 0 ? weeks[selectedWeekIndex] : undefined;
	$: visibleEvents = selectedWeek?.events ?? [];

	function timeRange(event: ManagedEvent): string {
		return `${timeFormatter.format(new Date(event.start))}–${timeFormatter.format(new Date(event.end))}`;
	}

	function eventColor(event: ManagedEvent): string {
		return colorForId(colorAssignments[courseIdentity(event)] ?? '7').background;
	}

	function eventIcon(event: ManagedEvent): string {
		return courseIcons[courseIdentity(event)] ?? '';
	}

	function showPreviousWeek(): void {
		const previousWeek = weeks[selectedWeekIndex - 1];
		if (previousWeek) selectedWeekKey = previousWeek.key;
	}

	function showNextWeek(): void {
		const nextWeek = weeks[selectedWeekIndex + 1];
		if (nextWeek) selectedWeekKey = nextWeek.key;
	}

	function selectWeek(key: string): void {
		selectedWeekKey = key;
		if (weekPickerElement) {
			weekPickerElement.open = false;
			weekPickerElement.querySelector<HTMLElement>('summary')?.focus();
		}
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && weekPickerElement?.open) {
			weekPickerElement.open = false;
			weekPickerElement.querySelector<HTMLElement>('summary')?.focus();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<section class="board" aria-labelledby="schedule-title">
	<div class="section-heading">
		<div>
			<p class="section-number">02</p>
			<h2 id="schedule-title">Lịch học cả học kỳ</h2>
		</div>
		<p>Xem trước theo từng tuần · Múi giờ {calendarTimeZone}</p>
	</div>

	<div class="schedule-toolbar">
		<p>
			Dữ liệu bao phủ toàn bộ học kỳ; bảng bên dưới chỉ hiển thị các buổi học có trong tuần đang
			chọn.
		</p>
		<nav class="week-navigation" aria-label="Chọn tuần xem trước">
			<button
				type="button"
				on:click={showPreviousWeek}
				disabled={selectedWeekIndex <= 0}
				aria-label="Xem tuần trước"
			>
				<span aria-hidden="true">←</span>
				<span>Trước</span>
			</button>
			<div class="week-picker-field">
				<span class="week-picker-label">Tuần hiển thị</span>
				<details class="week-picker" bind:this={weekPickerElement}>
					<summary aria-label="Chọn tuần hiển thị" aria-haspopup="listbox">
						<span>{selectedWeek?.label ?? 'Chưa có tuần học'}</span>
						<span class="week-picker-chevron" aria-hidden="true"></span>
					</summary>
					<div class="week-menu-panel" role="listbox" aria-label="Các tuần trong học kỳ">
						{#each weeks as week}
							<button
								type="button"
								class="week-menu-option"
								role="option"
								aria-selected={week.key === selectedWeekKey}
								on:click={() => selectWeek(week.key)}
							>
								{week.label}
							</button>
						{/each}
					</div>
				</details>
			</div>
			<button
				type="button"
				on:click={showNextWeek}
				disabled={selectedWeekIndex < 0 || selectedWeekIndex >= weeks.length - 1}
				aria-label="Xem tuần sau"
			>
				<span>Sau</span>
				<span aria-hidden="true">→</span>
			</button>
		</nav>
	</div>

	{#if selectedWeek}
		<p class="selected-week" aria-live="polite">{selectedWeek.label}</p>
	{/if}

	<div class="week-grid">
		{#each days as day}
			<section class="day-column" aria-label={day.label}>
				<header><span>{day.short}</span><small>{day.label}</small></header>
				<div class="day-events">
					{#each visibleEvents.filter((event) => event.weekday === day.weekday) as event}
						<article
							class="event-card"
							style={`--course-color: ${eventColor(event)}; --course-tint: color-mix(in srgb, ${eventColor(event)} 10%, var(--surface-raised));`}
						>
							<p class="event-time">{timeRange(event)}</p>
							<h3>{eventIcon(event) ? `${eventIcon(event)} ` : ''}{event.title}</h3>
							<p class="event-code">{event.courseCode} · {event.group}</p>
							<p class="event-room">{event.location || 'Chưa có phòng'}</p>
						</article>
					{/each}
					{#if visibleEvents.every((event) => event.weekday !== day.weekday)}
						<p class="empty-day">Trống</p>
					{/if}
				</div>
			</section>
		{/each}
	</div>
</section>

<style>
	.schedule-toolbar {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 24px;
		margin-bottom: 14px;
	}

	.schedule-toolbar > p {
		max-width: 580px;
		margin: 0;
		color: var(--muted);
		font-size: 0.82rem;
		line-height: 1.6;
	}

	.week-navigation {
		display: flex;
		align-items: end;
		gap: 8px;
	}

	.week-navigation > button,
	.week-picker summary {
		min-height: 42px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface-raised);
		color: var(--ink);
		font: inherit;
		transition:
			border-color 150ms ease,
			background 150ms ease,
			opacity 150ms ease;
	}

	.week-navigation > button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 13px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.week-navigation > button:hover:not(:disabled),
	.week-navigation > button:focus-visible,
	.week-picker summary:hover,
	.week-picker summary:focus-visible {
		border-color: var(--blue);
		background: color-mix(in srgb, var(--blue) 8%, var(--surface-raised));
		outline: 2px solid color-mix(in srgb, var(--blue) 24%, transparent);
		outline-offset: 2px;
	}

	.week-navigation > button:disabled {
		color: var(--muted);
		background: color-mix(in srgb, var(--surface) 84%, var(--paper));
		cursor: not-allowed;
		opacity: 0.52;
	}

	.week-picker-field {
		display: grid;
		min-width: 230px;
		gap: 5px;
	}

	.week-picker-label {
		font-size: 0.68rem;
		font-weight: 600;
	}

	.week-picker {
		position: relative;
	}

	.week-picker summary {
		display: flex;
		min-width: 230px;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 0 12px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
		list-style: none;
	}

	.week-picker summary::-webkit-details-marker {
		display: none;
	}

	.week-picker-chevron {
		width: 7px;
		height: 7px;
		flex: 0 0 auto;
		border-right: 1.5px solid var(--muted);
		border-bottom: 1.5px solid var(--muted);
		transform: rotate(45deg) translate(-2px, -2px);
		transition: transform 150ms ease;
	}

	.week-picker[open] .week-picker-chevron {
		transform: rotate(225deg) translate(-1px, -1px);
	}

	.week-menu-panel {
		position: absolute;
		z-index: 30;
		top: calc(100% + 7px);
		right: 0;
		display: grid;
		width: max(100%, 260px);
		max-height: 280px;
		gap: 3px;
		overflow-y: auto;
		padding: 6px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface-raised);
		box-shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
	}

	.week-menu-option {
		min-height: 38px;
		padding: 8px 10px;
		border: 0;
		border-radius: 8px;
		color: var(--muted);
		background: transparent;
		font-size: 0.76rem;
		font-weight: 500;
		line-height: 1.35;
		text-align: left;
		cursor: pointer;
	}

	.week-menu-option:hover,
	.week-menu-option:focus-visible {
		color: var(--ink);
		background: color-mix(in srgb, var(--blue) 10%, var(--surface-raised));
		outline: none;
	}

	.week-menu-option[aria-selected='true'] {
		color: var(--ink);
		background: color-mix(in srgb, var(--blue) 16%, var(--surface-raised));
		box-shadow: inset 3px 0 var(--blue);
	}

	.selected-week {
		margin: 0 0 10px;
		color: var(--blue);
		font-family: 'IBM Plex Mono', monospace;
		font-size: 0.72rem;
		font-weight: 600;
	}

	@media (max-width: 820px) {
		.schedule-toolbar {
			align-items: stretch;
			flex-direction: column;
			gap: 14px;
		}

		.week-navigation {
			align-items: stretch;
		}

		.week-picker-field {
			flex: 1;
		}

		.week-picker summary {
			width: 100%;
			min-width: 0;
		}

		.week-menu-panel {
			right: auto;
			left: 0;
			width: 100%;
		}
	}

	@media (max-width: 480px) {
		.week-navigation > button {
			padding: 0 10px;
		}

		.week-navigation > button span:not([aria-hidden='true']) {
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
	}
</style>
