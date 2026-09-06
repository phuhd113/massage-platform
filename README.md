# Massage Platform

Two-sided marketplace kết nối khách với kỹ thuật viên (KTV) massage trị liệu tại nhà, theo mô hình
Listing & Bidding. Doanh thu đến từ việc KTV trả phí đẩy tin lên top kết quả tìm kiếm.

Kiến trúc chi tiết: [blueprint](https://claude.ai/code/artifact/a6b39c02-9ed5-4b79-abb1-d7bf68c0c6c0).

## Yêu cầu

- .NET 8 SDK
- Docker Desktop (Postgres + PostGIS, Redis)

## Chạy dự án

```bash
docker compose up -d                  # Postgres 16 + PostGIS 3.4, Redis 7, API
curl http://localhost:5080/api/v1/health
```

Lần đầu chạy cần áp migration và seed danh mục khu vực:

```bash
docker compose exec api dotnet Massage.Api.dll migrate
docker compose exec api dotnet Massage.Api.dll seed-areas
```

### Chạy API ngoài Docker

```bash
docker compose up -d postgres redis   # chỉ hạ tầng
cd src/Massage.Api
dotnet run                            # http://localhost:5277/api/v1
```

> **Lưu ý trên máy bật Smart App Control**: Windows sẽ chặn binary .NET build tại chỗ với lỗi
> `An Application Control policy has blocked this file`. Khi đó dùng đường Docker ở trên.
> Tắt Smart App Control là thao tác **không thể hoàn tác** (muốn bật lại phải cài lại Windows),
> nên hãy cân nhắc kỹ trước khi chọn cách đó.

## Lệnh thường dùng

```bash
dotnet build Massage.sln              # build
dotnet test Massage.sln               # toàn bộ test (cần Postgres đang chạy)
dotnet test --filter "FullyQualifiedName~OtpService"   # một nhóm test
dotnet test --filter "DisplayName~hết_hạn"             # một test theo tên
dotnet format Massage.sln             # format code (CI kiểm tra bằng --verify-no-changes)
```

Migration (từ `src/Massage.Api`):

```bash
dotnet ef migrations add <Tên>        # tạo migration mới
dotnet ef database update             # áp migration
dotnet ef database update 0           # rollback toàn bộ
```

Nếu Smart App Control chặn, chạy các lệnh trên trong container:

```bash
docker run --rm --network massage-platform_default \
  -v "$(pwd):/src" -w /src \
  -e TEST_DB_CONNECTION="Host=postgres;Port=5432;Database=postgres;Username=massage;Password=massage_dev_pw" \
  mcr.microsoft.com/dotnet/sdk:8.0 dotnet test Massage.sln
```

## API endpoints

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/health` | công khai | Trạng thái API + phiên bản PostGIS |
| POST | `/api/v1/auth/otp/request` | công khai | Gửi mã OTP |
| POST | `/api/v1/auth/otp/verify` | công khai | Đổi OTP lấy JWT |
| GET | `/api/v1/auth/me` | đã đăng nhập | Thông tin tài khoản |
| POST | `/api/v1/ktv/profile` | KTV | Tạo hồ sơ |
| GET | `/api/v1/ktv/profile/me` | KTV | Xem hồ sơ của mình |
| PATCH | `/api/v1/ktv/profile` | KTV | Sửa hồ sơ |
| POST | `/api/v1/ktv/certifications` | KTV | Upload chứng chỉ |
| GET | `/api/v1/ktv/{id}` | công khai | Hồ sơ công khai |
| GET | `/api/v1/admin/ktv` | ADMIN | Danh sách hồ sơ theo trạng thái |
| PATCH | `/api/v1/admin/ktv/{id}/verify` | ADMIN | Duyệt / từ chối hồ sơ |
| PATCH | `/api/v1/admin/certifications/{id}/verify` | ADMIN | Duyệt / từ chối chứng chỉ |
| PATCH | `/api/v1/admin/reviews/{id}/moderate` | ADMIN | Gỡ / khôi phục đánh giá |

### Phase 1 — tìm kiếm, dịch vụ, lead, đánh giá

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/search` | công khai | Tìm KTV theo `lat`/`lon`+`radiusKm`, hoặc theo `areaSlug` |
| GET | `/api/v1/areas` | công khai | Cây tỉnh/quận kèm số KTV đã duyệt |
| GET | `/api/v1/areas/{tinh}` · `/{tinh}/{quan}` | công khai | Khu vực + quận lân cận + cờ `indexable` |
| GET | `/api/v1/services` · `/services/{slug}` | công khai | Danh mục dịch vụ |
| GET | `/api/v1/ktv/by-slug/{slug}` | công khai | Hồ sơ công khai theo slug |
| GET/PUT | `/api/v1/ktv/profile/services` | KTV | Bảng giá dịch vụ của mình |
| POST | `/api/v1/leads` | công khai | Ghi nhận lượt liên hệ, **trả về số điện thoại KTV** |
| GET/POST | `/api/v1/ktv/{id}/reviews` | công khai / đã đăng nhập | Đánh giá |
| GET | `/api/v1/public/sitemap` | công khai | URL được phép index, cho `sitemap.xml` |


### Phase 2 — ví và gói đẩy tin

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/wallet/balance` | KTV | Số dư, phần đang giữ, phần khả dụng |
| GET | `/api/v1/wallet/transactions` | KTV | Sổ giao dịch, mỗi dòng có `balanceAfter` |
| POST | `/api/v1/wallet/topup` | KTV | Mở phiên nạp tiền, trả URL cổng thanh toán |
| GET/POST | `/api/v1/wallet/topup/callback` | công khai | IPN của cổng — verify chữ ký, idempotent |
| GET | `/api/v1/promotions/packages` | công khai | Catalog gói (`?areaId=` để xem slot còn trống) |
| POST | `/api/v1/campaigns` | KTV | Mua gói. **Bắt buộc header `Idempotency-Key`** |
| DELETE | `/api/v1/campaigns/{id}` | KTV | Huỷ, hoàn tiền theo ngày trọn vẹn còn lại |
| GET | `/api/v1/ktv/campaigns` | KTV | Campaign của mình |
| GET | `/api/v1/admin/revenue` | ADMIN | Doanh thu ròng theo khu vực và loại gói |

Cấu hình cổng thanh toán qua biến môi trường, **không commit vào repo**:

```bash
VnPay__TmnCode=...      # mã website do VNPay cấp
VnPay__HashSecret=...   # bí mật ký HMAC-SHA512
```

Thiếu hai giá trị này thì app vẫn chạy bình thường và chỉ báo lỗi rõ ràng khi có người bấm nạp tiền.

## Frontend (apps/web)

Next.js 14 App Router, chạy ở <http://localhost:3000>. Mọi trang public render ở server (SSR/ISR).

| Route | Render | Ghi chú |
|---|---|---|
| `/` | theo request, data cache 300s | `WebSite` + `Organization` |
| `/massage-tan-noi/{tinh}` | ISR 300s | Danh sách quận theo số KTV |
| `/massage-tan-noi/{tinh}/{quan}` | ISR 300s | `noindex, follow` khi dưới 3 KTV; `ItemList` + `BreadcrumbList` |
| `/ktv/{slug}-{id}` | ISR 600s | `ProfessionalService` + `AggregateRating` (chỉ khi có đánh giá thật) |
| `/dich-vu/{slug}` | ISR 300s | Trang trung chuyển dịch vụ ↔ khu vực |
| `/tim-kiem` | SSR | `noindex, follow`; canonical về URL gốc |
| `/sitemap.xml`, `/robots.txt` | động | Chỉ chứa URL backend cho phép index |

Số điện thoại KTV không nằm trong HTML — nút liên hệ gọi `POST /leads` rồi mới nhận số.

### Dashboard KTV

| Route | Ghi chú |
|---|---|
| `/dang-nhap` | Đăng nhập bằng OTP; `noindex, nofollow` |
| `/dashboard` | Tổng quan: trạng thái hồ sơ, số dư, chiến dịch đang chạy |
| `/dashboard/ho-so` | Hồ sơ, vị trí, khu vực phục vụ, chứng chỉ, bảng giá |
| `/dashboard/vi` | Số dư, sổ giao dịch, nạp tiền |
| `/dashboard/goi` | Catalog gói kèm số chỗ còn trống theo khu vực |
| `/dashboard/chien-dich` | Danh sách chiến dịch, huỷ và hoàn tiền |
| `/nap-tien/ket-qua` | Trang cổng thanh toán trả về — chỉ hiển thị, không cộng tiền |

JWT nằm trong **cookie httpOnly**, không phải `localStorage`: đây là khu vực chạm tiền, và một lỗ
XSS ở bất kỳ đâu trong site cũng đọc được `localStorage`. Hệ quả là mọi lời gọi API có xác thực đi
qua server — server component đọc cookie trực tiếp, còn thao tác từ client đi qua route handler
`/api/proxy/*`. Token không bao giờ xuất hiện trong HTML gửi về trình duyệt.

## Swagger UI

Chạy ở môi trường Development, mở <http://localhost:5080> (truy cập `/` sẽ tự chuyển sang
`/swagger`). Đặc tả OpenAPI thô: <http://localhost:5080/swagger/v1/swagger.json>.

Để thử các endpoint có biểu tượng ổ khoá:

1. `POST /api/v1/auth/otp/request` → chép `debugCode` trong response (OTP đang stub nên mã trả
   thẳng về, không cần SMS).
2. `POST /api/v1/auth/otp/verify` với mã đó → chép `accessToken`.
3. Bấm nút **Authorize** ở góc trên phải, dán token (không cần gõ chữ `Bearer`), bấm Authorize.

Token được lưu lại qua các lần reload trang, nên không phải xin OTP lại mỗi lần F5. Với endpoint
`/api/v1/admin/*`, tài khoản phải có role `ADMIN` — xem phần Lưu ý vận hành bên dưới.

## Lưu ý vận hành

- **OTP đang ở chế độ stub** (`Otp:StubEnabled=true`): mã trả thẳng trong response và ghi log.
  Tắt stub mà chưa cắm SMS thì code báo lỗi rõ ràng thay vì âm thầm không gửi gì.
- **Tài khoản ADMIN đầu tiên tạo thủ công** — không có endpoint tự phong quyền:

  ```bash
  docker compose exec postgres psql -U massage -d massage_platform \
    -c "UPDATE users SET role='ADMIN' WHERE phone='0987654321'"
  ```

  Sau đó đăng nhập lại để lấy JWT mới mang role ADMIN.
- **`Jwt:Secret` phải đặt qua biến môi trường ở production** (tối thiểu 32 ký tự). App từ chối
  khởi động nếu thiếu.
- **File chứng chỉ lưu trên đĩa local**. Chuyển sang S3/R2 bằng cách sửa `CertificationUpload`.

## Cấu trúc

```
src/Massage.Api/
├── Common/           # cross-cutting: options, exception handler, route prefix
├── Data/             # DbContext, migrations, seeder
└── Modules/          # vertical slice theo nghiệp vụ
    ├── Auth/
    ├── KtvProfiles/
    ├── Admin/
    └── Health/
tests/Massage.Api.Tests/
```
