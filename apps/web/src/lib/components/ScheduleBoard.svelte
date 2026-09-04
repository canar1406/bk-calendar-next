<script lang="ts">
	import type { ManagedEvent } from '../../../../../packages/timetable/src/index.ts';
	import {
		buildScheduleWeeks,
		selectDefaultScheduleWeek,
		type ScheduleWeek
	} from '../schedule-view.ts';

	export let events: ManagedEvent[] = [];

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

	function showPreviousWeek(): void {
		const previousWeek = weeks[selectedWeekIndex - 1];
		if (previousWeek) selectedWeekKey = previousWeek.key;
	}

	function showNextWeek(): void {
		const nextWeek = weeks[selectedWeekIndex + 1];
		if (nextWeek) selectedWeekKey = nextWeek.key;
	}
</script>

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
			<div class="week-picker">
				<label for="schedule-week">Tuần hiển thị</label>
				<select id="schedule-week" bind:value={selectedWeekKey} disabled={weeks.length === 0}>
					{#each weeks as week}
						<option value={week.key}>{week.label}</option>
					{/each}
				</select>
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
						<article class="event-card">
							<p class="event-time">{timeRange(event)}</p>
							<h3>{event.title}</h3>
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

	.week-navigation button,
	.week-picker select {
		min-height: 42px;
		border: 1px solid var(--line);
		background: white;
		color: var(--ink);
		font: inherit;
	}

	.week-navigation button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 13px;
		font-size: 0.78rem;
		font-weight: 600;
		cursor: pointer;
	}

	.week-navigation button:hover:not(:disabled),
	.week-navigation button:focus-visible,
	.week-picker select:focus-visible {
		border-color: var(--blue);
		outline: 2px solid color-mix(in srgb, var(--blue) 24%, transparent);
		outline-offset: 2px;
	}

	.week-navigation button:disabled,
	.week-picker select:disabled {
		color: #829ab1;
		background: #f4f7fa;
		cursor: not-allowed;
	}

	.week-picker {
		display: grid;
		gap: 5px;
	}

	.week-picker label {
		font-size: 0.68rem;
		font-weight: 600;
	}

	.week-picker select {
		min-width: 230px;
		padding: 0 34px 0 12px;
		font-size: 0.78rem;
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

		.week-picker {
			flex: 1;
		}

		.week-picker select {
			width: 100%;
			min-width: 0;
		}
	}

	@media (max-width: 480px) {
		.week-navigation button {
			padding: 0 10px;
		}

		.week-navigation button span:not([aria-hidden='true']) {
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
