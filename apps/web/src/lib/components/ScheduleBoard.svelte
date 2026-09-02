<script lang="ts">
	import type { ManagedEvent } from '../../../../../packages/timetable/src/index.ts';

	export let events: ManagedEvent[] = [];

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
		timeZone: 'Asia/Ho_Chi_Minh',
		hour: '2-digit',
		minute: '2-digit'
	});

	function timeRange(event: ManagedEvent): string {
		return `${timeFormatter.format(new Date(event.start))}–${timeFormatter.format(new Date(event.end))}`;
	}
</script>

<section class="board" aria-labelledby="schedule-title">
	<div class="section-heading">
		<div>
			<p class="section-number">02</p>
			<h2 id="schedule-title">Lịch học trong tuần</h2>
		</div>
		<p>Múi giờ cố định: Asia/Ho_Chi_Minh</p>
	</div>

	<div class="week-grid">
		{#each days as day}
			<section class="day-column" aria-label={day.label}>
				<header><span>{day.short}</span><small>{day.label}</small></header>
				<div class="day-events">
					{#each events.filter((event) => event.weekday === day.weekday) as event}
						<article class="event-card">
							<p class="event-time">{timeRange(event)}</p>
							<h3>{event.title}</h3>
							<p class="event-code">{event.courseCode} · {event.group}</p>
							<p class="event-room">{event.location || 'Chưa có phòng'}</p>
						</article>
					{/each}
					{#if events.every((event) => event.weekday !== day.weekday)}
						<p class="empty-day">Trống</p>
					{/if}
				</div>
			</section>
		{/each}
	</div>
</section>
