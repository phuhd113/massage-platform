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

## API endpoints (Phase 0)

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

Swagger UI có ở `/swagger` khi chạy môi trường Development.

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
