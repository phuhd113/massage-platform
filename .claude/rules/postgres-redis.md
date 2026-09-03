# Kiến trúc — Postgres là source of truth, Redis là cache

Postgres + PostGIS giữ toàn bộ trạng thái. Redis (sẽ dùng từ Phase 3) chỉ là read-path cache cho
geo-search và bảng xếp hạng, cập nhật theo kiểu **write-through** — không có trạng thái nào chỉ
tồn tại trong Redis, và mọi thứ trong Redis phải tái tạo được từ Postgres.

Redis lock (khi tranh slot quảng cáo) chỉ là fast-path để phản hồi nhanh và giảm tải. **Trọng tài
cuối cùng luôn là UNIQUE constraint ở tầng DB**, vì lock có thể hết hạn giữa chừng khi transaction
chạy lâu hơn dự kiến.
