# Gửi OTP qua Zalo ZNS

Hệ thống gửi mã đăng nhập qua **Zalo Notification Service (ZNS)** thay vì SMS brandname:
gần như mọi người dùng Việt Nam đều có Zalo, giá rẻ hơn đáng kể, và tin đến từ OA đã xác
thực nên khó bị giả mạo hơn.

Tài liệu này là các bước lấy credential. Code đã sẵn sàng — không cần sửa gì thêm sau khi
điền cấu hình.

## Adapter được chọn thế nào

Không có cờ `UseZns` nào cả. `OtpSenderSetup` chọn theo thứ tự:

| Điều kiện | Adapter | Hành vi |
|---|---|---|
| `Otp:StubEnabled=true` | `StubOtpSender` | Ghi log + trả mã trong `debugCode` |
| Có đủ `AppId` + `SecretKey` + `TemplateId` | `ZaloZnsSender` | Gửi thật qua ZNS |
| Còn lại | `UnconfiguredOtpSender` | Mọi lượt xin mã trả **503** kèm log rõ nguyên nhân |

**Stub luôn thắng khi được bật**, kể cả khi đã có credential thật. Nếu không, một máy dev
có `.env` thật sẽ gửi tin tới số thật và đốt quota — im lặng, vì lượt gửi vẫn thành công.

App **không** từ chối khởi động khi thiếu cấu hình ZNS (khác `Jwt:Secret`). Thiếu nhà cung
cấp chỉ làm hỏng đường đăng nhập; chặn cả app là biến một tính năng hỏng thành toàn bộ sàn
ngừng phục vụ, kể cả các trang SEO vốn không cần đăng nhập.

## Các bước

### 1. Tạo Official Account

1. Vào [oa.zalo.me](https://oa.zalo.me), tạo OA loại **Doanh nghiệp**.
2. Xác thực OA (cần giấy phép kinh doanh). **ZNS chỉ dùng được với OA đã xác thực.**

### 2. Tạo ứng dụng và liên kết OA

1. Vào [developers.zalo.me](https://developers.zalo.me) → tạo ứng dụng mới.
2. Trong ứng dụng, thêm sản phẩm **Zalo Notification Service**.
3. Liên kết ứng dụng với OA vừa tạo.
4. Ghi lại **App ID** và **Secret Key**.

### 3. Tạo template OTP

Vào ZNS → Quản lý template → tạo template loại **OTP/Xác thực**.

Nội dung mẫu:

```
Mã xác thực của bạn là <otp>. Mã có hiệu lực trong <expiry> phút.
Không chia sẻ mã này với bất kỳ ai.
```

Ba điều quyết định cấu hình phía code:

- **Tên tham số do bạn đặt.** Ở ví dụ trên là `otp` và `expiry`. Điền đúng tên đó vào
  `Zalo:Zns:CodeParamName` và `Zalo:Zns:ExpiryParamName`. Khai sai thì ZNS trả lỗi tham số
  chứ không gửi tin — và lỗi đó đọc như lỗi quyền.
- **Không có tham số hạn thì để `ExpiryParamName` trống.** Code sẽ không gửi tham số đó.
- Template OTP thường được duyệt trong **1–2 ngày làm việc**.

Ghi lại **Template ID** sau khi được duyệt.

### 4. Lấy refresh token

Đây là bước dễ nhầm nhất. Zalo dùng OAuth với PKCE:

1. Trong ứng dụng, thêm **Callback URL** (ví dụ `https://your-domain.com/zalo-callback`).
2. Mở URL uỷ quyền trên trình duyệt, đăng nhập bằng tài khoản **quản trị OA**:

   ```
   https://oauth.zaloapp.com/v4/oa/permission?app_id=<APP_ID>&redirect_uri=<CALLBACK_URL>&state=x
   ```

3. Sau khi đồng ý, Zalo redirect về callback kèm `?code=...`.
4. Đổi `code` lấy cặp token:

   ```bash
   curl -X POST https://oauth.zaloapp.com/v4/oa/access_token \
     -H "secret_key: <SECRET_KEY>" \
     -d "code=<CODE>&app_id=<APP_ID>&grant_type=authorization_code"
   ```

5. Lấy `refresh_token` trong response.

**Refresh token có hạn 3 tháng** và **bị xoay mỗi lần dùng**: Zalo cấp bản mới và vô hiệu
bản cũ ngay trong cùng lượt refresh.

Vì vậy hệ thống lưu nó ở bảng `zalo_tokens` trong Postgres, không phải trong file cấu hình.
Giá trị trong cấu hình chỉ là **hạt giống cho lần chạy đầu tiên** — từ lượt refresh đầu tiên
trở đi, DB là nguồn duy nhất. Nếu giữ trong bộ nhớ thì restart container là mất bản mới, và
bản trong cấu hình lúc đó đã chết.

### 5. Điền cấu hình

```bash
# .env ở gốc repo (không commit)
ZALO_ZNS_APP_ID=...
ZALO_ZNS_SECRET_KEY=...
ZALO_ZNS_REFRESH_TOKEN=...
ZALO_ZNS_TEMPLATE_ID=...
ZALO_ZNS_CODE_PARAM=otp
ZALO_ZNS_EXPIRY_PARAM=expiry
```

Và tắt stub ở môi trường thật: `Otp__StubEnabled=false`.

### 6. Thử trước khi mở cho khách

Template chưa được duyệt cho production thì bật `Zalo:Zns:DevMode=true`: Zalo chỉ nhận số
đã đăng ký trong danh sách test của OA và **không trừ quota**.

```bash
curl -X POST http://localhost:5080/api/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"phone":"09xxxxxxxx"}'
```

Mong đợi: HTTP 200, **không có** `debugCode` trong response, và tin đến Zalo trong vài giây.

Nếu 503, chi tiết thật nằm trong **log server** — response cố ý chỉ có một câu chung, vì
message nội bộ nêu đích danh khoá cấu hình còn thiếu:

```bash
docker compose logs api | grep -A3 "Không gửi được OTP"
```

## Mã lỗi hay gặp

| Lỗi | Nghĩa | Xử lý |
|---|---|---|
| `-124` / `-216` | Access token sai hoặc hết hiệu lực | Tự xử lý: code làm mới token rồi gửi lại **một** lần |
| `Invalid appId` | App ID sai, hoặc chưa liên kết OA | Kiểm lại bước 2 |
| `-108` | Template không hợp lệ | Template chưa duyệt, hoặc sai `TemplateId` |
| `-118` | Số không nằm trong danh sách test | Đang bật `DevMode` — thêm số vào danh sách test của OA |
| `-114` | Hết quota | Nạp thêm ZNS |

## Ba điều đừng vô tình đảo ngược

- **ZNS trả HTTP 200 cho cả lượt thất bại.** Chỉ trường `error` trong body mới nói thật.
  Đọc status code là đủ để tin rằng mọi tin đều gửi được, trong khi không tin nào tới nơi.
  `ZaloZnsSenderTests` canh chính điều này.

- **Số điện thoại phải đổi sang dạng `84xxxxxxxxx`.** Hệ thống lưu `0xxxxxxxxx`
  (`AuthService.NormalizePhone`); gửi thẳng thì ZNS trả lỗi tham số.

- **Việc gửi đứng TRƯỚC khi ghi DB.** Vô hiệu mã cũ rồi mới phát hiện không gửi được nghĩa
  là người dùng vừa mất mã đang cầm trên tay để đổi lấy một mã không bao giờ tới — với
  người bấm "gửi lại" vì tin đến chậm, đó là biến một phiền toái thành đăng nhập hỏng hẳn.
  Có test canh cả hai chiều.
