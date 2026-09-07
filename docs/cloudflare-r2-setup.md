# Cloudflare R2 — lưu ảnh hồ sơ và file giấy tờ

Hệ thống lưu bốn loại file, và **chúng không cùng chế độ truy cập**:

| Loại | Prefix trong bucket | Truy cập | Vì sao |
|---|---|---|---|
| Ảnh đại diện KTV | `avatars/` | Công khai | Nằm trên card tìm kiếm, phải cache được ở CDN |
| Ảnh hồ sơ (gallery) | `photos/` | Công khai | Nằm trên trang SEO, phải cache được ở CDN |
| Chứng chỉ hành nghề | `certifications/` | **Riêng tư** | Là ảnh chụp giấy tờ tuỳ thân |
| Ảnh CCCD | `identity/` | **Riêng tư** | Định danh cấp quốc gia — rò rỉ là không thu hồi được |

Vì vậy **bucket để private**, ảnh công khai ra ngoài bằng một custom domain trỏ vào
bucket, còn hai prefix riêng tư chỉ mở được bằng URL ký hạn 15 phút do backend sinh cho
tài khoản ADMIN. Đặt cả bucket thành public sẽ khiến giấy tờ tải được bởi bất kỳ ai
đoán được key — và key nằm trong DTO của trang duyệt hồ sơ.

Không cấu hình gì thì app tự dùng đĩa local (`LocalObjectStorage`), nên dev và test
chạy được ngay mà không cần tài khoản Cloudflare.

---

## 1. Tạo bucket

1. Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**.
   Lần đầu vào R2 sẽ phải thêm thẻ thanh toán, kể cả khi dùng trong hạn mức miễn phí
   (10 GB lưu trữ, 1 triệu lượt ghi và 10 triệu lượt đọc mỗi tháng).
2. **Create bucket** → tên `massage-platform`.
3. **Location**: chọn `Asia-Pacific (APAC)` để gần người dùng Việt Nam nhất.
4. Giữ nguyên **Public access: disabled**. Đây là mặc định và là thứ ta cần.

## 2. Tạo API token

1. Trong R2 → **Manage API tokens** → **Create API token**.
2. Permissions: **Object Read & Write**.
3. **Specify bucket** → chọn đúng `massage-platform`. Đừng để "Apply to all buckets":
   một token rò rỉ khi đó mở được mọi bucket của tài khoản, kể cả bucket của dự án khác.
4. TTL: để trống (không hết hạn) hoặc đặt hạn rồi ghi lịch xoay vòng.
5. **Create**. Màn hình kế tiếp hiện **Access Key ID** và **Secret Access Key** —
   secret chỉ hiện đúng một lần, chép ngay.

Account ID lấy ở trang **R2 → Overview**, cột phải.

## 3. Nối custom domain cho ảnh công khai

Đây là bước quyết định ảnh có hiện được hay không.

1. Vào bucket → tab **Settings** → **Public access** → **Custom Domains** → **Connect Domain**.
2. Nhập một subdomain thuộc tên miền **đã nằm trong Cloudflare**, ví dụ
   `cdn.ten-mien-cua-ban.com`. Cloudflare tự thêm bản ghi DNS.
3. Chờ trạng thái chuyển sang **Active**.

> **Đừng dùng endpoint S3** (`https://<account-id>.r2.cloudflarestorage.com`) làm
> `R2_PUBLIC_BASE_URL`. Endpoint đó chỉ nhận request đã ký, nên mọi ảnh sẽ trả 401 mà
> **không có lỗi nào trong log** — triệu chứng duy nhất là ảnh không hiện.

Chưa có tên miền thì bật tạm **Public Development URL** (`https://pub-xxxx.r2.dev`) để
chạy thử. Không dùng nó ở production, vì hai lý do:

1. Cloudflare bóp băng thông và không cache tốt, mà ảnh hồ sơ nằm đúng trên đường đọc SEO.
2. **Quan trọng hơn: r2.dev không đặt WAF rule được.** Nó không thuộc zone nào của bạn,
   nên bước 4 bên dưới không áp dụng được — tức `certifications/` và `identity/` tải được
   công khai bởi bất kỳ ai có key. Đo được bằng `tools/verify-r2.sh`, và script sẽ báo đỏ
   đúng chỗ đó.

   Trong lúc còn dùng r2.dev, đừng tải lên chứng chỉ hay CCCD thật. Với dữ liệu thử thì không sao,
   vì key là GUID nên không đoán được — nhưng đó là "khó đoán", không phải "được bảo vệ".

Custom domain cũng làm cả bucket public ở mức đường dẫn, khác ở chỗ nó **chặn được**
bằng WAF — nên phải làm bước 4.

## 4. Chặn `certifications/` và `identity/` khỏi custom domain

Custom domain phục vụ **mọi** key trong bucket. Ảnh công khai thì đúng, nhưng giấy tờ
thì không được. Tạo một WAF rule chặn cả hai prefix riêng tư:

1. Cloudflare Dashboard → chọn tên miền → **Security** → **WAF** → **Custom rules** →
   **Create rule**.
2. Tên: `Chặn truy cập trực tiếp file giấy tờ`.
3. Expression (dùng **Edit expression** để dán):

   ```
   (http.host eq "cdn.ten-mien-cua-ban.com" and (
      starts_with(http.request.uri.path, "/certifications/") or
      starts_with(http.request.uri.path, "/identity/")
   ))
   ```

4. Action: **Block**.
5. **Deploy**.

**Mỗi prefix riêng tư mới phải được thêm vào đúng rule này.** Đây là chỗ hỏng im lặng:
thêm một loại giấy tờ mới mà quên sửa rule thì không có gì báo lỗi — file vẫn lưu đúng,
app vẫn chạy đúng, chỉ là ai có key đều tải được. `tools/verify-r2.sh` kiểm cả hai prefix
nên nó bắt được trường hợp này; thêm loại thứ ba thì thêm cả vào script.

URL ký mà backend sinh đi qua endpoint S3 chứ không qua custom domain, nên rule này
**không** ảnh hưởng tới đường admin xem giấy tờ. Kiểm lại sau khi deploy:

```bash
# Cả hai phải trả 403 (bị WAF chặn)
curl -I https://cdn.ten-mien-cua-ban.com/certifications/bat-ky.pdf
curl -I https://cdn.ten-mien-cua-ban.com/identity/bat-ky.jpg

# Phải trả 200 khi key có thật
curl -I https://cdn.ten-mien-cua-ban.com/avatars/2026/09/<guid>.png
```

## 5. Cấu hình ứng dụng

Copy `.env.example` thành `.env` ở gốc repo (file `.env` đã nằm trong `.gitignore`):

```bash
cp .env.example .env
```

Điền vào:

```ini
R2_ACCOUNT_ID=<Account ID ở bước 2>
R2_ACCESS_KEY_ID=<Access Key ID ở bước 2>
R2_SECRET_ACCESS_KEY=<Secret Access Key ở bước 2>
R2_BUCKET=massage-platform
R2_PUBLIC_BASE_URL=https://cdn.ten-mien-cua-ban.com
```

Rồi dựng lại — **web phải build lại**, không chỉ restart: `next/image` chặn mọi host
không nằm trong `remotePatterns`, và danh sách đó được chốt lúc build.

```bash
docker compose up -d --build api web
```

Ở production thì đặt bằng biến môi trường của nền tảng deploy, không phải file `.env`.
Tên biến cho API là dạng hai gạch dưới: `R2__AccountId`, `R2__AccessKeyId`,
`R2__SecretAccessKey`, `R2__Bucket`, `R2__PublicBaseUrl`; frontend cần
`NEXT_PUBLIC_MEDIA_BASE_URL` bằng đúng giá trị của `R2__PublicBaseUrl`.

## 6. Kiểm chứng

App **không** báo lỗi khi thiếu cấu hình — nó lặng lẽ dùng đĩa local, nên "chạy được"
không chứng minh gì cả. Chạy script kiểm chứng:

```bash
bash tools/verify-r2.sh
```

Nó upload thật một tấm ảnh, xem file rơi vào đâu, **và kiểm luôn WAF rule ở bước 4** —
chỗ dễ bỏ sót nhất, vì thiếu nó thì giấy tờ tuỳ thân tải được mà không cần đăng nhập.
Script tự dọn hồ sơ test khỏi DB, thoát khác 0 khi có mục không đạt.

Muốn kiểm tay thì đây là các bước nó làm:

```bash
# Đăng nhập dashboard KTV, vào Hồ sơ, tải lên một ảnh đại diện, rồi:
docker compose exec postgres psql -U massage -d massage_platform \
  -c "SELECT avatar_key FROM ktv_profiles WHERE avatar_key IS NOT NULL LIMIT 3;"
```

Key phải có dạng `avatars/2026/09/<guid>.png` ở **cả hai** chế độ — cột lưu key chứ
không lưu URL, nên nó không nói lên file nằm ở đâu. Chỗ phân biệt là HTML trả về:

```bash
curl -s http://localhost:3000/ktv/<slug>-<id> | grep -o 'https://cdn[^"]*'
```

Có URL `cdn.` nghĩa là R2 đang chạy; thấy `/uploads/` nghĩa là vẫn đang dùng đĩa local
— kiểm lại `R2_ACCOUNT_ID` và `R2_ACCESS_KEY_ID` có thật sự tới được container chưa
(`docker compose exec api env | grep R2__`).

Nếu app **không khởi động được** và log ghi `R2:PublicBaseUrl bắt buộc khi bật R2` thì
đó là cố ý: có credential mà thiếu origin công khai sẽ khiến mọi ảnh mang URL trỏ vào
endpoint S3 và không hiện, nên app từ chối chạy thay vì hỏng âm thầm.

## 7. Chuyển file đã có trên đĩa lên R2

Chỉ cần khi đã có dữ liệu thật trước lúc bật R2. Migration `KtvMediaR2` đã đổi
`certifications.file_url` từ URL thành key, nên chỉ còn việc chép file:

```bash
# Lấy file từ volume uploads ra máy local
docker compose cp api:/app/uploads ./uploads-backup

# Đẩy lên R2 bằng rclone (cấu hình remote kiểu s3, provider Cloudflare)
rclone copy ./uploads-backup/ r2:massage-platform/certifications/ \
  --include "*.pdf" --include "*.jpg" --include "*.png" --include "*.webp"
```

Key sau migration là `certifications/<tên-file>` (không có phân đoạn năm/tháng — file
cũ không còn biết tháng gốc), nên cấu trúc phẳng ở trên là đúng.

Kiểm lại bằng cách mở một chứng chỉ trong trang duyệt hồ sơ **trước khi** xoá volume.

## Chi phí

Hạn mức miễn phí: 10 GB lưu trữ, 1 triệu Class A (ghi) và 10 triệu Class B (đọc) mỗi
tháng. Ảnh 3 MB × 10 ảnh × 1.000 KTV ≈ 30 GB, tức khoảng 0,3 USD/tháng cho phần vượt.

Điểm mạnh thật sự của R2 ở đây là **egress miễn phí** — với sản phẩm sống bằng traffic
organic thì lượt tải ảnh là khoản tăng nhanh nhất, và đó chính là khoản S3 tính tiền
nặng nhất.
