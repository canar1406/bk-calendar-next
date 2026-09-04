<script lang="ts">
	import { base } from '$app/paths';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
</script>

<svelte:head>
	<title>Chính sách quyền riêng tư · BKalendar Next</title>
	<meta
		name="description"
		content="Cách BKalendar Next xử lý thời khóa biểu và quyền truy cập Google Calendar."
	/>
</svelte:head>

<main class="legal-page">
	<div class="legal-toolbar">
		<a class="legal-back" href={`${base}/`}>← Quay lại BKalendar</a>
		<ThemeSwitcher />
	</div>
	<header>
		<h1>Chính sách quyền riêng tư</h1>
		<p>Có hiệu lực từ ngày 03/09/2026.</p>
	</header>

	<section>
		<h2>Nguyên tắc local-first</h2>
		<p>
			BKalendar Next xử lý thời khóa biểu ngay trên trình duyệt hoặc trong tiện ích mở rộng. Phiên
			bản hiện tại không có máy chủ ứng dụng, Firebase, hệ thống phân tích hành vi hoặc cơ sở dữ
			liệu đám mây riêng.
		</p>
	</section>

	<section>
		<h2>Dữ liệu được xử lý</h2>
		<ul>
			<li>Nội dung thời khóa biểu mà bạn chủ động dán hoặc mở trên trang MyBK.</li>
			<li>Snapshot, lịch sử so sánh và ID lịch Google do BKalendar quản lý.</li>
			<li>Trạng thái đọc đủ/thiếu dữ liệu và số lượng thay đổi.</li>
		</ul>
		<p>
			Dữ liệu này được lưu trong <code>localStorage</code> của website hoặc
			<code>chrome.storage.local</code> của tiện ích trên thiết bị của bạn. BKalendar không yêu cầu hoặc
			lưu mật khẩu MyBK trong website. Nếu bạn chủ động bật theo dõi nền trong extension, username và
			mật khẩu MyBK được mã hóa bằng AES-GCM và lưu cục bộ để extension đăng nhập CAS HCMUT; dữ liệu này
			không được gửi tới máy chủ BKalendar. Cookie đăng nhập và refresh token Google không được lưu.
		</p>
	</section>

	<section>
		<h2>Google Calendar</h2>
		<p>
			Chỉ khi bạn bấm nút xác nhận đồng bộ, website mới mở Google Identity Services và yêu cầu một
			access token ngắn hạn. Dữ liệu sự kiện cần đồng bộ được gửi trực tiếp từ trình duyệt của bạn
			tới Google Calendar API. Token chỉ nằm trong bộ nhớ trong lúc thao tác và được yêu cầu thu hồi
			sau khi hoàn tất.
		</p>
	</section>

	<section>
		<h2>Tiện ích trình duyệt</h2>
		<p>
			Tiện ích chỉ chạy trên URL thời khóa biểu MyBK và website BKalendar được khai báo trong
			manifest. Khi bạn chọn xem lại, pending snapshot được truyền cục bộ giữa extension và website
			bằng một message có nonce; thời khóa biểu không được đặt trong URL.
		</p>
		<p>
			Khi bạn bật theo dõi nền, extension có thể gửi thông tin đăng nhập đã được bạn nhập và cho
			phép đến hệ thống CAS HCMUT để tạo phiên MyBK. BKalendar Next không nhận dữ liệu này qua máy
			chủ trung gian.
		</p>
	</section>

	<section>
		<h2>Lưu trữ và xóa dữ liệu</h2>
		<p>
			Dữ liệu được giữ cho tới khi bạn xóa dữ liệu website, gỡ tiện ích hoặc dùng chức năng đặt lại
			dữ liệu trong phiên bản có hỗ trợ. Việc xóa dữ liệu trình duyệt không tự xóa calendar đã tạo
			trong tài khoản Google của bạn.
		</p>
	</section>

	<section>
		<h2>Dịch vụ bên thứ ba</h2>
		<p>
			Website tĩnh được phục vụ bởi GitHub Pages. Google Identity Services và Google Calendar API áp
			dụng chính sách riêng của Google. BKalendar Next không bán dữ liệu cá nhân và không chèn công
			cụ quảng cáo.
		</p>
	</section>

	<section>
		<h2>Liên hệ</h2>
		<p>
			Báo cáo vấn đề về quyền riêng tư tại
			<a href="https://github.com/canar1406/bk-calendar-next/issues">GitHub Issues của dự án</a>.
		</p>
	</section>
</main>
