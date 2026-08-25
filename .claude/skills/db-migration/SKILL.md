---
name: db-migration
description: Viết và rà soát migration PostgreSQL cho nền tảng massage marketplace theo đúng convention của dự án — PostGIS geography cho toạ độ, index GiST cho geo-search, UUID PK, timestamptz, UNIQUE constraint bảo vệ idempotency và slot allocation, partition theo tháng cho analytics. Dùng skill này bất cứ khi nào người dùng nhắc tới migration, thêm/sửa bảng, thêm cột, đổi schema, thêm index, "tạo bảng X", hay khi bạn sắp tạo entity/model mới cần persist xuống DB.
---

# Migration PostgreSQL

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
- **Index trên bảng lớn dùng `CREATE INDEX CONCURRENTLY`** để không khoá ghi (lưu ý: không chạy được bên trong transaction, nên tách thành migration riêng).
- **Mọi migration phải có hàm `down()` thực sự chạy được**, không để trống hay `throw new Error('not implemented')`.

## Checklist trước khi merge migration

- [ ] Có `up()` và `down()`, đã test chạy cả hai chiều trên DB local
- [ ] Cột geography có index GiST đi kèm
- [ ] Cột tiền dùng `NUMERIC`, không phải float
- [ ] Cột thời gian là `timestamptz`
- [ ] Không có `DROP COLUMN` / `RENAME COLUMN` trực tiếp trong cùng một lần deploy với code
- [ ] Nếu chạm bảng `wallets` / `wallet_transactions` / `slot_allocations` → chạy thêm checklist skill `wallet-tx-review`
- [ ] Đã cân nhắc migration này ảnh hưởng gì tới query hot path của search (skill `ranking-algo-change`)
