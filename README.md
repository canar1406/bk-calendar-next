# BKalendar Next

BKalendar Next giúp sinh viên và giảng viên HCMUT chuyển thời khóa biểu sang
Google Calendar hoặc file `.ics`, xem lịch theo tuần và theo dõi thay đổi
phòng học, giờ học, tuần học.

Dự án được phát triển kế thừa [BKalendar gốc](https://bkalendar.github.io/),
với giao diện mới, so sánh thay đổi lịch và extension kiểm tra MyBK định kỳ.

[Mở website](https://canar1406.github.io/bk-calendar-next/) ·
[Tải extension](https://github.com/canar1406/bk-calendar-next/releases/latest)

## Bản 0.5.6

- Kiểm tra lịch bằng tab nền, không tạo cửa sổ riêng. Tab tạm vẫn xuất hiện
  trên thanh tab và tự đóng sau lượt đọc.
- Hiển thị **“Lịch đã khớp Google Calendar”** khi đồng bộ xong mà không có
  thay đổi mới.
- Phân biệt **“Đã đồng bộ”**, **“Chưa đồng bộ”**, **“Đã xóa”** và **“Có thể xóa”**
  trong phần tóm tắt.

## Giới hạn cần biết

- Extension chưa chạy ẩn hoàn toàn: tab nền có thể xuất hiện tạm thời.
- Kiểm tra định kỳ cần trình duyệt đang chạy, có mạng và phiên đăng nhập hợp lệ.
- Apple Calendar chỉ hỗ trợ nhập file `.ics` một lần.
- Các portal HCMUT có thể thay đổi giao diện hoặc cách đăng nhập, ảnh hưởng
  đến việc đọc lịch.
- Chưa kiểm thử đầy đủ mọi loại tài khoản và mọi tình huống đăng nhập,
  migration trên Chrome/Edge. Nên kiểm tra kết quả trước khi dùng với dữ liệu quan trọng.

## Tính năng chính

- Đọc bốn loại lịch: sinh viên MyBK mới, sinh viên cũ, giảng viên và sau đại học.
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
- Đồng bộ lịch riêng của BKalendar; nhánh migration còn nhận diện lịch cũ
  `SV<học kỳ>`, `GV<học kỳ>` và `SDH<học kỳ>`. Cần kiểm thử migration có kiểm soát
  trước khi áp dụng lên dữ liệu quan trọng.
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

## Sử dụng website

1. Mở trang thời khóa biểu HCMUT và chọn học kỳ cần dùng.
2. Sao chép nội dung gồm thông tin học kỳ, tiêu đề bảng, toàn bộ dòng lịch và
   phần tổng số dòng ở cuối bảng nếu có. Không sao chép mật khẩu hoặc cookie.
3. Mở BKalendar Next, chọn đúng loại lịch rồi dán nội dung vào ô nhập.
4. Nhập lịch và kiểm tra bản xem trước theo tuần cùng phần thay đổi.
5. Chọn màu, icon cho từng môn nếu muốn.
6. Chọn đồng bộ Google Calendar hoặc tải `.ics` để nhập vào ứng dụng lịch khác.

Dữ liệu mẫu chỉ dùng để xem trước, không dùng để xuất hoặc đồng bộ lịch thật.

## Thiết lập extension

1. Mở popup BKalendar Next, chọn đúng loại lịch.
2. Mở **Thiết lập tự động**, nhập tài khoản MyBK và tích đồng ý lưu đăng nhập
   cục bộ nếu muốn dùng tính năng theo dõi nền.
3. Chọn chế độ cập nhật và chu kỳ kiểm tra.
4. Kết nối Google Calendar nếu muốn tự động đồng bộ.
5. Bấm **Lưu và kiểm tra ngay**, sau đó xem trạng thái và phần tóm tắt thay đổi.

### Cập nhật bản đã giải nén

1. Giải nén ZIP mới vào thư mục extension đang sử dụng, thay các file build cũ.
2. Trên trang quản lý extension, bấm **Tải lại** ở mục BKalendar Next.
3. Kiểm tra số phiên bản hiển thị trên trang chi tiết.
4. Tải lại các tab MyBK/BKalendar Web đang mở nếu chúng vẫn giữ content script cũ.

Không cần gỡ extension chỉ để cập nhật: gỡ tiện ích có thể làm mất dữ liệu và
cấu hình cục bộ. Trình duyệt không tự cập nhật một extension đã giải nén chỉ vì
bạn đã tải ZIP mới.

### Chế độ hoạt động của extension

- **Tắt theo dõi:** không tự kiểm tra MyBK.
- **Phát hiện và hỏi trước:** đọc lịch trong nền, hiển thị diff và chờ người
  dùng duyệt.
- **Tự động cập nhật và báo sau:** tự áp dụng thay đổi an toàn, sau đó gửi thông
  báo. Bấm vào thông báo để xem diff chi tiết.

Khi kiểm tra định kỳ hoặc bấm kiểm tra lại, extension tạo một tab tạm với
`active: false`, điều hướng tới nguồn lịch, đọc DOM rồi đóng tab. Không tạo cửa
sổ popup riêng hoặc cửa sổ thu nhỏ. Tab tạm không được chủ động chọn làm tab
hiện hành, nhưng vẫn có thể nhìn thấy trên thanh tab.

Các chu kỳ hiện có: **5, 10, 15, 30 hoặc 60 phút**. Extension cũng kiểm tra khi
trình duyệt khởi động và quan sát thay đổi DOM khi trang lịch đang mở.
Đây là kiểm tra định kỳ kết hợp quan sát trang, không phải dịch vụ push
thời gian thực 24/7 từ MyBK. Không đảm bảo kiểm tra khi trình duyệt đóng,
máy ngủ, mạng mất kết nối hoặc phiên đăng nhập không sử dụng được.

Nếu chưa lưu thông tin đăng nhập, người dùng cần cấu hình và xác nhận đồng ý.
Các nguồn lịch cũ còn phụ thuộc việc portal HCMUT tiếp tục phục vụ format đó.

### Đọc trạng thái popup

- **Lịch đã khớp Google Calendar:** lượt sync hoàn tất, không cần ghi thay đổi.
- **Đã tự động cập nhật:** lượt sync có thao tác thêm, sửa hoặc xóa.
- **Chưa đồng bộ:** bản đọc chưa được áp dụng; không có nghĩa lịch trên Google
  đang trống.
- Các số **Thêm mới / Thay đổi / Có thể xóa (hoặc Đã xóa)** mô tả thay đổi
  của lượt kiểm tra, không phải tổng số sự kiện trong học kỳ.
- Timeout/lỗi capture không được xem là bằng chứng lịch đã bị xóa hết.

## Đồng bộ màu và icon giữa web với extension

Người dùng chỉnh màu và icon trên website BKalendar. Khi website chính thức
được mở và extension đã cài:

1. Website lưu cấu hình theo từng hồ sơ học kỳ trong `localStorage`.
2. Website gửi cấu hình trực tiếp cho extension ngay trong trình duyệt.
3. Extension kiểm tra nguồn gửi và cấu trúc dữ liệu.
4. Cấu hình hợp lệ được lưu vào `chrome.storage.local`.
5. Lần cập nhật MyBK tiếp theo sẽ dùng đúng màu và icon đã chọn.

Việc trao đổi cấu hình giữa web và extension diễn ra trong trình duyệt,
không qua máy chủ BKalendar.

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
pnpm lint
pnpm build
pnpm test
pnpm check
```

Một số test đọc output extension trong `dist`, vì vậy cần build trước khi
chạy toàn bộ test trên một checkout mới.

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

Code web và manifest extension giữ nguyên:

```text
https://www.googleapis.com/auth/calendar.events
https://www.googleapis.com/auth/calendar.calendarlist.readonly
https://www.googleapis.com/auth/calendar.app.created
```

`calendar.events` phục vụ thao tác event, bao gồm migration lịch cũ;
`calendar.calendarlist.readonly` dùng tìm lịch; `calendar.app.created` dùng
tạo và quản lý lịch riêng của app.

### Cảnh báo khi đăng nhập Google

Nếu Google hiển thị **“Ứng dụng chưa được xác minh”**, mọi người nên đọc kỹ
các quyền được yêu cầu trước khi quyết định kết nối. Bản này yêu cầu quyền
Calendar để đồng bộ và chuyển lịch cũ; việc phát hành trên GitHub không đồng
nghĩa ứng dụng đã được Google xác minh. Nếu chưa muốn cấp quyền, có thể dùng
chức năng tải `.ics` mà không kết nối Google.

Khi dùng bản extension unpacked hiện tại trên Edge/Chrome, OAuth client loại
**Web application** dùng cho luồng đăng nhập extension phải có Authorized
redirect URI:

```text
https://bmpehgipalackfeiihijiliealbcbcbk.chromiumapp.org/
```

Đây là redirect URI tương ứng với extension ID của bản phát hành hiện tại.
Nếu cài một bản extension có ID khác, mở `chrome://extensions` hoặc
`edge://extensions`, xem ID của extension rồi dùng:

```text
https://<EXTENSION_ID>.chromiumapp.org/
```

Không thêm dấu cách hoặc bỏ dấu `/` cuối URI. Nếu URI chưa được khai báo,
Google sẽ trả lỗi `redirect_uri_mismatch` và nút **Kết nối** sẽ không thể hoàn
tất.

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

- [Giao diện BKalendar gốc](https://github.com/bkalendar/bkalendar.github.io)
- [Bộ xử lý thời khóa biểu BKalendar](https://github.com/bkalendar/core)

Cảm ơn các tác giả BKalendar đã chia sẻ mã nguồn và đặt nền tảng cho dự án này.

## Giấy phép và ghi công

Phát hành theo giấy phép MIT. Xem `LICENSE` và `NOTICE`.

Dev by [Heavn](https://home.heavietnam.com).
