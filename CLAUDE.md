# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
dotnet build Massage.sln              # build
dotnet test Massage.sln               # toàn bộ test (CẦN Postgres đang chạy — xem bên dưới)
dotnet test --filter "FullyQualifiedName~OtpService"   # một nhóm test
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

Frontend Next.js ở `apps/web` (chạy cùng `docker compose up -d`, cổng 3000):

```bash
docker compose build web && docker compose up -d web
# typecheck/lint/build không cần cài Node trên host:
docker run --rm --network massage-platform_default -v "C:/Startup/massage-platform/apps/web:/app" \
  -w /app -e API_BASE_URL="http://api:8080/api/v1" node:20-alpine npm run build
```

Kiểm chứng SSR **luôn bằng HTML thô** (`curl http://localhost:3000/... | grep`), không bằng
DevTools Elements — DevTools hiển thị DOM sau khi JS chạy nên trang client-render vẫn trông ổn.

Migration chạy từ `src/Massage.Api`: `dotnet ef migrations add <Tên>`, `dotnet ef database update`,
`dotnet ef database update 0` (rollback hết).

`GET /api/v1/health` trả về cả phiên bản PostGIS — dùng nó để xác nhận DB thật sự sẵn sàng,
không chỉ là kết nối được.

### Smart App Control chặn binary build local

Máy dev hiện tại bật Smart App Control, nên `dotnet run` / `dotnet test` chạy trực tiếp trên host
sẽ fail với `An Application Control policy has blocked this file (0x800711C7)`. Đường vòng đã dùng
là chạy trong container SDK:

```bash
MSYS_NO_PATHCONV=1 docker run --rm --network massage-platform_default \
  -v "C:/Startup/massage-platform:/src" -w /src \
  -e TEST_DB_CONNECTION="Host=postgres;Port=5432;Database=postgres;Username=massage;Password=massage_dev_pw" \
  mcr.microsoft.com/dotnet/sdk:8.0 dotnet test Massage.sln
```

**Đừng đề xuất tắt Smart App Control** — đó là thao tác một chiều, muốn bật lại phải cài lại Windows.

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
`src/Massage.Api/Modules/<Tên>/` và tự chứa, nhưng **mức abstraction khác nhau tuỳ mức rủi ro**:

| Loại | Ví dụ | Kiến trúc |
|---|---|---|
| Chạm tiền / cấp phát slot | Wallet, Promotion, Campaign, SlotAllocation | Hexagonal — tách thành **class library riêng** (`Massage.Wallet.Domain`) không tham chiếu ASP.NET/EF |
| Còn lại | Auth, KtvProfiles, Admin, Search, ServiceCatalog, Areas, Leads, Review | Phẳng — controller / service / EF trực tiếp |

Hai module Hexagonal đầu tiên đã có từ Phase 2 (`Massage.Wallet.Domain`, `Massage.Promotion.Domain`)
— dùng chúng làm mẫu thay vì dựng lại từ đầu.

Lý do: module CRUD có logic mỏng, bọc thêm ba lớp chỉ tạo ma sát. Module tiền bạc thì ngược lại —
cần test được 100% business rule mà không đụng DB, vì một lỗi im lặng ở đó thành mất tiền thật
hoặc bán trùng slot, và cả hai đều không tự phục hồi.

**Điểm mạnh riêng của .NET ở đây**: ranh giới Hexagonal được *trình biên dịch* ép buộc qua project
reference — nếu `Massage.Wallet.Domain` không tham chiếu EF Core thì không ai vô tình import được
`DbContext` vào domain. Ở TypeScript đây chỉ là quy ước. Khi tạo module chạm tiền, hãy tận dụng:
tạo project riêng thay vì chỉ tạo thư mục.

Khi lưỡng lự, hỏi: *module này có tự ghi/trừ số dư hoặc tự cấp phát slot không?* Có → Hexagonal.

### Postgres là source of truth, Redis là cache

Postgres + PostGIS giữ toàn bộ trạng thái. Redis (sẽ dùng từ Phase 3) chỉ là read-path cache cho
geo-search và bảng xếp hạng, cập nhật theo kiểu **write-through** — không có trạng thái nào chỉ
tồn tại trong Redis, và mọi thứ trong Redis phải tái tạo được từ Postgres.

Redis lock (khi tranh slot quảng cáo) chỉ là fast-path để phản hồi nhanh và giảm tải. **Trọng tài
cuối cùng luôn là UNIQUE constraint ở tầng DB**, vì lock có thể hết hạn giữa chừng khi transaction
chạy lâu hơn dự kiến.

### Migration viết bằng raw SQL, không dùng fluent API

`Data/Migrations/*.cs` dùng `migrationBuilder.Sql(...)` chứ không dùng `CreateTable(...)`. Lý do:
EF không mô hình hoá được CHECK constraint, index GiST cho `geography`, hay partial index — mà đây
đều là thứ bảo vệ tính đúng đắn dữ liệu. Model snapshot vẫn do EF sinh, nên `dotnet ef migrations add`
vẫn hoạt động bình thường; chỉ phần thân `Up`/`Down` là viết tay.

`Down()` phải thật sự chạy được — CI chạy up → down → up để kiểm chứng.

Quy ước cột: UUID PK (`gen_random_uuid()`), `TIMESTAMPTZ` cho mọi mốc thời gian, `GEOGRAPHY(POINT,
4326)` + index GiST cho toạ độ, `NUMERIC` cho tiền (không bao giờ `float`/`double`), enum bằng
`VARCHAR + CHECK` thay vì Postgres ENUM.

### Test chạy trên Postgres thật, không dùng EF InMemory

`PostgresFixture` dựng database test riêng và áp migration thật. Chủ ý không dùng
`Microsoft.EntityFrameworkCore.InMemory`: provider đó không chạy được `ExecuteUpdate`, không có
CHECK constraint, không có PostGIS — test sẽ xanh trong khi code thật vỡ.

Hệ quả: **test cần Postgres đang chạy**. Đừng "sửa" test bằng cách chuyển sang InMemory, và đừng
hạ cấp code production (ví dụ đổi `ExecuteUpdateAsync` thành load-rồi-save) chỉ để chiều provider giả.

Một cái bẫy đã gặp: `ExecuteUpdate` ghi thẳng xuống DB và bỏ qua change tracker, nên nếu test dùng
lại cùng một `DbContext` cho cả ghi lẫn đọc thì sẽ đọc trúng entity cũ còn trong tracker. Thực tế
mỗi HTTP request có `DbContext` riêng — test phải mô phỏng đúng như vậy.

Bẫy thứ hai, đã cắn hai lần: **Npgsql tra data source theo chuỗi kết nối trong một cache dùng chung
cả process**. Kết nối nào mở trước sẽ chiếm chỗ, và nếu bản đó không có plugin NetTopologySuite thì
mọi thứ dựng sau — kể cả ứng dụng trong `WebApplicationFactory` — nhận lại bản thiếu plugin rồi fail
khi đọc cột `geography`. Vì vậy `PostgresFixture` dựng data source tường minh cho mình và dùng
`ApplicationName` khác cho kết nối bootstrap.

### Ba tầng test, mỗi tầng bắt một loại lỗi

| Tầng | Ở đâu | Bắt được gì |
|---|---|---|
| Domain | `tests/Massage.Wallet.Domain.Tests` | Quy tắc nghiệp vụ tiền bạc. Không cần DB, chạy vài chục mili giây |
| Service | `tests/Massage.Api.Tests/*ServiceTests.cs` | Truy vấn thật, ràng buộc DB, race condition |
| HTTP | `tests/Massage.Api.Tests/Api*Tests.cs` | Mã trạng thái, ánh xạ exception, quyền theo role, binding multipart, rate limit |

Tầng HTTP dùng `ApiFactory` (bọc `WebApplicationFactory<Program>`), **phải nằm trong
`PostgresCollection`** vì nó dùng chung database với fixture, còn xUnit chạy các collection song song.
Đăng nhập trong test đi qua đúng luồng OTP thật thay vì tự ký JWT.

Nó sinh ra sau khi một lỗi thật lọt qua hai tầng kia: `GET /ktv/campaigns` trả 404 thay vì danh sách
rỗng, làm hỏng dashboard của KTV vừa đăng ký, trong khi mọi test service vẫn xanh. Khi thêm endpoint
mới, hãy thêm cả test ở tầng này — đặc biệt là các trường hợp "rỗng", "không có quyền", và "lỗi
nghiệp vụ ra mã HTTP nào".

`ApiFactory.ErrorsOrEmpty()` trả log lỗi phía server: `AppExceptionHandler` cố ý không lộ chi tiết
500 ra response, nên khi test đỏ thì đó là chỗ duy nhất đọc được nguyên nhân.

### Công thức xếp hạng (Phase 2+)

```
FinalScore = BoostPoints (rời rạc theo hạng gói)  +  BaseScore (liên tục, 0–100)
```

Hai phần **cố ý tách biệt**: BaseScore (rating 0.40 + khoảng cách 0.35 + tỉ lệ phản hồi 0.15 + độ
mới 0.10) chỉ quyết định thứ tự *bên trong* cùng một hạng. Đừng làm mờ ranh giới giữa hai thành
phần này. BoostPoints lấy **MAX** các gói đang chạy, không cộng dồn — cộng dồn thì hai gói rẻ vượt
được gói đắt nhất.

Ràng buộc phải giữ: **mọi khoảng cách giữa hai hạng liền kề lớn hơn 100**, tính cả bậc từ hạng thấp
nhất xuống KTV không trả phí:

```
organic(0) →150→ Badge(150) →150→ Instant(300) →200→ VIP(500)
```

Kiểm cả chuỗi chứ không chỉ hạng vừa sửa — `PackageTypes.TierGapsAreValid()` làm đúng việc đó và có
test canh. Đây chính là chỗ từng bị bỏ sót: Badge ban đầu là +50, nhỏ hơn dải BaseScore, nên KTV
miễn phí điểm nền cao vẫn vượt được người đang trả tiền. **Nâng lên 150 ngày 2026-09-01** theo quyết
định kinh doanh, kèm migration backfill các campaign Badge còn ACTIVE. Không chọn 200 vì khi đó
khoảng cách Badge→Instant tụt xuống đúng 100, tức bằng chứ không lớn hơn dải BaseScore.

API `GET /promotions/packages` trả cờ `guaranteesTopPlacement` để mô tả gói bán ra luôn khớp với
hành vi thật của công thức.

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

**Phase 2 (Ví & gói đẩy tin) đã xong** (2026-09-01). Trước đó: Phase 0 foundation, Phase 1 geo-search
+ frontend Next.js. Chi tiết phần còn lại: [docs/roadmap-phase-1-4.md](docs/roadmap-phase-1-4.md).

Phase 2 thêm hai class library **không tham chiếu EF/ASP.NET** — `Massage.Wallet.Domain` và
`Massage.Promotion.Domain` — cùng adapter, use case và controller trong `Modules/Wallets` và
`Modules/Promotions`. Test nghiệp vụ tiền bạc nằm ở `tests/Massage.Wallet.Domain.Tests`, chạy trong
mili giây mà không cần Postgres; có test canh chính ranh giới đó, nếu ai thêm EF vào domain thì nó đỏ.

Bốn quyết định của Phase 2:

- **Ví có hai cột tiền**: `balance` (tổng sở hữu) và `held` (đang giữ cho lần mua chưa chốt).
  Khả dụng = hiệu hai cột. Giữ tiền **không** giảm `balance` — chỉ Capture, sau khi slot đã chắc
  chắn, mới trừ. Đảo lại thì KTV thua tranh slot thấy tiền biến mất trước khi được hoàn.
- **Sổ cái chỉ chứa dòng làm đổi số dư** (TOPUP/CAPTURE/REFUND/ADJUST), nên bất biến
  `SUM(amount) = balance` đúng theo nghĩa đen và kiểm được bằng một câu SQL. Vòng đời giữ/nhả tiền
  nằm ở `wallet_holds` chứ không chen vào sổ thành những dòng 0 đồng.
- **Campaign chạy đúng bằng các khung ngày nó chiếm slot**, cắt theo giờ Việt Nam. Một campaign
  7 ngày sinh 7 dòng `slot_allocations` — `UNIQUE` chặn được trùng giá trị rời rạc, không diễn đạt
  được "hai khoảng thời gian giao nhau".
- **Boost chỉ tính cho khu vực đã mua** khi tìm theo `areaSlug`. Tìm theo toạ độ thì chưa xác định
  được khu vực hành chính của khách (chưa có polygon ranh giới quận), nên mọi gói đang chạy đều được
  tính — còn khe mua gói ở quận rẻ để hưởng hạng ở quận bên cạnh.

Ba quyết định của Phase 1 dễ bị vô tình đảo ngược khi sửa sau này:

- **Hồ sơ công khai không chứa địa chỉ nhà và toạ độ được làm tròn ~100m.** Khoảng cách đã tính ở
  server nên client không cần toạ độ chính xác; đây là hồ sơ của người đi làm tại nhà khách.
- **Số điện thoại KTV chỉ trả về trong response của `POST /leads`.** Vừa chống quét số hàng loạt,
  vừa đảm bảo không có đường liên hệ nào không được đếm — Phase 2 tính phí dựa trên con số đó.
- **Ngưỡng cho index trang khu vực (`AreaService.MinKtvForIndex`) nằm ở backend**, frontend đọc cờ
  `indexable` chứ không tự so sánh. Sitemap và thẻ robots phải luôn khớp nhau.

Backend **đã chuyển từ NestJS sang .NET 8** (2026-08-26). Schema DB giữ nguyên; lịch sử NestJS còn
ở commit trước đó nếu cần đối chiếu.

Roadmap còn lại: Phase 3 Redis
ranking + Instant Boost + background worker → Phase 4 hardening. Kiến trúc chi tiết ở
[blueprint](https://claude.ai/code/artifact/a6b39c02-9ed5-4b79-abb1-d7bf68c0c6c0) — đã cập nhật
theo stack .NET; khi kiến trúc đổi, cập nhật lại artifact đó thay vì tạo bản mới.

Lưu ý vận hành hiện tại:

- **OTP đang ở chế độ stub** (`Otp:StubEnabled=true`): mã trả thẳng trong response và ghi log.
  Khi tắt stub, code ném lỗi rõ ràng thay vì âm thầm không gửi gì — đó là chỗ cắm adapter SMS thật.
- **Tài khoản ADMIN đầu tiên tạo thủ công** bằng SQL (`UPDATE users SET role='ADMIN' ...`). Không
  mở endpoint tự phong quyền admin.
- **`Jwt:Secret` phải ≥32 ký tự**, app từ chối khởi động nếu thiếu — cố ý fail fast vì secret rỗng
  khiến mọi token đều giả mạo được mà không lộ ra cho tới khi bị khai thác.
- **File chứng chỉ lưu trên đĩa local**. Chuyển sang S3/R2 bằng cách sửa `CertificationUpload`,
  phần còn lại của luồng upload không phụ thuộc nơi file nằm.
