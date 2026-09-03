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

`maintenance` thoát với mã khác 0 khi phát hiện ví lệch sổ — coi mã thoát là cảnh báo,
đừng chỉ đọc log.

**Từ Phase 3, ba việc đó đã chạy tự động bằng Hangfire** (`hold:cleanup` mỗi 5 phút,
`promotion:expire-sweep` mỗi phút, `wallet:reconcile` 3 giờ sáng giờ Việt Nam) — không
cần cron ngoài nữa. Lệnh CLI vẫn giữ và vẫn gọi đúng cùng logic, để chạy tay khi cần chữa
sự cố lúc job tự động đang hỏng.

Job thứ tư, `analytics:partitions` (2 giờ sáng hằng ngày), tạo trước partition tháng của
`analytics_events` và bỏ partition quá 6 tháng. Nó **ném lỗi** khi `analytics_events_default`
có dữ liệu: hàng nằm ở đó chặn việc tạo partition cho chính tháng chúng thuộc về, nên phải
chuyển chúng về đúng tháng rồi mới tạo lại được.

Dashboard ở `/hangfire`. **Mặc định đóng** (401) trừ khi đăng nhập bằng tài khoản ADMIN
hoặc bật `Jobs:DashboardAnonymous` — nó kích chạy và xoá được job, kể cả job đối soát ví.
Cờ đó đang bật sẵn trong `appsettings.Development.json`; production để nguyên và xem qua
SSH tunnel.

Job `wallet:reconcile` **ném lỗi** khi phát hiện ví lệch, nên nó hiện đỏ trong dashboard
thay vì chỉ để lại một dòng log lúc 3 giờ sáng. Nó cũng không retry: lệch sổ không phải
lỗi tạm thời.

Lệnh CLI và môi trường `Testing` **không** khởi động Hangfire server — chạy `migrate` lúc
deploy không được vừa áp migration vừa lặng lẽ bắt đầu chạy job.

Frontend Next.js ở `apps/web` (chạy cùng `docker compose up -d`, cổng 3000) — lệnh build/lint và
cách kiểm chứng SSR nằm ở [apps/web/CLAUDE.md](apps/web/CLAUDE.md).

`GET /api/v1/health` trả về cả phiên bản PostGIS — dùng nó để xác nhận DB thật sự sẵn sàng,
không chỉ là kết nối được.
