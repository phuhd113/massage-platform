# Lộ trình Phase 1 → 4

Chi tiết phần việc còn lại của nền tảng: module backend, migration, endpoint, frontend Next.js, test bắt
buộc và tiêu chí hoàn thành cho từng phase.

Bản này chi tiết hoá mục 5 của [blueprint kiến trúc][blueprint] — blueprint vẫn là nguồn chuẩn cho ERD,
sơ đồ luồng và quyết định stack. Bản web dễ đọc: [artifact lộ trình][roadmap-artifact].

Ước lượng thời gian tính cho 1–2 dev full-time.

| Phase | Nội dung | Thời lượng |
|---|---|---|
| 0 | Foundation | **xong** |
| 1 | MVP Core Marketplace | **xong** |
| 2 | Ví & gói đẩy tin | **xong** |
| 3 | Realtime & quy mô | 3–4 tuần |
| 4 | Hardening trước khi mở rộng | 3–4 tuần |

## Điểm xuất phát — những gì đã có

Backend .NET 8 với bốn module phẳng: `Auth` (OTP + JWT), `KtvProfiles` (hồ sơ + upload chứng chỉ),
`Admin` (duyệt hồ sơ/chứng chỉ), `Health`. Sáu bảng trong schema: `users`, `otp_codes`, `ktv_profiles`,
`certifications`, `coverage_areas`, `administrative_areas` — đã có index GiST trên
`ktv_profiles.base_point`. CI, Docker Compose, `PostgresFixture` chạy migration thật.

**Chưa có**: toàn bộ frontend, mọi thứ liên quan tới tìm kiếm, tiền, xếp hạng, Redis (container đã dựng
nhưng chưa một dòng code nào dùng), background worker.

---

## Phase 1 — MVP Core Marketplace ✅ đã xong

**Mục tiêu**: khách tìm được KTV theo GPS và bấm gọi được. Kết thúc phase này sản phẩm đã có giá trị sử
dụng thật, và Google bắt đầu index — đó là lý do SEO kỹ thuật nằm ở đây chứ không phải Phase 4.

### 1.1 Module backend mới

| Module | Kiến trúc | Nội dung |
|---|---|---|
| `Search` | phẳng | Query PostGIS trực tiếp (`ST_DWithin` trên `geography`), tính BaseScore ngay trong SQL, phân trang keyset. Chỉ đọc, không chạm tiền. |
| `Services` | phẳng | Danh mục dịch vụ (bấm huyệt, massage Thái, trị liệu cổ vai gáy…) + bảng nối giá theo KTV. Seed bằng CLI giống `seed-areas`. |
| `Reviews` | phẳng | Khách chấm 1–5 sao kèm nhận xét, có trạng thái kiểm duyệt, cập nhật lại `rating_avg`/`rating_count`. |
| `Leads` | phẳng | Ghi nhận mỗi lần bấm gọi / mở Zalo. Dữ liệu gốc cho dashboard KTV (Phase 3) và chống click ảo (Phase 4) — thiết kế bảng đủ trường ngay từ đầu. |
| `Areas` (public) | phẳng | Mở `administrative_areas` ra ngoài: cây tỉnh/quận và số KTV đã duyệt theo khu vực — frontend cần con số này để quyết định index hay noindex. |

Không module nào ở phase này tự ghi/trừ số dư hay tự cấp phát slot, nên tất cả đều phẳng. Chạy skill
`new-feature-module` khi scaffold.

### 1.2 Migration

Raw SQL trong `migrationBuilder.Sql(...)`, `Down()` phải chạy thật được (CI chạy up → down → up). Chạy
skill `db-migration` trước khi viết.

| Bảng / thay đổi | Ràng buộc đáng chú ý |
|---|---|
| `services` | `slug` UNIQUE (đi vào URL `/dich-vu/{slug}` nên phải ổn định), `is_active` để ẩn mà không xoá |
| `ktv_services` | `UNIQUE (ktv_id, service_id)`; `price_from NUMERIC(12,0)`, `duration_min SMALLINT` |
| `leads` | `channel VARCHAR CHECK IN ('CALL','ZALO','SMS')`; `ip INET`, `user_agent`, `device_hash`, `area_id`, `source_url`; index `(ktv_id, created_at DESC)` |
| `reviews` | `rating SMALLINT CHECK BETWEEN 1 AND 5`; `status CHECK IN ('PENDING','PUBLISHED','REJECTED')`; `UNIQUE (ktv_id, author_user_id)` chống spam; partial index `WHERE status='PUBLISHED'` |
| `ktv_profiles` — cột mới | `response_rate NUMERIC(5,4)`, `response_count INT`, `lead_count INT` — thành phần của BaseScore |
| Index tìm kiếm | `CREATE INDEX … USING GIST (base_point) WHERE verification_status = 'VERIFIED'` — partial index, EF không mô hình hoá được nên phải viết tay |
| `area_ktv_counts` | Bảng đếm (hoặc materialized view) `area_id → verified_count`, refresh theo lịch. Frontend đọc để quyết định `noindex`. |

### 1.3 API

| Method | Endpoint | Ghi chú |
|---|---|---|
| GET | `/api/v1/search` | `?lat&lng&radiusKm&service&areaSlug&page&size` — trả kèm `distanceM` và `score` |
| GET | `/api/v1/areas` · `/areas/{slug}` | Cây khu vực + số KTV đã duyệt |
| GET | `/api/v1/services` | Danh mục dịch vụ |
| GET | `/api/v1/ktv/{id}` | Mở rộng: dịch vụ và giá, chứng chỉ *đã duyệt*, khu vực phục vụ, review |
| POST | `/api/v1/leads` | Công khai, có rate limit ngay từ đầu — đừng đợi Phase 4 mới thêm |
| POST/GET | `/api/v1/ktv/{id}/reviews` | Cần đăng nhập để viết; chỉ trả review `PUBLISHED` |
| GET | `/api/v1/public/sitemap` | Danh sách slug + `lastmod` để Next.js sinh `sitemap.xml` |

#### BaseScore v0

Công thức đầy đủ (Boost + Base) chỉ ráp ở Phase 2, nhưng **viết đúng cấu trúc ngay từ bây giờ** để sau
này chỉ cộng thêm `BoostPoints` chứ không phải viết lại:

```
BaseScore = 100 × ( 0.40 × ratingNorm       -- Bayesian, m = 10 review, C = rating trung bình toàn hệ
                  + 0.35 × (1 − d / radius)
                  + 0.15 × responseRate
                  + 0.10 × recency )        -- suy giảm theo last_active_at
```

> **Làm mượt Bayesian là bắt buộc, không phải tối ưu để dành.** Không có nó, một KTV đúng 1 review 5 sao
> sẽ đứng trên KTV 200 review 4.8 sao ngay tuần đầu ra mắt — và đó là ấn tượng đầu tiên của khách về chất
> lượng sản phẩm.

### 1.4 Frontend Next.js (mới hoàn toàn)

Tạo `apps/web` (App Router, TypeScript, Tailwind), thêm service vào `docker-compose.yml`.

| Route | Render | SEO |
|---|---|---|
| `/` | ISR | `Organization` + `WebSite` kèm `SearchAction` |
| `/massage-tan-noi/{tinh}/{quan}` | ISR 60–300s | `BreadcrumbList` + `ItemList`; `noindex, follow` khi < 3 KTV |
| `/ktv/{slug}-{id}` | ISR | `ProfessionalService` + `AggregateRating` + `Review` — chỉ dữ liệu thật |
| `/dich-vu/{slug}` | ISR | Liên kết chéo sang các khu vực có dịch vụ đó |
| `/tim-kiem` | SSR | Canonical về URL gốc cho mọi biến thể `?sort=`, `?page=` |
| `sitemap.xml` · `robots.txt` | động | Chia theo loại trang; chặn `/dashboard`, `/admin`, `/api` |

Chạy skill `seo-page-check` cho *từng* trang public trước khi coi là xong. Kiểm chứng SSR bằng `curl` xem
HTML thô — DevTools Elements hiển thị DOM sau khi JS chạy nên lúc nào cũng trông có vẻ ổn.

### 1.5 Test

- Search theo bán kính trên Postgres thật: KTV cách 4.9km và 5.1km với `radius=5` → đúng một cái lọt.
- Chỉ hồ sơ `VERIFIED` xuất hiện trong kết quả — `PENDING`/`REJECTED` không rò rỉ.
- Bayesian smoothing: 1 review 5★ không vượt 200 review 4.8★.
- Recompute `rating_avg` qua `ExecuteUpdate` — **đọc lại bằng `DbContext` khác**, vì `ExecuteUpdate` ghi
  thẳng xuống DB và bỏ qua change tracker.
- Ngưỡng noindex: khu vực 2 KTV → trang trả `noindex`; thêm KTV thứ ba → mở index.

### 1.6 Hoàn thành khi

- Khách tìm được KTV theo GPS, xem hồ sơ, bấm gọi và lead được ghi log.
- p95 latency `/search` < 300ms với ~5.000 hồ sơ seed — đo thật, đừng suy đoán.
- `curl` trang khu vực → HTML thô đã chứa danh sách KTV, tên khu vực, rating.
- Rich Results Test pass cho cả trang hồ sơ và trang khu vực.
- Không có trang nào < 3 KTV lọt vào `sitemap.xml`.

### 1.7 Bẫy đã biết

- **Hai bán kính, không phải một.** Khách có bán kính tìm, KTV có `service_radius_km`. Phải quyết rõ luật
  khớp — đề xuất: chỉ khớp khi `distance ≤ min(radius khách, radius KTV)`. Bỏ vế thứ hai thì khách sẽ gọi
  trúng KTV không nhận đi khu đó, và đổ lỗi cho nền tảng.
- `ST_DWithin` trên `geography` nhận **mét**; trên `geometry` nhận độ. Nhầm hai cái này cho ra kết quả
  lệch hàng trăm lần mà không báo lỗi.
- Khu vực thưa KTV mà trọng số khoảng cách quá gắt → trả danh sách rỗng. Test riêng vài quận ngoại thành.

---

## Phase 2 — Ví & gói đẩy tin ✅ đã xong

**Mục tiêu**: bật doanh thu. Đây là vùng code duy nhất mà một lỗi im lặng biến thành mất tiền thật của
KTV hoặc bán trùng một slot cho hai người — cả hai đều không tự phục hồi.

### 2.1 Project mới — ranh giới do trình biên dịch ép

| Project | Loại | Nội dung |
|---|---|---|
| `src/Massage.Wallet.Domain` | Hexagonal | Money, số dư, bút toán, Hold, quy tắc idempotency. **Không tham chiếu EF Core hay ASP.NET** — nhờ vậy không ai vô tình import được `DbContext` vào domain. |
| `src/Massage.Promotion.Domain` | Hexagonal | Catalog gói, state machine campaign (`DRAFT → PENDING → ACTIVE → EXPIRED/CANCELLED`), luật slot, bảng giá. |
| `Modules/Wallet/Adapters` | adapter | Hiện thực port bằng EF/Npgsql + controller. Toàn bộ SQL nằm ở đây, không lọt vào domain. |
| `tests/Massage.Wallet.Domain.Tests` | unit | 100% business rule, không cần Postgres → chạy trong vài giây. |

Thêm một bước CI khẳng định hai project domain không có package reference tới `Npgsql` hay
`Microsoft.EntityFrameworkCore`. Ranh giới không được kiểm tra sẽ mòn đi trong vài tháng.

### 2.2 Migration

| Bảng | Ràng buộc đáng chú ý |
|---|---|
| `wallets` | `UNIQUE (user_id)`; `balance NUMERIC(14,0)` (VND không có phần lẻ); `version INT` cho optimistic concurrency; `CHECK (balance >= 0)` |
| `wallet_transactions` | **`UNIQUE (idempotency_key)`** — trái tim của cả phase; `type CHECK IN ('TOPUP','CAPTURE','REFUND','ADJUST')` (khác kế hoạch ban đầu: HOLD/RELEASE không đổi số dư nên có vòng đời riêng ở `wallet_holds`, nhờ vậy bất biến `SUM(amount) = balance` đúng theo nghĩa đen); `amount` có dấu; `balance_after` để đối soát |
| `wallet_holds` | `expires_at` bắt buộc — process chết giữa chừng thì tiền KTV không treo vĩnh viễn |
| `promotion_packages` | `type CHECK IN ('VIP_PIN','FEATURED_BADGE','INSTANT_BOOST')`; `boost_points INT`; `price NUMERIC(12,0)` |
| `campaigns` | `status CHECK`; `start_at`/`end_at TIMESTAMPTZ`; index cho truy vấn campaign ACTIVE theo khu vực |
| `slot_allocations` | **`UNIQUE (area_id, package_type, window_start, slot_index)`** — trọng tài cuối cùng chống bán trùng slot |
| `payment_webhook_events` | `UNIQUE (provider, provider_txn_id)`; lưu raw payload để đối chất với cổng thanh toán khi có tranh chấp |

### 2.3 Tích hợp cổng thanh toán

- Chọn một cổng trước (VNPay hoặc Momo), làm xong hẳn rồi mới thêm cổng thứ hai — adapter thứ hai rẻ,
  adapter đầu tiên đắt.
- Luồng: `POST /wallet/topup` tạo intent → redirect → cổng gọi IPN → **verify chữ ký** → ghi sổ.
- Không bao giờ tin kết quả client báo về (`returnUrl`) — chỉ IPN server-to-server mới được cộng tiền.
- Dùng chính `transactionId` của cổng làm `idempotency_key`. Trùng → trả **200**, không phải lỗi; cổng
  cần 200 để ngừng retry.

```sql
-- EF Core không sinh được ON CONFLICT. Bắt buộc raw SQL:
INSERT INTO wallet_transactions (…, idempotency_key)
VALUES (…, @key)
ON CONFLICT (idempotency_key) DO NOTHING;
-- rồi kiểm tra số dòng ảnh hưởng.
-- KHÔNG dùng SELECT-trước-INSERT-sau: có khe hở giữa hai câu lệnh.
```

### 2.4 Ranking v1 — ráp Boost vào Base

```
FinalScore = BoostPoints + BaseScore

    VIP Pin         +500
    Instant Boost   +300     (gói bán từ Phase 3, điểm định nghĩa từ bây giờ)
    Featured Badge  +150
    BaseScore       0–100
```

Khoảng cách giữa **mọi cặp hạng liền kề** phải lớn hơn dải BaseScore tối đa, tính cả bậc từ hạng thấp
nhất xuống KTV không mua gói — đó là cam kết thương mại với người mua, không phải tham số để tinh chỉnh.
Chạy skill `ranking-algo-change`.

> Badge ban đầu đặt +50 theo tài liệu gốc, và con số đó **phá** chính cam kết trên: nhỏ hơn dải
> BaseScore nên KTV miễn phí điểm nền cao vẫn vượt được người đang trả tiền. Nâng lên 150 ngày
> 2026-09-01, kèm migration backfill campaign còn ACTIVE. Không chọn 200 vì khi đó khoảng cách
> Badge→Instant còn đúng 100, tức bằng chứ không lớn hơn.

### 2.5 API

| Method | Endpoint | Ghi chú |
|---|---|---|
| GET | `/api/v1/wallet/balance` · `/wallet/transactions` | Sổ phụ để KTV tự đối chiếu |
| POST | `/api/v1/wallet/topup` | Tạo phiên thanh toán, trả URL cổng |
| POST | `/api/v1/wallet/topup/callback` | IPN — công khai nhưng verify chữ ký, idempotent |
| GET | `/api/v1/promotions/packages` | Catalog + slot còn trống theo khu vực |
| POST | `/api/v1/campaigns` | Mua gói — header `Idempotency-Key` **bắt buộc** |
| DELETE | `/api/v1/campaigns/{id}` | Huỷ + hoàn tiền theo tỉ lệ; chốt chính sách hoàn tiền *trước* khi code |
| GET | `/api/v1/admin/revenue` | Doanh thu theo ngày / khu vực / gói |

Frontend phase này là dashboard KTV (ví, mua gói, danh sách campaign) — nằm sau đăng nhập,
`robots.txt` chặn, không cần SEO. Đã làm: `/dang-nhap`, `/dashboard`, `/dashboard/vi`,
`/dashboard/goi`, `/dashboard/chien-dich`. JWT giữ trong cookie httpOnly, không phải localStorage.

### 2.6 Test đồng thời — không đọc bằng mắt

- 2+ request tranh slot cuối cùng → đúng 1 thành công, phần còn lại nhận 409 và **được release hold đầy đủ**.
- Webhook nạp tiền bắn 2 lần cùng payload → số dư chỉ tăng 1 lần.
- Số dư không đủ → không tạo campaign, không để lại hold treo.
- Sau *mỗi* test: khẳng định bất biến `SUM(wallet_transactions.amount) == wallets.balance`.
- Job dọn hold quá hạn: giết process giữa chừng → hold được giải phóng ở lần sweep kế tiếp.

### 2.7 Hoàn thành khi

- Nạp tiền idempotent đã chứng minh bằng test bắn webhook trùng.
- Mua gói trừ đúng tiền; mọi thay đổi số dư đều có bút toán tương ứng kèm `balance_after`.
- KTV mua VIP Pin hiện đúng vị trí ưu tiên trong kết quả search thật.
- Không tồn tại đường code nào `UPDATE wallets SET balance = balance - x` trước khi slot được xác nhận.
- Checklist `wallet-tx-review` đã chạy hết, không mục nào để lại TODO.

> **Bốn chỗ EF Core sẽ phản bội bạn ở phase này**: không có upsert (`ON CONFLICT` phải viết raw SQL) ·
> không có `SELECT … FOR UPDATE` (`FirstOrDefaultAsync` *không* khoá dòng) · `ExecuteUpdate` bỏ qua change
> tracker · tiền phải là `decimal` với `.HasPrecision(14,0)`, để EF tự suy sẽ làm tròn âm thầm. Nhận diện
> unique violation đúng cách: `ex.InnerException is PostgresException { SqlState: "23505" }` — bắt
> `DbUpdateException` trần rồi coi mọi lỗi là "hết slot" sẽ nuốt luôn lỗi mất kết nối và trả 409 sai sự thật.

---

## Phase 3 — Realtime & quy mô (3–4 tuần)

**Mục tiêu**: search đọc từ Redis, và Instant Hourly Boost có hiệu lực trong vài giây. Nếu boost mất 5
phút mới lên, KTV mất phần đáng kể thứ họ vừa trả tiền mua.

### 3.1 Redis — read-path, không phải nơi giữ trạng thái

| Key | Kiểu | Nội dung |
|---|---|---|
| `geo:ktv` | GEO | Toạ độ mọi KTV đã duyệt; `GEOSEARCH` lấy candidate, có giới hạn số lượng trước khi merge điểm |
| `ranking:{areaId}` | ZSET | score = `FinalScore`, member = ktvId |
| `boost:{ktvId}` | HASH | Boost đang hiệu lực kèm `end_at` |
| `listings:active:{areaId}` | SET | Lọc nhanh theo khu vực |
| `lock:slot:{area}:{type}:{window}` | STRING | Fast-path lock, có TTL và `requestId` để chỉ chủ sở hữu xoá được |

- **Write-through**: ghi Postgres xong thì cập nhật Redis ngay trong cùng luồng, không đợi TTL. Trigger:
  duyệt hồ sơ, sửa hồ sơ, campaign ACTIVE/EXPIRED, recompute rating.
- TTL 5–10 phút chỉ là lưới an toàn tự phục hồi khi lỡ event. Nếu thấy mình *dựa* vào TTL để dữ liệu đúng
  thì luồng write-through đang thiếu ở đâu đó.
- Fallback bắt buộc: Redis miss hoặc chết → query PostGIS trực tiếp rồi warm lại cache. Chậm hơn, nhưng đúng.
- Thêm lệnh CLI `dotnet Massage.Api.dll rebuild-cache` dựng lại toàn bộ index từ Postgres — và test nó
  thật sự chạy.

### 3.2 Background job (Hangfire, storage Postgres)

| Job | Trigger | Nhiệm vụ |
|---|---|---|
| `promotion:activate` | sau commit | Set `ACTIVE`, ghi `boost:{ktvId}` ngay trong luồng mua — không đợi cron |
| `promotion:expire` | delayed | `delay = end_at − now()`; xoá boost khỏi Redis |
| `promotion:expire-sweep` | cron 1 phút | Lưới an toàn bắt job lỡ do worker crash |
| `instant-boost:golden-hour` | cron mỗi giờ | Kích hoạt campaign đã đặt cho khung giờ hiện tại, tôn trọng `max_slots_per_area` |
| `wallet:reconcile` | cron hằng đêm | So khớp `SUM(wallet_transactions)` với `wallets.balance`, cảnh báo nếu lệch |
| `hold:cleanup` | cron 5 phút | Release hold quá `expires_at` |

### 3.3 Instant Hourly Boost — cấp phát slot hai lớp

> **Đã làm xong lớp Postgres (2026-09-02).** Tách khỏi phần Redis đúng như mục "chỗ cắt được nếu
> cần ship sớm" ở cuối tài liệu này. Gói `instant-boost-1d` đã mở bán, chiếm slot theo **khung giờ**
> (3 khung liên tiếp kể từ giờ kế tiếp), dùng lại nguyên bảng `slot_allocations` và ràng buộc UNIQUE
> sẵn có — `package_type` nằm trong khoá nên khung giờ không đụng khung ngày.
>
> **Lớp Redis lock (bước 1 và 7) đã làm xong** (2026-09-02): cổng `ISlotLock` ở domain, adapter
> `RedisSlotLock` ở tầng API, TTL 10s và lệnh nhả có so khớp `requestId` bằng Lua.
>
> Đã kiểm chứng đúng điều tài liệu này yêu cầu — **tắt hẳn Redis thì luồng mua gói vẫn đúng**, chỉ
> mất phần gom hàng: vẫn mua được, vẫn chọn đúng `slot_index` kế tiếp, ví không lệch sổ. Không lấy
> được khoá là đi tiếp chứ không phải bị từ chối.

```
1. Redis lock (TTL + requestId)      ← fast-path: phản hồi nhanh, giảm tải DB
2. BEGIN
3.   Hold(số tiền) trên ví
4.   INSERT slot_allocations …        ← UNIQUE constraint là trọng tài cuối cùng
5.   Capture nếu thành công / Release nếu 23505
6. COMMIT  →  ghi boost:{ktvId} vào Redis
7. finally: nhả lock (chỉ khi requestId khớp)
```

Lock Redis có thể hết hạn giữa chừng nếu transaction chạy lâu hơn dự kiến — lúc đó hai request cùng tin
mình đang giữ lock. Chỉ ràng buộc DB mới chặn được. Nếu Redis chết hoàn toàn, luồng mua gói vẫn phải
*đúng*, chỉ chậm hơn.

### 3.4 Thống kê cho KTV

- Bảng `analytics_events` partition theo tháng (impression / click / lead), ghi async để không chặn
  request search.
- Dashboard KTV: lượt hiển thị, lượt bấm gọi, thứ hạng trung bình theo khu vực, hiệu quả từng campaign.
- Ghi song song sang ClickHouse chỉ khi Postgres thật sự đuối — thêm datastore thứ ba theo số đo, không
  theo kế hoạch.

### 3.5 Hoàn thành khi

- 2 KTV mua đồng thời slot cuối → đúng 1 thắng, người thua được release hold trong < 1s.
- Độ lệch giữa thời điểm boost có hiệu lực thực tế và `start_at`/`end_at` < 5 giây.
- Đường search chính đọc từ Redis; tắt Redis → kết quả vẫn đúng, có log cảnh báo.
- `rebuild-cache` dựng lại từ Postgres cho kết quả khớp 100% với cache đang chạy.

---

## Phase 4 — Hardening trước khi mở rộng (3–4 tuần)

**Mục tiêu**: chuyển từ "chạy được" sang "vận hành được khi có sự cố lúc 2 giờ sáng".

### 4.1 Quan sát & cảnh báo

- Sentry + OpenTelemetry; log có correlation id xuyên suốt request → job.
- Dashboard: p95 latency search, error rate, tỉ lệ cache hit, độ trễ hàng đợi job.
- **Alert khi đối soát ví lệch > 0đ** — không im lặng bỏ qua, dù chỉ 1đ.
- Alert khi Hangfire có job stuck quá ngưỡng, kèm runbook xử lý.

### 4.2 Chống gian lận

- Rate limit lead/click theo IP + device fingerprint; cửa sổ dedupe (cùng thiết bị bấm gọi 5 lần trong 1
  phút = 1 lead).
- Điểm nghi ngờ + hàng đợi admin xem lại; lead bị đánh dấu gian lận không tính vào thống kê tính phí.
- Chống review giả: ~~chỉ cho review khi đã có lead tương ứng~~, giới hạn theo tài khoản.
  **Nền đã làm xong (2026-09-04)**, nhưng vế gạch bỏ thì không: đo thực tế cho thấy chặn cứng
  "phải có lead" sẽ loại gần hết đánh giá thật, vì phần lớn khách bấm gọi *trước* khi đăng nhập nên
  lead lúc đó ẩn danh. Thay bằng: sửa lỗ khiến mọi lead đều ẩn danh (`ContactButtons` gọi backend
  cross-origin không kèm token), gắn `lead_id` vào review khi khớp được, và mở `GET /admin/reviews`
  để admin lọc theo dấu hiệu. `hasLead` là dấu hiệu để xếp thứ tự đọc, **không** phải điều kiện tự
  động gỡ — chi tiết trong `.claude/rules/project-status.md`.

### 4.3 Bảo mật & hạ tầng

- **Tắt OTP stub**, cắm adapter SMS thật vào đúng chỗ code đang ném lỗi rõ ràng; rate limit gửi OTP theo
  số điện thoại và theo IP.
- Refresh token + xoay khoá; `Jwt:Secret` lấy từ secret manager, không nằm trong compose.
- Chuyển file chứng chỉ sang S3/R2 (chỉ cần sửa `CertificationUpload`), thêm quét virus và signed URL có hạn.
- Backup + PITR cho Postgres, diễn tập restore ít nhất một lần thật.

### 4.4 Mở rộng SEO

- Nội dung biên tập riêng cho từng quận/huyện (giới thiệu, lưu ý chọn KTV, FAQ) — không copy-paste đổi tên.
- Theo dõi Google Search Console: coverage error, trang "Discovered – not indexed" do thin content.
- Mở index dần theo dữ liệu: khu vực đạt ngưỡng KTV thì tự gỡ `noindex`.

### 4.5 Kế toán

- Báo cáo đối soát xuất được cho kế toán; hoá đơn điện tử/VAT cho gói quảng cáo.
- Chính sách hoàn tiền viết thành tài liệu, khớp đúng với code huỷ campaign ở Phase 2.

### 4.6 Hoàn thành khi

- Alert đối soát thật sự bắn — test bằng cách chèn bút toán lệch trên staging.
- Có runbook cho: job stuck, cổng thanh toán chết, Redis chết, DB failover.
- Load test đạt ngưỡng req/s đặt theo số liệu người dùng thực tế tại thời điểm đó, không phải con số đoán
  từ bây giờ.

---

## Xuyên suốt — việc không thuộc phase nào

### Kiểm duyệt nội dung — rủi ro chưa có trong kế hoạch hiện tại

Mô hình "massage tận nơi" ở Việt Nam bị lợi dụng làm vỏ bọc cho dịch vụ trá hình khá thường xuyên. Rủi ro
này chạm đúng hai trụ cột của dự án: pháp lý, và **kênh acquisition chính** — Google hạ hạng mạnh tên miền
bị phân loại là nội dung người lớn, mà mất SEO ở đây là mất gần như toàn bộ khách. Cần chuẩn bị từ Phase 1,
không đợi Phase 4:

- Kiểm duyệt ảnh đại diện và `bio` trước khi hiển thị công khai — mở rộng luồng duyệt hồ sơ đã có ở
  Phase 0, đừng làm mới.
- ✅ **Nút báo cáo vi phạm trên trang hồ sơ công khai + hàng đợi xử lý cho admin** (2026-09-04,
  `Modules/Reports`). Báo cáo **không** tự ẩn hồ sơ: một nút ẩn được bằng vài lần bấm là vũ khí để
  KTV đối thủ hạ nhau, và hồ sơ bị ẩn oan là doanh thu mất thật. Nó chỉ đưa hồ sơ vào hàng đợi, còn
  việc gỡ đi qua đúng đường duyệt hồ sơ đã có (`PATCH /admin/ktv/{id}/verify`) — nhân bản logic đổi
  trạng thái hồ sơ vào đây sẽ tạo ra hai đường phải giữ cho khớp nhau mãi mãi. Hàng đợi xếp theo số
  báo cáo còn chờ của **hồ sơ**, không theo thời gian: một hồ sơ bị hai mươi người báo cáo khác hẳn
  về mức độ so với hai mươi hồ sơ mỗi cái một báo cáo, mà danh sách phẳng theo thời gian thì hai
  trường hợp trông giống hệt nhau.
- Bắt buộc chứng chỉ hành nghề đã duyệt mới được xuất hiện trong search — biến việc xác minh thành hàng
  rào chất lượng, đồng thời là điểm bán hàng.

### Giữ skill khớp với kiến trúc

5 skill trong `.claude/skills/` mã hoá quy ước hiện tại. Khi Phase 2 tạo project domain riêng và Phase 3
đưa Redis vào đường search, cập nhật `new-feature-module` và `ranking-algo-change` cho khớp — skill lỗi
thời nguy hiểm hơn không có skill. Blueprint kiến trúc cũng cập nhật tại chỗ, không tạo bản mới.

### Thứ tự phụ thuộc & chỗ cắt được nếu cần ship sớm

- Phase 2 **bắt buộc** sau Phase 1: không có search thì không có gì để bán vị trí trong đó.
- Phase 3 có thể hoãn nếu lượng KTV còn nhỏ — PostGIS trực tiếp chịu được vài nghìn hồ sơ. Nhưng
  **Instant Hourly Boost thì không hoãn được** vì theo thiết kế nó là gói bán chạy nhất; nếu cần ra sớm,
  tách nó khỏi phần Redis và làm trước trên Postgres.
- Trong Phase 1, phần cắt được an toàn nhất là Reviews — ra sau 2 tuần cũng không sao. Phần **không** cắt
  được là SEO kỹ thuật: Google cần thời gian tích luỹ tín hiệu, làm muộn 3 tháng là mất 3 tháng traffic.

[blueprint]: https://claude.ai/code/artifact/a6b39c02-9ed5-4b79-abb1-d7bf68c0c6c0
[roadmap-artifact]: https://claude.ai/code/artifact/56846747-ea02-46b4-9ce1-f144a6ce741d
