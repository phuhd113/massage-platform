# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All backend commands run from `apps/api/`.

```bash
npm run start:dev          # API với watch mode, http://localhost:3000/api/v1
npm test                   # toàn bộ unit test
npm test -- otp.service    # chạy một file test (khớp theo tên)
npm test -- -t "mã hết hạn"  # chạy một test case theo tên
npm run lint               # eslint (CI fail nếu có lỗi)
npx tsc --noEmit           # type-check không build
npm run build              # nest build
```

Hạ tầng và dữ liệu (từ thư mục gốc / `apps/api`):

```bash
docker compose up -d       # Postgres 16 + PostGIS 3.4, Redis 7 (chạy từ thư mục gốc)
npm run migration:run      # áp migration
npm run migration:revert   # rollback migration gần nhất
npm run seed:areas         # seed quận/huyện HCM + Hà Nội (idempotent, chạy lại được)
```

`GET /api/v1/health` trả về cả phiên bản PostGIS — dùng nó để xác nhận DB thật sự sẵn sàng,
không chỉ là kết nối được.

## Bối cảnh nghiệp vụ

Two-sided marketplace kết nối khách với kỹ thuật viên (KTV) massage trị liệu tại nhà, theo mô hình
Listing & Bidding: KTV tạo hồ sơ miễn phí, khách tìm theo vị trí GPS, **doanh thu đến từ việc KTV
trả phí đẩy tin lên top** (ghim VIP theo khu vực, boost theo khung giờ vàng, huy hiệu nổi bật).

Hai hệ quả chi phối gần như mọi quyết định kỹ thuật:

1. **Thứ hạng tìm kiếm chính là sản phẩm đang được bán.** Sửa công thức xếp hạng là sửa vào thứ
   khách hàng đã trả tiền để mua, không phải chỉ là tinh chỉnh UX.
2. **SEO là kênh acquisition chính.** Người tìm "massage tại nhà Quận 7" là khách có ý định mua
   ngay và CPC quảng cáo nhóm từ khoá này rất đắt. Mọi trang public phải SSR/ISR.

## Kiến trúc

### Modular Monolith + Vertical Slice, KHÔNG đồng nhất mức abstraction

Đây là quyết định kiến trúc quan trọng nhất và dễ bị làm sai nhất. Mỗi module nằm trong
`src/modules/<tên>/` và tự chứa, nhưng **mức abstraction khác nhau tuỳ mức rủi ro**:

| Loại | Ví dụ | Kiến trúc |
|---|---|---|
| Chạm tiền / cấp phát slot | Wallet, Promotion, Campaign, SlotAllocation | Hexagonal — `domain/` (không import framework), `application/use-cases/`, `infrastructure/`, `presentation/` |
| Còn lại | auth, ktv-profile, admin, listing, review | Phẳng — controller / service / repository |

Lý do: module CRUD có logic mỏng, bọc thêm ba lớp chỉ tạo ma sát. Module tiền bạc thì ngược lại —
cần test được 100% business rule mà không đụng DB, vì một lỗi im lặng ở đó thành mất tiền thật
hoặc bán trùng slot, và cả hai đều không tự phục hồi.

Khi lưỡng lự, hỏi: *module này có tự ghi/trừ số dư hoặc tự cấp phát slot không?* Có → Hexagonal.

### Postgres là source of truth, Redis là cache

Postgres + PostGIS giữ toàn bộ trạng thái. Redis (sẽ dùng từ Phase 3) chỉ là read-path cache cho
geo-search và bảng xếp hạng, cập nhật theo kiểu **write-through** — không có trạng thái nào chỉ
tồn tại trong Redis, và mọi thứ trong Redis phải tái tạo được từ Postgres.

Redis lock (khi tranh slot quảng cáo) chỉ là fast-path để phản hồi nhanh và giảm tải. **Trọng tài
cuối cùng luôn là UNIQUE constraint ở tầng DB**, vì lock có thể hết hạn giữa chừng khi transaction
chạy lâu hơn dự kiến.

### Schema chỉ đổi qua migration

`synchronize: false` là cố ý — TypeORM synchronize sẽ âm thầm drop cột khi entity đổi. Mọi thay đổi
schema đi qua raw SQL migration trong `src/database/migrations/`, và `down()` phải thật sự chạy
được (CI chạy up → down → up để kiểm chứng).

Quy ước cột: UUID PK (`gen_random_uuid()`), `TIMESTAMPTZ` cho mọi mốc thời gian, `GEOGRAPHY(POINT,
4326)` + index GiST cho toạ độ, `NUMERIC` cho tiền (không bao giờ float), enum bằng
`VARCHAR + CHECK` thay vì Postgres ENUM.

### Công thức xếp hạng (Phase 2+)

```
FinalScore = BoostPoints (rời rạc theo hạng gói)  +  BaseScore (liên tục, 0–100)
```

Hai phần **cố ý tách biệt**: khoảng cách giữa các mức BoostPoints (VIP +500, Instant +300, Badge
+50) luôn lớn hơn dải BaseScore tối đa, nên KTV trả phí luôn thắng hạng — đó là cam kết thương mại.
BaseScore (rating 0.40 + khoảng cách 0.35 + tỉ lệ phản hồi 0.15 + độ mới 0.10) chỉ quyết định thứ
tự *bên trong* cùng một hạng. Đừng làm mờ ranh giới giữa hai thành phần này.

## Skills bắt buộc tham khảo

`.claude/skills/` chứa 5 skill mã hoá quy ước của dự án. Chúng liên kết chéo nhau (ví dụ scaffold
một module chạm tiền sẽ kéo theo checklist ví). Đọc skill tương ứng **trước** khi làm, đừng suy đoán:

| Skill | Khi nào |
|---|---|
| `new-feature-module` | Tạo module/feature backend mới |
| `db-migration` | Thêm/sửa bảng, cột, index |
| `wallet-tx-review` | **Bất kỳ** thay đổi nào chạm ví, campaign, slot, webhook thanh toán |
| `seo-page-check` | Tạo/sửa trang public trên frontend |
| `ranking-algo-change` | Sửa công thức xếp hạng hoặc luồng cache Redis |

Nếu kiến trúc thay đổi lớn, cập nhật lại nội dung skill cho khớp — skill lỗi thời nguy hiểm hơn
không có skill.

## Trạng thái dự án

Đang ở **Phase 0 (Foundation)** — đã có: repo/CI, Docker, schema nền, auth OTP + JWT, hồ sơ KTV +
upload chứng chỉ, admin duyệt hồ sơ. Frontend Next.js chưa tồn tại.

Roadmap: Phase 1 geo-search + trang public SSR → Phase 2 ví & gói quảng cáo → Phase 3 Redis
ranking + Instant Boost + BullMQ → Phase 4 hardening. Kiến trúc chi tiết ở
[blueprint](https://claude.ai/code/artifact/a6b39c02-9ed5-4b79-abb1-d7bf68c0c6c0).

Lưu ý vận hành hiện tại:

- **OTP đang ở chế độ stub** (`OTP_STUB_ENABLED=true`): mã trả thẳng trong response và ghi log.
  Khi tắt stub, code ném lỗi rõ ràng thay vì âm thầm không gửi gì — đó là chỗ cắm adapter SMS thật.
- **Tài khoản ADMIN đầu tiên tạo thủ công** bằng SQL (`UPDATE users SET role='ADMIN' ...`). Không
  mở endpoint tự phong quyền admin.
- **File chứng chỉ lưu trên đĩa local** (`apps/api/uploads/`). Chuyển sang S3/R2 bằng cách đổi
  `storage` trong `upload.config.ts`, phần còn lại của luồng upload không phụ thuộc nơi file nằm.
