# Nạp tiền ví qua VNPay

KTV nạp tiền vào ví để mua gói đẩy tin. Cổng thanh toán là **VNPay** — phổ biến nhất ở
Việt Nam, hỗ trợ thẻ nội địa/ATM/QR mà không bắt khách cài thêm ứng dụng nào.

Tài liệu này là các bước lấy credential và nối IPN. Code đã sẵn sàng — không cần sửa gì
thêm sau khi điền cấu hình.

## Luồng tiền, và vì sao nó có hai nhánh

```
KTV bấm "Nạp tiền"
   └─> POST /wallet/topup ........ tạo payment_intent (PENDING), trả URL cổng
       └─> trình duyệt sang VNPay ... khách trả tiền
           ├─> vnp_ReturnUrl ....... trình duyệt quay về /nap-tien/ket-qua
           │                          CHỈ HIỂN THỊ. Không cộng tiền.
           └─> IPN (server→server) . POST /wallet/topup/callback
                                      Kiểm chữ ký → cộng tiền vào ví.
```

**Chỉ nhánh IPN được cộng tiền.** Nhánh `ReturnUrl` đi qua máy của người dùng nên mọi
tham số trên đó đều sửa được — tin nó là để bất kỳ ai cũng tự nạp tiền cho mình bằng cách
gõ tay một URL. Trang kết quả vì vậy chỉ nói "cổng đã báo thành công, mở ví để xem số dư
thật", và luôn dẫn về ví.

Hai nhánh chạy song song và **không có thứ tự đảm bảo**: trình duyệt có thể quay về trước
khi IPN tới. Đó là lý do form nạp tiền nói trước "tiền vào ví sau khi cổng xác nhận" —
KTV thấy số dư chưa đổi mà không được báo trước sẽ nạp thêm lần nữa.

## Cấu hình

Điền vào `.env` ở gốc repo (không commit — xem `.env.example`):

| Biến | Ý nghĩa |
|---|---|
| `VNPAY_TMN_CODE` | Mã website do VNPay cấp |
| `VNPAY_HASH_SECRET` | Khoá bí mật để ký/kiểm chữ ký |
| `VNPAY_PAYMENT_URL` | Sandbox mặc định; đổi khi lên production |
| `VNPAY_RETURN_URL` | Nơi cổng trả **trình duyệt** về |

App **không** từ chối khởi động khi thiếu cấu hình (khác `Jwt:Secret`). Thiếu cổng thanh
toán chỉ làm hỏng đường nạp tiền; chặn cả app là để các trang SEO — vốn không cần thanh
toán — cùng chết theo. Lỗi nổ ở lượt bấm "Nạp tiền" đầu tiên, kèm thông báo nêu đích danh
khoá còn thiếu.

### Cái bẫy của `VNPAY_RETURN_URL`

Đường dẫn đúng là `/nap-tien/ket-qua`, **không phải** `/vi/nap-tien/ket-qua`. Tiếng Việt
là ngôn ngữ mặc định và **không có prefix locale** (xem `src/middleware.ts`), nên bản có
prefix trả 404 — đúng vào mặt KTV ngay sau khi họ vừa trả tiền xong, tức thời điểm tệ
nhất có thể để hiện một trang lỗi.

## Các bước

### 1. Đăng ký merchant

1. Vào [vnpay.vn](https://vnpay.vn) → đăng ký tài khoản merchant (cần giấy phép kinh doanh).
2. Sau khi duyệt, VNPay cấp **TmnCode** và **HashSecret** cho môi trường production.

### 2. Lấy credential sandbox để thử trước

1. Vào [sandbox.vnpayment.vn](https://sandbox.vnpayment.vn) → đăng ký tài khoản test.
2. Ghi lại TmnCode + HashSecret của sandbox.
3. Thẻ test nằm trong tài liệu sandbox (NCB, số thẻ `9704198526191432198`, OTP `123456`).

### 3. Khai IPN URL

Đây là bước **hay bị quên nhất**, và triệu chứng của nó rất dễ đọc nhầm: khách trả tiền
thành công, trang kết quả báo thành công, nhưng ví **không bao giờ được cộng** — vì cổng
không có chỗ nào để gọi về.

Khai trong trang quản trị merchant (sandbox: mục *Quản lý IPN*):

```
https://<domain-that>/api/v1/wallet/topup/callback
```

**IPN phải công khai truy cập được từ internet.** VNPay gọi thẳng từ server của họ nên
`localhost` không dùng được. Khi dev, dùng một tunnel:

```bash
cloudflared tunnel --url http://localhost:5080
# hoặc: ngrok http 5080
```

rồi khai URL tunnel làm IPN. Nhớ khai lại mỗi lần tunnel đổi domain.

### 4. Kiểm chứng

```bash
docker compose up -d --build api
```

Nạp thử một khoản nhỏ bằng thẻ test, rồi kiểm cả ba dấu vết:

```bash
# 1. Phiên đã chuyển sang SUCCEEDED (không còn PENDING)
docker compose exec postgres psql -U massage -d massage_platform \
  -c "SELECT provider_ref, status, amount, completed_at FROM payment_intents ORDER BY created_at DESC LIMIT 3;"

# 2. Có đúng MỘT bút toán TOPUP, và số dư khớp sổ cái
docker compose exec postgres psql -U massage -d massage_platform \
  -c "SELECT w.balance, COALESCE(SUM(t.amount),0) AS ledger FROM wallets w
      LEFT JOIN wallet_transactions t ON t.wallet_id = w.id GROUP BY w.id, w.balance;"
```

Hai cột ở câu thứ hai phải bằng nhau. Lệch nghĩa là có đường ghi số dư không đi qua sổ
cái — job `wallet:reconcile` lúc 3 giờ sáng sẽ báo đỏ, nhưng phát hiện ngay lúc này thì
hơn.

## Những chỗ đã cắn, đừng đảo ngược

- **IPN luôn trả HTTP 200**, kể cả khi chữ ký sai. VNPay đọc `RspCode` trong body để
  quyết định có gọi lại hay không và coi mọi mã HTTP khác 200 là "chưa tới nơi". Trả 4xx
  cho một request giả biến nó thành vòng retry vô tận; trả 4xx cho một giao dịch **đã
  cộng tiền thành công** thì tệ hơn nữa. Tách bạch: HTTP status nói *request có tới server
  không*, `RspCode` nói *chuyện gì đã xảy ra với giao dịch*.

- **Mỗi tình huống một `RspCode` riêng** (`00` xong, `01` không thấy đơn, `02` đã xác nhận
  trước đó, `04` lệch tiền, `97` sai chữ ký, `99` lỗi hệ thống). Trả `00` cho mọi thứ là
  nói với VNPay rằng một giao dịch bị từ chối vì lệch tiền đã được đối soát xong — và
  khoản lệch đó biến mất khỏi báo cáo của cả hai bên đúng lúc cần nó nhất.

- **Khoá chống lặp là `vnp_TransactionNo` của cổng**, không phải mã tự sinh. Cổng sẽ gọi
  lại đúng payload cũ khi không nhận được 200 kịp thời; khoá tự sinh thì mỗi lần gọi ra
  một khoá khác và KTV được cộng tiền nhiều lần.

- **Lệch số tiền thì không cộng gì**, dù chữ ký đúng. Chữ ký đúng chỉ chứng minh dữ liệu
  không bị sửa trên đường — nó không chứng minh số tiền khớp với phiên đã mở.

- **`vnp_ExpireDate` là trường bắt buộc** của đặc tả 2.1.0. Thiếu nó, phiên thanh toán
  không có hạn và một link nạp tiền cũ vẫn trả được nhiều ngày sau.

- **Số tiền nhân 100 phải làm tròn, không ép kiểu.** `(long)` cắt cụt phần lẻ, nên một số
  tiền mang sai số dấu phẩy động sẽ **thu nhỏ** khoản gửi sang cổng và lệch luôn với số đã
  ghi ở phiên — IPN sau đó từ chối vì lệch tiền, trong khi khách thì đã trả rồi.

- **Phiên PENDING quá 24 giờ mà cổng chưa từng gọi về** được job `topup:abandon-stale`
  (2 giờ 30 sáng) đánh dấu `ABANDONED`. Job này **không bao giờ** đụng vào hàng đã có
  `raw_callback`: có callback nghĩa là cổng đã nói chuyện với ta, và trạng thái phải do
  đường IPN quyết định chứ không phải do một job đoán thay.

## Lên production

1. Đổi `VNPAY_PAYMENT_URL` sang `https://vnpayment.vn/paymentv2/vpcpay.html`.
2. Đổi `VNPAY_TMN_CODE` / `VNPAY_HASH_SECRET` sang credential production.
3. Đổi `VNPAY_RETURN_URL` sang domain thật (`https://masgo.vn/nap-tien/ket-qua`).
4. Khai lại IPN URL trong trang quản trị production — **cấu hình sandbox không tự chuyển
   sang**.
5. Nạp thử một khoản nhỏ bằng tiền thật và chạy lại hai câu SQL ở mục Kiểm chứng.
