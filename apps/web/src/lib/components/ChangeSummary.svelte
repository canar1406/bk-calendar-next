<script lang="ts">
	import type { TimetableDiff } from '../../../../../packages/timetable/src/index.ts';

	export let diff: TimetableDiff;

	const labels: Record<string, string> = {
		title: 'Tên môn',
		location: 'Phòng học',
		start: 'Giờ bắt đầu',
		end: 'Giờ kết thúc',
		timeZone: 'Múi giờ',
		activeWeekIndexes: 'Tuần học',
		excludedStarts: 'Tuần nghỉ',
		metadata: 'Thông tin môn'
	};
</script>

<section class="changes" aria-labelledby="changes-title">
	<div class="section-heading">
		<div>
			<p class="section-number">03</p>
			<h2 id="changes-title">Thay đổi được phát hiện</h2>
		</div>
		<p>So sánh với bản đã chấp nhận gần nhất trên thiết bị này.</p>
	</div>

	<div class="counts" aria-label="Tóm tắt thay đổi">
		<div class="count added"><strong>{diff.added.length}</strong><span>Thêm mới</span></div>
		<div class="count changed"><strong>{diff.changed.length}</strong><span>Thay đổi</span></div>
		<div class="count removed">
			<strong>{diff.removed.length}</strong><span>Có thể đã xóa</span>
		</div>
		<div class="count unchanged">
			<strong>{diff.unchanged.length}</strong><span>Không đổi</span>
		</div>
	</div>

	{#if diff.removed.length > 0 && !diff.canDelete}
		<p class="safety-note">
			Dữ liệu dán thủ công chưa được xác nhận là đầy đủ. BKalendar sẽ hiển thị môn có thể đã xóa
			nhưng không cho phép xóa sự kiện trên Google Calendar.
		</p>
	{/if}

	{#if diff.changed.length > 0}
		<ul class="change-list">
			{#each diff.changed as item}
				<li>
					<strong>{item.after.courseCode} · {item.after.title}</strong>
					<span>{item.changedFields.map((field) => labels[field] ?? field).join(', ')}</span>
				</li>
			{/each}
		</ul>
	{/if}
</section>
