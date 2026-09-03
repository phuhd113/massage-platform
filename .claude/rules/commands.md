# Commands

```bash
dotnet test Massage.sln               # toàn bộ test (CẦN Postgres đang chạy — xem bên dưới)
dotnet test --filter "DisplayName~hết_hạn"             # một test theo tên tiếng Việt
dotnet format Massage.sln             # CI kiểm tra bằng --verify-no-changes, chạy trước khi commit
```

Hạ tầng và dữ liệu:

```bash
docker compose up -d                              # Postgres 16 + PostGIS 3.4, Redis 7, API
docker compose exec api dotnet Massage.Api.dll migrate      # áp migration
docker compose exec api dotnet Massage.Api.dll seed-areas   # seed quận/huyện (idempotent)
docker compose exec api dotnet Massage.Api.dll seed-services # seed danh mục dịch vụ (idempotent)
docker compose exec api dotnet Massage.Api.dll seed-packages # seed catalog gói đẩy tin (idempotent)
docker compose exec api dotnet Massage.Api.dll maintenance   # nhả hold quá hạn, đóng campaign hết hạn, đối soát ví
```

`maintenance` thoát với mã khác 0 khi phát hiện ví lệch sổ — chạy nó theo cron và
coi mã thoát là cảnh báo, đừng chỉ đọc log.

Frontend Next.js ở `apps/web` (chạy cùng `docker compose up -d`, cổng 3000) — lệnh build/lint và
cách kiểm chứng SSR nằm ở [apps/web/CLAUDE.md](apps/web/CLAUDE.md).

`GET /api/v1/health` trả về cả phiên bản PostGIS — dùng nó để xác nhận DB thật sự sẵn sàng,
không chỉ là kết nối được.
