# Massage Platform — Nền tảng kết nối massage trị liệu tại nhà

Two-sided marketplace theo mô hình Listing & Bidding: KTV tạo hồ sơ, khách tìm theo khu vực,
KTV trả phí để đẩy tin lên top.

Kiến trúc chi tiết: xem [bản blueprint](https://claude.ai/code/artifact/a6b39c02-9ed5-4b79-abb1-d7bf68c0c6c0).

## Trạng thái: Phase 0 — Foundation

| Hạng mục | Trạng thái |
|---|---|
| Repo, CI, lint, test | Xong |
| Docker (Postgres+PostGIS, Redis) | Xong |
| Schema nền + migration | Xong |
| Auth qua OTP điện thoại (stub) + JWT | Xong |
| Hồ sơ KTV + upload chứng chỉ | Xong |
| Admin duyệt hồ sơ / chứng chỉ | Xong |
| Geo-search, ví, quảng cáo | Phase 1–3 |

## Chạy local

```bash
docker compose up -d
```

```bash
cd apps/api && npm install && cp .env.example .env
```

```bash
cd apps/api && npm run migration:run && npm run seed:areas
```

```bash
cd apps/api && npm run start:dev
```

API chạy tại `http://localhost:3000/api/v1`. Kiểm tra: `GET /api/v1/health`.

## API Phase 0

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/auth/otp/request` | công khai | Gửi OTP (chế độ stub trả mã trong response) |
| POST | `/auth/otp/verify` | công khai | Đổi OTP lấy JWT, tạo tài khoản nếu chưa có |
| GET | `/auth/me` | đã đăng nhập | Thông tin tài khoản hiện tại |
| POST | `/ktv/profile` | KTV | Tạo hồ sơ KTV |
| GET | `/ktv/profile/me` | KTV | Xem hồ sơ của mình |
| PATCH | `/ktv/profile` | KTV | Sửa hồ sơ (chuyển lại trạng thái chờ duyệt) |
| POST | `/ktv/certifications` | KTV | Upload chứng chỉ (multipart, trường `file`) |
| GET | `/ktv/:id` | công khai | Xem hồ sơ KTV |
| GET | `/admin/ktv` | ADMIN | Danh sách hồ sơ theo trạng thái |
| PATCH | `/admin/ktv/:id/verify` | ADMIN | Duyệt / từ chối hồ sơ |
| PATCH | `/admin/certifications/:id/verify` | ADMIN | Duyệt / từ chối chứng chỉ |

## Lưu ý vận hành Phase 0

- **OTP đang ở chế độ stub**: mã được ghi log và trả trong response. Trước khi lên production phải
  đặt `OTP_STUB_ENABLED=false` và cắm adapter SMS thật — hiện tại code sẽ ném lỗi rõ ràng thay vì
  âm thầm không gửi gì.
- **Tài khoản ADMIN đầu tiên** phải tạo thủ công: đăng nhập bằng OTP như user thường rồi
  `UPDATE users SET role='ADMIN' WHERE phone='...'`. Không mở endpoint tự phong quyền admin.
- **File chứng chỉ lưu trên đĩa local** (`apps/api/uploads/`). Chuyển sang S3/R2 ở Phase 1 —
  chỉ cần đổi `storage` trong `upload.config.ts`.

## Quy ước phát triển

Repo có sẵn 5 skill trong `.claude/skills/` mã hoá các quy ước bắt buộc — Claude Code sẽ tự áp dụng
khi làm việc đúng ngữ cảnh:

- `new-feature-module` — scaffold module mới
- `db-migration` — convention migration
- `wallet-tx-review` — checklist cho code chạm ví/slot quảng cáo
- `seo-page-check` — audit SEO trang public
- `ranking-algo-change` — guardrail sửa thuật toán xếp hạng
