# BKalendar Next

BKalendar Next giúp sinh viên HCMUT chuyển thời khóa biểu MyBK sang Google
Calendar hoặc file `.ics`, theo dõi thay đổi lịch học và hạn chế tối đa nguy cơ
nhân đôi hoặc xóa nhầm sự kiện cá nhân.

Website: <https://canar1406.github.io/bk-calendar-next/>

Extension mới nhất:
<https://github.com/canar1406/bk-calendar-next/releases/latest>

## Tính năng chính

- Đọc thời khóa biểu MyBK của một học kỳ.
- Hiển thị lịch theo từng tuần để người dùng kiểm tra trước.
- Đồng bộ vào một lịch riêng do BKalendar tạo trong Google Calendar.
- Không sửa hoặc xóa lịch cá nhân mặc định của người dùng.
- Nhận dạng sự kiện ổn định để tránh tạo hai bản lịch giống nhau.
- Phát hiện môn thêm mới, lịch đổi phòng, đổi giờ, đổi tuần học hoặc bị xóa.
- Chặn thao tác xóa nếu MyBK chưa trả về đầy đủ tất cả các dòng.
- Xuất file `.ics` cho Apple Calendar và các ứng dụng lịch tương thích.
- Chọn một màu, màu riêng theo môn hoặc xáo màu ngẫu nhiên.
- Chọn icon theo môn với hơn 180 icon và hỗ trợ emoji tùy chỉnh.
- Extension có chế độ hỏi trước hoặc tự động cập nhật và thông báo sau.
- Giao diện sáng, tối hoặc theo cài đặt hệ thống.

## Nguyên tắc an toàn

- Hoạt động theo kiến trúc local-first, không sử dụng Firebase hoặc máy chủ
  BKalendar.
- Dữ liệu thời khóa biểu và cấu hình được lưu cục bộ trên thiết bị.
- Thông tin đăng nhập MyBK chỉ được lưu khi người dùng chủ động đồng ý.
- Mật khẩu MyBK được mã hóa trước khi lưu trong bộ nhớ cục bộ của extension và
  không được gửi đến máy chủ BKalendar.
- BKalendar không tự lưu Google access token hoặc refresh token vào cơ sở dữ
  liệu riêng.
- Chế độ **Phát hiện và hỏi trước** không ghi thay đổi vào Google Calendar khi
  chưa được người dùng duyệt.
- Chế độ **Tự động cập nhật và báo sau** chỉ hoạt động sau khi người dùng chủ
  động bật.
- Chỉ lịch riêng do BKalendar tạo mới được phép thêm, sửa hoặc xóa sự kiện.
- Bản đọc MyBK không đầy đủ hoặc không xác định không bao giờ được phép kích
  hoạt thao tác xóa.
- Nhập lại cùng một thời khóa biểu không tạo thêm bản sao sự kiện.

## Cài extension trên Chrome hoặc Edge

1. Tải file ZIP trong mục
   [Releases](https://github.com/canar1406/bk-calendar-next/releases/latest).
2. Giải nén file ZIP.
3. Mở `chrome://extensions` trên Chrome hoặc `edge://extensions` trên Edge.
4. Bật **Chế độ dành cho nhà phát triển**.
5. Chọn **Tải tiện ích đã giải nén** và chọn thư mục vừa giải nén.

Extension chỉ xin các quyền cần thiết cho bộ nhớ cục bộ, thông báo, Google
Calendar và các trang MyBK/CAS phục vụ việc theo dõi trong nền.

### Chế độ hoạt động của extension

- **Tắt theo dõi:** không tự kiểm tra MyBK.
- **Phát hiện và hỏi trước:** đọc lịch trong nền, hiển thị diff và chờ người
  dùng duyệt.
- **Tự động cập nhật và báo sau:** tự áp dụng thay đổi an toàn, sau đó gửi thông
  báo. Bấm vào thông báo để xem diff chi tiết.

Các nút kiểm tra lại trong extension thực hiện yêu cầu ở background và không mở
tab MyBK. Nếu chưa có thông tin đăng nhập, extension sẽ yêu cầu người dùng cấu
hình thay vì tự điều hướng sang MyBK.

## Đồng bộ màu và icon giữa web với extension

Người dùng chỉnh màu và icon trên website BKalendar. Khi website chính thức
được mở và extension đã cài:

1. Website lưu cấu hình theo từng hồ sơ học kỳ trong `localStorage`.
2. Website gửi cấu hình trực tiếp cho extension ngay trong trình duyệt.
3. Extension kiểm tra nguồn gửi và cấu trúc dữ liệu.
4. Cấu hình hợp lệ được lưu vào `chrome.storage.local`.
5. Lần cập nhật MyBK tiếp theo sẽ dùng đúng màu và icon đã chọn.

Không sử dụng file cấu hình ẩn. Chrome và Edge không cho phép extension tự tìm
kiếm tùy ý trong ổ đĩa nếu không xin thêm quyền truy cập tệp. Cơ chế truyền trực
tiếp trong trình duyệt an toàn hơn, không cần máy chủ và không tải cấu hình của
người dùng lên Internet.

Extension chỉ chấp nhận cấu hình từ:

```text
https://canar1406.github.io/bk-calendar-next/
```

## Cấu trúc dự án

```text
apps/
  web/                 Website tĩnh viết bằng SvelteKit
  extension/           Extension Manifest V3 cho Chrome và Edge
packages/
  core/                Parser MyBK, xử lý học kỳ và tạo snapshot
  timetable/           Định danh ổn định, diff và lưu hồ sơ cục bộ
  google-calendar/     OAuth, Google Calendar REST và reconciliation
  ical/                Xuất file theo chuẩn RFC 5545
```

## Phát triển dự án

Yêu cầu:

- Node.js 24
- pnpm 11.19.0

Cài dependency và chạy toàn bộ kiểm tra:

```bash
pnpm install
pnpm test
pnpm check
pnpm build
```

Chạy website ở môi trường local:

```bash
pnpm dev
```

Build extension:

```bash
pnpm --filter @bkalendar-next/extension build
```

Thư mục extension sau khi build:

```text
apps/extension/dist
```

Đóng gói một file ZIP dùng chung cho Chrome và Edge:

```bash
pnpm package:extension
```

File kết quả:

```text
artifacts/bkalendar-next-extension-chrome-edge.zip
```

CI cũng tải file ZIP này lên dưới dạng artifact
`bkalendar-next-extension-chrome-edge`.

## Google OAuth

Không commit credential bí mật vào repository.

Cần tạo OAuth client trong Google Cloud và bật Google Calendar API. Tài khoản
Gmail thông thường và tài khoản Google Workspace HCMUT sử dụng chung màn hình
chọn tài khoản; không giới hạn bằng hosted domain.

Sao chép `.env.example` thành `.env`, sau đó thay client ID mẫu:

```bash
PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Không đặt client secret, access token, refresh token hoặc API key vào file này.

## Apple Calendar

BKalendar hiện hỗ trợ tạo và tải file `.ics` để nhập một lần vào Apple
Calendar. Dự án chưa cung cấp WebCal, CalDAV hoặc đồng bộ Apple Calendar tự
động.

## Repository tham chiếu

Hai repository BKalendar cũ chỉ được sử dụng làm nguồn tham khảo về parser và
hành vi sản phẩm. Không chỉnh sửa trực tiếp các repository đó trong quá trình
phát triển BKalendar Next.

## Giấy phép và ghi công

Phát hành theo giấy phép MIT. Xem `LICENSE` và `NOTICE`.

Dev by [Heavn](https://home.heavietnam.com).
