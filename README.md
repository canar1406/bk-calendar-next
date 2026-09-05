# BKalendar Next

BKalendar Next giúp sinh viên HCMUT chuyển thời khóa biểu MyBK sang Google
Calendar hoặc file `.ics`, theo dõi thay đổi lịch học và hạn chế tối đa nguy cơ
nhân đôi hoặc xóa nhầm sự kiện cá nhân.

Website: <https://canar1406.github.io/bk-calendar-next/>

Các bản extension đã phát hành:
<https://github.com/canar1406/bk-calendar-next/releases/latest>

## Trạng thái bản mã nguồn hiện tại

Extension trong mã nguồn có phiên bản **0.5.6**. Bản này chuyển tracking về
**tab inactive** và bỏ thử nghiệm offscreen. Tab tạm vẫn có thể xuất hiện trên
thanh tab; đây **không phải chế độ ẩn hoàn toàn**.

Các thay đổi đang có:

- Dùng tab `active: false` để đọc trang lịch và xử lý đăng nhập.
- Đóng tab tạm sau khi nhận được lịch hoặc lượt capture kết thúc bằng lỗi.
- Bỏ permission, tài liệu HTML và bước build offscreen.
- Sửa popup: khi Google sync hoàn tất với 0 thao tác ghi, hiển thị
  **“Lịch đã khớp Google Calendar”** và **“Đã đồng bộ”**.
- Phân biệt **“Đã xóa”** sau khi áp dụng với **“Có thể xóa”** khi còn chờ duyệt.
- Giữ nguyên ba scope Google Calendar được liệt kê bên dưới.

Source trên nhánh `main`, ZIP build cục bộ và GitHub Release là ba trạng thái
khác nhau. Push source không tự thay bản extension đang cài trên máy. Hãy kiểm
tra phiên bản của Release/artifact trước khi tải; mục Releases có thể chưa có
ZIP trùng với phiên bản source mới nhất.

Đợt rà soát toàn bộ source chưa hoàn tất. Test tự động và build không thay thế
kiểm thử MyBK/CAS, Chrome/Edge và Google Calendar bằng tài khoản thật.

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
tạo và quản lý lịch riêng của app. Không tự hạ scope để che cảnh báo OAuth.
Trạng thái xét duyệt phải được kiểm tra trực tiếp trong Google Cloud Console;
source hoặc ZIP build thành công không chứng minh app đã được Google xác minh.

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

Hai repository BKalendar cũ chỉ được sử dụng làm nguồn tham khảo về parser và
hành vi sản phẩm. Không chỉnh sửa trực tiếp các repository đó trong quá trình
phát triển BKalendar Next.

## Giấy phép và ghi công

Phát hành theo giấy phép MIT. Xem `LICENSE` và `NOTICE`.

Dev by [Heavn](https://home.heavietnam.com).
