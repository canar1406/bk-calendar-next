<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Điều khoản sử dụng · BKalendar Next</title>
	<meta name="description" content="Điều khoản sử dụng website và extension BKalendar Next." />
</svelte:head>

<main class="legal-page">
	<a class="legal-back" href={`${base}/`}>← Quay lại BKalendar</a>
	<header>
		<h1>Điều khoản sử dụng</h1>
		<p>Có hiệu lực từ ngày 03/09/2026.</p>
	</header>

	<section>
		<h2>Mục đích</h2>
		<p>
			BKalendar Next là công cụ mã nguồn mở giúp chuyển đổi, xem lại và đồng bộ thời khóa biểu. Dự
			án không phải dịch vụ chính thức của HCMUT, MyBK, Google hoặc Apple.
		</p>
	</section>

	<section>
		<h2>Trách nhiệm của người dùng</h2>
		<ul>
			<li>Chỉ xử lý dữ liệu mà bạn có quyền truy cập.</li>
			<li>Kiểm tra nội dung thay đổi trước khi xác nhận ghi vào Google Calendar.</li>
			<li>Chỉ bật lưu đăng nhập MyBK trong extension nếu bạn chấp nhận cơ chế mã hóa cục bộ.</li>
			<li>Kiểm tra lại lịch chính thức của trường khi có thông tin quan trọng.</li>
		</ul>
	</section>

	<section>
		<h2>An toàn đồng bộ</h2>
		<p>
			BKalendar chỉ sửa hoặc xóa các sự kiện có metadata quản lý của ứng dụng. Khi dữ liệu MyBK
			không đầy đủ hoặc đang phân trang, thao tác xóa bị chặn. Các cơ chế này giảm rủi ro nhưng
			không thay thế việc người dùng xem lại kế hoạch đồng bộ.
		</p>
	</section>

	<section>
		<h2>Phạm vi cung cấp</h2>
		<p>
			Phần mềm được cung cấp theo giấy phép MIT và theo trạng thái hiện có. Tính khả dụng có thể bị
			ảnh hưởng bởi thay đổi của MyBK, Google Calendar, trình duyệt hoặc hệ điều hành.
		</p>
	</section>

	<section>
		<h2>Thay đổi điều khoản</h2>
		<p>
			Các thay đổi quan trọng sẽ được ghi nhận trong repository dự án. Việc tiếp tục sử dụng sau khi
			phiên bản mới được phát hành đồng nghĩa với việc bạn chấp nhận điều khoản cập nhật.
		</p>
	</section>

	<section>
		<h2>Liên hệ</h2>
		<p>
			Gửi câu hỏi hoặc báo lỗi tại
			<a href="https://github.com/canar1406/bk-calendar-next/issues">GitHub Issues</a>.
		</p>
	</section>
</main>
