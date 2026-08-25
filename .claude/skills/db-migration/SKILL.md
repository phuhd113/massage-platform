---
name: db-migration
description: Viết và rà soát migration PostgreSQL cho nền tảng massage marketplace theo đúng convention của dự án — PostGIS geography cho toạ độ, index GiST cho geo-search, UUID PK, timestamptz, UNIQUE constraint bảo vệ idempotency và slot allocation, partition theo tháng cho analytics. Dùng skill này bất cứ khi nào người dùng nhắc tới migration, thêm/sửa bảng, thêm cột, đổi schema, thêm index, "tạo bảng X", hay khi bạn sắp tạo entity/model mới cần persist xuống DB.
---

# Migration PostgreSQL (EF Core 8 + Npgsql)

## Quy trình: scaffold bằng EF, viết thân bằng raw SQL

```bash
cd src/Massage.Api
dotnet ef migrations add <TênMigration> --output-dir Data/Migrations
```

Sau đó **thay toàn bộ thân `Up`/`Down` bằng `migrationBuilder.Sql(...)`**, không giữ fluent API (`CreateTable`, `AddColumn`...).

Lý do: EF không mô hình hoá được CHECK constraint, index GiST cho `geography`, partial index, hay partition — mà đây đều là thứ bảo vệ tính đúng đắn dữ liệu, không phải chi tiết tối ưu bỏ được. Viết fluent API rồi bổ sung `.Sql()` cho phần thiếu sẽ tạo ra migration nửa nạc nửa mỡ, khó đọc và khó rollback đúng.

Vẫn **phải scaffold qua `dotnet ef`** (thay vì tự tạo file) để EF sinh đúng `AppDbContextModelSnapshot`. Snapshot lệch với model sẽ khiến lần `migrations add` sau sinh ra diff rác.

Sau khi sửa thân migration, kiểm chứng ngay:

```bash
dotnet ef database update      # up
dotnet ef database update 0    # down
dotnet ef database update      # up lại
```

CI chạy đúng ba bước này — `Down()` viết cho có sẽ bị bắt ở đó.

## Convention bắt buộc của dự án

| Hạng mục | Quy ước | Lý do |
|---|---|---|
| Khoá chính | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Tránh lộ số lượng listing/giao dịch qua ID tuần tự; dễ merge dữ liệu đa nguồn |
| Thời gian | `TIMESTAMPTZ` (không bao giờ `TIMESTAMP` trần) | Gói "giờ vàng" và lịch hết hạn campaign phụ thuộc múi giờ; `TIMESTAMP` không có tz sẽ sai khi deploy đa vùng |
| Toạ độ | `GEOGRAPHY(POINT, 4326)` | Tính khoảng cách theo mét trên mặt cầu, không phải độ phẳng — `GEOMETRY` sẽ cho bán kính sai |
| Tiền | `NUMERIC(14,0)` (VND, không thập phân) | Không dùng `FLOAT`/`REAL` cho tiền, sai số làm lệch đối soát ví |
| Enum | `VARCHAR + CHECK constraint` | Postgres native ENUM rất khó thêm/bớt giá trị về sau |

## Index bắt buộc

```sql
-- Mọi cột geography phục vụ tìm kiếm bán kính
CREATE INDEX idx_<table>_<col> ON <table> USING GIST (<geography_col>);

-- Truy vấn campaign đang chạy theo khu vực (hot path của search)
CREATE INDEX idx_campaign_active_window ON ad_campaigns (area_id, status, end_at);
```

Thiếu index GiST trên cột geography là lỗi âm thầm nguy hiểm nhất: query vẫn chạy đúng, chỉ chậm dần theo số lượng KTV cho tới khi API search timeout ở production.

## Constraint bảo vệ tính toàn vẹn tiền bạc

Hai ràng buộc này là **trọng tài cuối cùng** chống race condition ở cấp DB — không được nới lỏng vì lý do "code đã lock rồi":

```sql
-- Chặn webhook nạp tiền xử lý trùng
ALTER TABLE wallet_transactions ADD CONSTRAINT uq_wallet_txn_idem UNIQUE (idempotency_key);

-- Chặn 2 KTV cùng chiếm 1 slot VIP trong cùng khung giờ
ALTER TABLE slot_allocations ADD CONSTRAINT uq_slot
  UNIQUE (area_id, package_type, window_start, slot_index);

-- Số dư không bao giờ âm
ALTER TABLE wallets ADD CONSTRAINT chk_balance_non_negative CHECK (balance >= 0);
```

Redis lock chỉ là fast-path để phản hồi nhanh và giảm tải; nó **có thể** thất bại (lock hết hạn, network partition, Redis restart). Constraint DB thì không.

## Bảng analytics — partition theo tháng

`analytics_events` là write-heavy và chỉ có giá trị trong thời gian ngắn. Partition theo `RANGE (created_at)` để xoá/archive dữ liệu cũ bằng `DROP PARTITION` (tức thời) thay vì `DELETE` hàng triệu dòng (khoá bảng, phình WAL):

```sql
CREATE TABLE analytics_events_2026_09 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
```

Nhớ tạo partition cho tháng tới **trước khi** tháng đó đến — nên có job tự động; nếu thiếu partition, mọi INSERT sẽ lỗi.

## Backward compatibility — quy tắc deploy an toàn

Migration chạy trước khi code mới lên hoàn toàn, và có thể phải rollback khi code cũ vẫn đang chạy. Vì vậy:

- **Không `DROP COLUMN` trực tiếp.** Làm 2 pha: (1) ngừng ghi/đọc cột trong code, deploy, quan sát; (2) migration sau mới xoá cột.
- **Không đổi tên cột.** Thêm cột mới → backfill → chuyển code → xoá cột cũ ở lần deploy sau.
- **Cột `NOT NULL` mới phải có `DEFAULT`** hoặc backfill trước rồi mới thêm ràng buộc, nếu không migration sẽ fail trên bảng có dữ liệu.
- **Index trên bảng lớn dùng `CREATE INDEX CONCURRENTLY`** để không khoá ghi. Lưu ý: EF bọc mỗi migration trong một transaction, mà `CONCURRENTLY` không chạy được trong transaction — phải tách thành migration riêng và gọi `migrationBuilder.Sql(sql, suppressTransaction: true)`.
- **Mọi migration phải có `Down()` thực sự chạy được**, không để trống hay `throw new NotImplementedException()`.
- **Không drop extension trong `Down()`** (`postgis`, `pgcrypto`) — chúng có thể đang được schema khác trong cùng database dùng.

## Đồng bộ với `AppDbContext`

Migration là nguồn sự thật của schema; `OnModelCreating` phải khớp với nó nhưng **không tự sinh ra nó**. Khi thêm cột bằng raw SQL, nhớ cập nhật cấu hình entity tương ứng:

- Tên cột snake_case qua `.HasColumnName("...")` — EF mặc định dùng tên property PascalCase, sẽ không khớp.
- Cột geography: `.HasColumnType("geography (Point, 4326)")`.
- Cột tiền: `.HasPrecision(14, 0)` để EF không tự suy ra kiểu sai.

Lệch giữa hai nơi này không làm build đỏ — nó nổ lúc chạy query đầu tiên chạm cột đó.

## Checklist trước khi merge migration

- [ ] Đã scaffold qua `dotnet ef migrations add` (snapshot đúng), thân viết bằng `migrationBuilder.Sql`
- [ ] Có `Up()` và `Down()`, đã test up → down → up trên DB local
- [ ] Cột geography có index GiST đi kèm
- [ ] Cột tiền dùng `NUMERIC`, không phải float
- [ ] Cột thời gian là `timestamptz` (property C# dùng `DateTimeOffset`, không phải `DateTime`)
- [ ] Cấu hình entity trong `AppDbContext` đã khớp: `HasColumnName`, kiểu geography, precision cột tiền
- [ ] Không có `DROP COLUMN` / `RENAME COLUMN` trực tiếp trong cùng một lần deploy với code
- [ ] Nếu chạm bảng `wallets` / `wallet_transactions` / `slot_allocations` → chạy thêm checklist skill `wallet-tx-review`
- [ ] Đã cân nhắc migration này ảnh hưởng gì tới query hot path của search (skill `ranking-algo-change`)
