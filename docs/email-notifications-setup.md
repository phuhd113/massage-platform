# Email báo hồ sơ KTV chờ duyệt

Khi một kỹ thuật viên hoàn tất hồ sơ (ký cam kết **và** gửi ảnh CCCD), hệ thống gửi một email
tới ban quản trị kèm link đi thẳng tới hai trang duyệt.

Tài liệu này là các bước lấy credential. Code đã sẵn sàng — không cần sửa gì thêm sau khi điền
cấu hình.

## Gửi vào lúc nào

Điều kiện để hồ sơ được duyệt gồm **hai** thứ, đến từ hai thao tác độc lập của KTV theo thứ tự
bất kỳ:

1. Ký cam kết KTV (`POST /ktv/profile/commitments`)
2. Gửi ảnh CCCD hai mặt (`PUT /ktv/profile/identity`)

Email gửi khi **cả hai đã xong** — tức lúc KTV đã làm hết phần việc của họ và quả bóng sang chân
ban quản trị. Gửi ở từng thao tác một sẽ cho hai email mỗi người, mà cái đến trước báo một việc
chưa làm được gì.

Cột `ktv_profiles.submission_notified_at` chống gửi trùng. Nó **trở về NULL khi KTV gửi lại CCCD**:
lượt gửi lại (sau khi bị từ chối, hoặc thay thẻ khác) cần được xem lại từ đầu, nên nó sinh một
email nữa — đúng lý do hàng đợi CCCD tách khỏi hàng đợi hồ sơ.

Lưu ý: email này **không** chờ CCCD được duyệt. Duyệt CCCD chính là việc email mời bạn đi làm.

## Adapter được chọn thế nào

Không có cờ `UseResend` nào cả. `EmailSenderSetup` chọn theo thứ tự:

| Điều kiện | Adapter | Hành vi |
|---|---|---|
| `Notifications:StubEnabled=true` | `LogEmailSender` | Ghi nội dung email ra log |
| Có `Resend:ApiKey` | `ResendEmailSender` | Gửi thật qua Resend |
| Còn lại | `LogEmailSender` | Ghi log |

**Stub luôn thắng khi được bật**, kể cả khi đã có API key thật — cùng luật với `Otp:StubEnabled`.
Nếu không, một máy dev có `.env` thật sẽ gửi email thật, im lặng, vì lượt gửi vẫn thành công.

App **không** từ chối khởi động khi thiếu cấu hình (khác `Jwt:Secret`): thiếu kênh thông báo chỉ
làm chậm việc phát hiện hồ sơ mới, còn `/admin/duyet-ktv` vẫn là nguồn sự thật đầy đủ.

Ngoại lệ duy nhất: có `Resend:ApiKey` mà thiếu `Notifications:FromEmail` thì app **từ chối khởi
động**. Resend từ chối mọi lượt gửi không có người gửi thuộc domain đã verify, nên tổ hợp đó là
một cấu hình chắc chắn hỏng — fail fast tốt hơn là hỏng ở hồ sơ thật đầu tiên.

Chưa khai `Notifications:AdminEmails` thì không gửi cho ai và chỉ ghi log `Debug` — đó là trạng
thái bình thường trên máy dev.

## Các bước

### 1. Tạo tài khoản Resend

Đăng ký ở [resend.com](https://resend.com). Gói miễn phí cho **3.000 email/tháng**, dư xa nhu cầu
ở đây (mỗi hồ sơ KTV một email).

Chọn Resend thay SMTP vì VPS thường chặn port outbound 25/587, và việc đó hỏng **im lặng** — kết
nối treo tới lúc timeout, đọc như lỗi cấu hình chứ không như lỗi mạng.

### 2. Verify domain masgo.vn

Vào **Domains → Add Domain**, nhập `masgo.vn`. Resend đưa ra vài bản ghi DNS (SPF, DKIM, và
tuỳ chọn DMARC).

Thêm chúng ở Cloudflare (nơi đang quản DNS của masgo.vn):

- Bản ghi DKIM là `TXT`, tên dạng `resend._domainkey`
- Bản ghi SPF là `TXT` ở gốc domain, giá trị chứa `include:amazonses.com`
- **Tắt proxy (đám mây xám)** cho các bản ghi này — chúng là TXT nên Cloudflare không proxy,
  nhưng nếu bạn thêm bản ghi `MX` thì phải để DNS only

Bấm **Verify** ở Resend sau khi thêm xong. Thường mất vài phút.

> Bỏ qua bước này thì mọi lượt gửi bị từ chối. Resend báo lỗi đó ở **body** của response chứ
> không phải bằng một status code riêng — `ResendEmailSender` vì vậy đọc cả body và ghi nguyên
> văn vào log.

### 3. Tạo API key

**API Keys → Create API Key**, quyền **Sending access** là đủ. Key hiện đúng một lần, dạng `re_...`.

### 4. Điền cấu hình

Vào `.env` ở gốc repo (không được commit):

```bash
NOTIFICATIONS_ADMIN_EMAILS=phu.hoduy113@gmail.com
NOTIFICATIONS_FROM_EMAIL=thong-bao@masgo.vn
NOTIFICATIONS_FROM_NAME=MasGo
NOTIFICATIONS_ADMIN_BASE_URL=https://masgo.vn
NOTIFICATIONS_STUB_ENABLED=false
RESEND_API_KEY=re_...
```

`NOTIFICATIONS_ADMIN_EMAILS` nhận **nhiều địa chỉ phân cách bằng dấu phẩy** — thêm người duyệt
sau này chỉ là sửa dòng này, không phải deploy lại code.

`NOTIFICATIONS_FROM_EMAIL` phải thuộc domain đã verify ở bước 2. Hộp thư đó không cần tồn tại
thật (không ai trả lời vào đó), nhưng domain thì phải verify.

`NOTIFICATIONS_ADMIN_BASE_URL` là gốc URL để email dựng link tới trang duyệt. Trên máy dev để
`http://localhost:3000`.

Rồi:

```bash
docker compose up -d api    # nạp lại biến môi trường
```

### 5. Kiểm chứng

Cách chắc chắn nhất là đi hết luồng thật: tạo tài khoản KTV, tạo hồ sơ, ký cam kết, gửi CCCD.

Còn ở chế độ stub thì đọc log:

```bash
docker compose logs api | grep -A 16 "KHÔNG GỬI THẬT"
```

Đã bật gửi thật thì tìm dòng xác nhận kèm id của Resend:

```bash
docker compose logs api | grep "qua Resend"
```

Không thấy gì cả thường là do **chưa khai `NOTIFICATIONS_ADMIN_EMAILS`** — khi đó `AdminNotifier`
trả về sớm và chỉ ghi log mức `Debug`. Kiểm bằng:

```bash
docker compose exec api printenv | grep Notifications__
```

## Khi Resend hỏng thì sao

**KTV vẫn nộp được hồ sơ.** Người gây ra lượt gửi không phải người nhận email, nên một sự cố ở
nhà cung cấp không được chặn onboarding của họ — cùng nguyên tắc với beacon `profile_views` nuốt
lỗi khoá ngoại.

Lỗi ghi ở mức **Error** trong log kèm nguyên văn phản hồi của Resend. Đó là thứ duy nhất nói được
rằng kênh thông báo đang chết, nên đáng để đưa vào cảnh báo vận hành nếu sau này có.

Cái giá đã cân nhắc: email hỏng thì hồ sơ nằm im trong hàng đợi tới khi có người mở
`/admin/duyet-ktv`. Chấp nhận được vì trang đó vẫn đầy đủ — email chỉ rút ngắn thời gian phát
hiện, không phải cơ chế duy nhất để biết.

## Chưa làm, và cố ý

**Email cho chính KTV** (xác nhận đã nhận hồ sơ). Hệ thống chưa thu thập email của người dùng —
đăng nhập bằng số điện thoại — nên việc đó cần thêm cột, migration, sửa form đăng ký, và xử lý
hồ sơ cũ không có email.
