# Email Server (P.A Việt Nam) — hộp thư @masgo.vn

Dịch vụ **Email Pro #1** của P.A Việt Nam, chạy trên hạ tầng của họ tại
`112.213.92.231` (`mail92231.maychuemail.com`). MasGo chỉ **trỏ DNS** sang đó — không có
mail server nào chạy trên VPS `161.248.4.60`, và cũng không nên có: cổng 25 của phần lớn
VPS bị nhà cung cấp chặn sẵn, còn danh tiếng IP của một VPS mới tinh thì gần như đảm bảo
thư đi vào spam.

Tài liệu này **chỉ nói về DNS và hộp thư**. Backend .NET hiện **chưa** gửi email nào —
không có `IEmailSender`, không có cấu hình SMTP. Đó là việc tách riêng; xem mục cuối.

Trạng thái đo được trước khi cấu hình (2026-09-08): `masgo.vn` **không có bản ghi MX và
không có TXT nào**. Nên toàn bộ phần dưới là **thêm mới**, không đè lên gì đang chạy.

---

## 0. Đổi mật khẩu TRƯỚC, làm DNS sau

Email kích hoạt của P.A gửi kèm mật khẩu quản trị dạng chữ rõ. Nó đã đi qua ít nhất một
hộp thư, và thường còn nằm trong ảnh chụp màn hình hoặc lịch sử chat.

1. Vào `https://mail92231.maychuemail.com:1000`
2. Đăng nhập bằng tài khoản quản trị `masgo2d74fe1@masgo.vn`
3. Đổi mật khẩu ngay.

Làm bước này trước vì sau khi DNS trỏ xong, hộp thư bắt đầu **nhận thư thật** — trong đó
có thư đặt lại mật khẩu của các dịch vụ khác. Một hộp thư dùng mật khẩu đã lộ mà lại đang
nhận thư reset là đường chiếm tài khoản, không chỉ là chuyện vệ sinh mật khẩu.

Tài khoản `masgo2d74fe1@masgo.vn` là **tài khoản quản trị của gói**, không phải hộp thư
để dùng hằng ngày. Hộp thư thật (`ban@masgo.vn`, xem mục 4) tạo riêng trong trang quản trị.

---

## 1. Năm bản ghi DNS ở Cloudflare

DNS của `masgo.vn` do **Cloudflare** quản lý (nameserver `seamus.ns.cloudflare.com`), nên
tất cả khai ở đó — không khai ở trang của P.A.

Vào [dash.cloudflare.com](https://dash.cloudflare.com) → chọn `masgo.vn` → **DNS** →
**Records** → **Add record**, thêm đúng năm bản ghi sau:

| Type | Name | Content / Target | Priority | Proxy |
|---|---|---|---|---|
| MX | `@` | `mail92231.maychuemail.com` | 5 | — |
| MX | `@` | `mx92231.maychuemail.net` | 10 | — |
| CNAME | `mail` | `mail92231.maychuemail.com` | — | **DNS only** |
| CNAME | `mx` | `mx92231.maychuemail.net` | — | **DNS only** |
| TXT | `@` | `v=spf1 include:spf.maychuemail.com ~all` | — | — |

### Bốn điều dễ làm sai ở bước này

- **Hai CNAME `mail` và `mx` PHẢI để "DNS only" (đám mây XÁM), không phải Proxied
  (đám mây CAM).** Đây là bẫy nghiêm trọng nhất của cụm này. Cloudflare chỉ proxy được
  HTTP/HTTPS; bật proxy lên thì bản ghi trả về **IP của Cloudflare** thay vì
  `112.213.92.231`, và mọi kết nối SMTP/IMAP tới `mail.masgo.vn` đi vào một nơi không
  nói được giao thức đó. Trang webmail có thể vẫn mở được, nên lỗi đọc như "Outlook bị
  làm sao" chứ không như lỗi DNS.

- **Bản ghi MX trỏ tới hostname, và hostname đó không được là bản ghi đã proxy.** Ở đây
  MX trỏ thẳng sang `maychuemail.com`/`.net` (miền của P.A, ngoài tầm Cloudflare của ta)
  nên an toàn. Đừng "gọn gàng hoá" bằng cách đổi MX sang trỏ về `mail.masgo.vn` — nếu
  CNAME đó lỡ bật proxy thì thư đến được chuyển tới Cloudflare và mất, mà RFC cũng cấm
  MX trỏ vào CNAME.

- **Bản ghi A của `masgo.vn` giữ nguyên `161.248.4.60`, vẫn Proxied.** Website và email
  là hai thứ độc lập: A record phục vụ trình duyệt, MX phục vụ mail server. Thêm MX
  **không** ảnh hưởng gì tới web, và đừng đổi A record theo.

- **Chỉ được có MỘT bản ghi TXT SPF cho `@`.** Nhiều hơn một chuỗi `v=spf1` là SPF
  **PermError**, và hệ quả là thư bị đánh spam — tệ hơn hẳn so với không có SPF. Nếu sau
  này thêm dịch vụ gửi mail khác (ví dụ một dịch vụ gửi mail giao dịch), phải **gộp vào
  cùng một dòng**:

  ```
  v=spf1 include:spf.maychuemail.com include:dich-vu-khac.com ~all
  ```

  chứ không thêm dòng TXT thứ hai.

### Vì sao `~all` chứ không `-all`

`~all` là **SoftFail**: thư gửi từ nguồn ngoài danh sách bị đánh dấu đáng ngờ nhưng vẫn
được nhận. `-all` (HardFail) bảo bên nhận từ chối thẳng.

Giữ `~all` như P.A khuyến nghị cho tới khi chắc chắn **mọi** đường gửi mail dưới tên
`@masgo.vn` đều đã nằm trong SPF. Siết lên `-all` sớm nghĩa là ngày backend bắt đầu gửi
mail qua một đường chưa khai, toàn bộ thư đó bị **từ chối im lặng** — người nhận không
thấy gì, và bên gửi cũng không thấy gì ngoài "đã gửi".

---

## 2. DKIM — phải hỏi P.A, không tự sinh

Hướng dẫn của P.A ghi *"DKIM vui lòng liên hệ với đội ngũ kỹ thuật để lấy thông số"*.
Đây không phải bước tuỳ chọn bỏ qua được: **SPF một mình không đủ**. Gmail và Microsoft
365 hiện yêu cầu bên gửi có SPF **và** DKIM để không bị hạ vào spam, và DMARC (mục 3)
chỉ thật sự có tác dụng khi có ít nhất một trong hai cái *căn khớp* (alignment) với tên
miền — với dịch vụ mail dùng chung như thế này, cái căn khớp được là DKIM.

Liên hệ kỹ thuật P.A, xin **selector** và **giá trị public key**, rồi thêm:

| Type | Name | Content |
|---|---|---|
| TXT | `<selector>._domainkey` | `v=DKIM1; k=rsa; p=<public key P.A cấp>` |

Không tự sinh cặp khoá: khoá riêng phải nằm trên **máy chủ đang ký thư**, mà máy đó là
của P.A. Một bản ghi DKIM với khoá ta tự sinh sẽ không khớp chữ ký nào cả, và kết quả tệ
hơn không khai — thư có chữ ký nhưng **xác minh thất bại** bị chấm điểm nặng tay hơn thư
không có chữ ký.

---

## 3. DMARC — thêm sau khi SPF và DKIM đã chạy

Không có trong hướng dẫn của P.A, nhưng nên có: DMARC là thứ nói cho bên nhận biết phải
làm gì khi SPF/DKIM fail, và quan trọng hơn — nó là thứ chặn người khác **giả danh
@masgo.vn**. Với một sàn có tài khoản người dùng, thư giả danh là đường lừa đảo trực tiếp
vào chính khách của mình.

Thêm **sau** khi đã xác nhận thư đi vào Inbox của Gmail (mục 5), và bắt đầu ở chế độ chỉ
quan sát:

| Type | Name | Content |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:ban@masgo.vn; pct=100` |

`p=none` **không** chặn gì cả — nó chỉ yêu cầu bên nhận gửi báo cáo tổng hợp về `rua=`.
Chạy vài tuần, đọc báo cáo để biết còn nguồn gửi nào chưa khai, rồi mới siết dần
`p=quarantine` → `p=reject`.

Đừng đặt thẳng `p=reject` ngay: nếu còn một đường gửi hợp lệ chưa nằm trong SPF/DKIM,
toàn bộ thư của đường đó bị **từ chối**, và triệu chứng là "khách không nhận được mail"
mà không có gì trong log của ta cho thấy nguyên nhân.

---

## 4. Tạo hộp thư dùng thật

Trong trang quản trị `https://mail92231.maychuemail.com:1000`, tạo các hộp thư thật.
Tối thiểu:

- **`ban@masgo.vn`** — địa chỉ này **đã được khai trong `.env.production.example`** ở biến
  `ACME_EMAIL`, tức là nơi Let's Encrypt gửi cảnh báo khi chứng chỉ TLS sắp hết hạn mà
  chưa gia hạn được. Cho tới lúc này nó là một địa chỉ **không tồn tại**, nghĩa là cảnh
  báo đó rơi vào hư vô. Tạo hộp thư này là việc đáng làm đầu tiên.

Cân nhắc thêm, tuỳ nhu cầu: `hotro@masgo.vn` (khách và KTV liên hệ), `noreply@masgo.vn`
(dành sẵn cho mail tự động sau này).

Thông số cấu hình trên Outlook/Thunderbird/điện thoại:

| | Máy chủ | Cổng | Bảo mật |
|---|---|---|---|
| IMAP (nhận) | `mail.masgo.vn` | 993 | SSL/TLS |
| SMTP (gửi) | `mail.masgo.vn` | 465 | SSL/TLS |

Tên đăng nhập là **địa chỉ email đầy đủ**, không phải phần trước dấu `@`.

Dùng `mail.masgo.vn` (CNAME ta vừa tạo) thay vì `mail92231.maychuemail.com`: nếu sau này
P.A chuyển gói sang máy chủ khác, chỉ cần sửa một CNAME thay vì đi sửa cấu hình trên từng
máy và từng điện thoại. Điều kiện để việc này đúng là CNAME phải **DNS only** — xem mục 1.

---

## 5. Kiểm chứng — đừng tin giao diện, hãy đo

DNS Cloudflare thường lan trong vài phút, nhưng cứ để tới 30 phút trước khi kết luận là
sai. Kiểm bằng resolver công cộng (`8.8.8.8`) chứ không bằng DNS của máy mình — máy mình
có thể còn cache kết quả "không có bản ghi" từ trước:

```bash
# Phải thấy hai dòng MX, priority 5 và 10
nslookup -type=MX masgo.vn 8.8.8.8

# Phải thấy đúng MỘT dòng v=spf1
nslookup -type=TXT masgo.vn 8.8.8.8

# BẮT BUỘC trả về 112.213.92.231.
# Nếu ra một IP khác (dải 104.x / 172.6x.x của Cloudflare) thì CNAME đang bật Proxy —
# quay lại mục 1 và tắt nó đi.
nslookup mail.masgo.vn 8.8.8.8
```

Sau đó kiểm đường thư thật, cả hai chiều:

1. **Nhận**: gửi một thư từ Gmail cá nhân tới `ban@masgo.vn`, mở webmail
   `https://mail92231.maychuemail.com` xem có tới không.
2. **Gửi**: từ webmail gửi ngược lại về Gmail đó. Kiểm **Inbox và cả Spam** — vào được
   Spam vẫn là "gửi được", nhưng là tín hiệu cho thấy phần DKIM (mục 2) chưa xong.
3. Ở Gmail, mở thư nhận được → menu ba chấm → **Hiển thị bản gốc**. Cần thấy:

   ```
   SPF:   PASS
   DKIM:  PASS      <- còn 'không có' cho tới khi làm xong mục 2
   DMARC: PASS
   ```

   Đây là chỗ duy nhất nói thật. Webmail báo "đã gửi" cho cả thư bị bên nhận quẳng vào
   spam lẫn thư bị từ chối thẳng — cùng loại bẫy với `docker compose build` báo "Built"
   khi publish đã fail, và với ZNS trả HTTP 200 cho lượt gửi thất bại.

Công cụ ngoài để soi tổng thể: [mail-tester.com](https://www.mail-tester.com) — gửi một
thư tới địa chỉ nó cấp rồi xem điểm; nó chỉ đích danh bản ghi nào còn thiếu.

---

## 6. Chưa làm, và cố ý: backend gửi email

Codebase **không có** `IEmailSender`, MailKit hay cấu hình SMTP nào, và tài liệu này
không thêm gì trong đó. Hộp thư ở trên dùng bằng webmail và Outlook.

Khi nào nối vào app thì đi theo đúng khuôn `IOtpSender` đã có
(`src/Massage.Api/Modules/Auth/Sms/`), vì các quyết định ở đó áp dụng nguyên vẹn:

- **Chọn adapter theo credential, không theo cờ cấu hình** — như `StorageSetup` chọn R2
  hay đĩa local. Một cờ `Email__Enabled=true` riêng sẽ có lúc bật mà thiếu thông số, và
  app khởi động bình thường rồi mới hỏng ở lượt gửi đầu tiên, tức hỏng trên tay người
  dùng thật.
- **Stub thắng bản gửi thật khi cả hai cùng có** — máy dev có `.env` thật mà thiếu luật
  này sẽ gửi thư tới địa chỉ thật, im lặng, vì lượt gửi vẫn thành công.
- **Thiếu cấu hình KHÔNG chặn app khởi động** (khác `Jwt:Secret`). Thiếu email chỉ hỏng
  một tính năng; chặn cả app là để các trang SEO chết theo.
- **Thêm đường gửi mới vào SPF nếu app gửi qua đường khác P.A** — gộp vào cùng dòng
  `v=spf1`, xem cảnh báo ở mục 1.

Về **quên mật khẩu** (CLAUDE.md ghi là chưa làm vì "kênh reset khả thi duy nhất là OTP
hoặc email, cả hai chưa chạy"): có email server **chưa** đủ để mở đường này. Người dùng
hiện đăng ký bằng **số điện thoại**, bảng `users` không có cột email, nên không có địa
chỉ nào để gửi tới. Muốn dùng email làm kênh reset thì phải thêm cột email, thêm đường
xác minh địa chỉ đó, và xử lý toàn bộ tài khoản cũ không có email — đó là một khối việc
riêng, không phải hệ quả tự nhiên của việc dựng hộp thư.
