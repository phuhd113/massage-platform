# Trạng thái dự án

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

**Phase 3 đang làm dở.** Xong phần đầu: **Instant Hourly Boost chạy trên Postgres** (2026-09-02).
Roadmap nói rõ phần Redis hoãn được khi lượng KTV còn nhỏ, còn Instant Boost thì không — nó là gói
bán chạy nhất theo thiết kế — nên nó được tách ra làm trước.

Bốn điều cần biết khi đụng vào phần này:

- **`slot_allocations` không đổi và cố ý không tách bảng riêng cho khung giờ.** `package_type` nằm
  trong khoá `UNIQUE (area_id, package_type, window_start, slot_index)`, nên khung giờ của Instant
  Boost không bao giờ đụng khung ngày của VIP Pin dù ghi chung một bảng. Tách bảng sẽ tạo ra hai
  trọng tài chống trùng phải tự giữ cho khớp nhau mãi mãi.
- **Độ mịn khung suy từ loại gói ở đúng một chỗ** (`SlotGranularities.For`). Tầng mua và tầng đếm tồn
  kho phải dùng chung nó; trước đây catalog đếm mọi gói theo khung ngày, nên gói theo giờ sẽ báo còn
  chỗ trong khi lệnh mua báo hết.
- **Gói theo giờ khai `duration_hours`, gói theo ngày để NULL** — ép bằng CHECK
  `chk_package_duration_unit` ở tầng DB, không chỉ bằng code: một hàng seed sai đơn vị sẽ bán 3 ngày
  với giá 3 giờ mà không test ứng dụng nào nhìn thấy.
- **Hoàn tiền tính theo đúng đơn vị khung của gói.** Tính theo ngày cho gói 3 giờ thì "số ngày trọn
  vẹn còn lại" luôn bằng 0 và KTV huỷ ngay sau khi mua mất trắng — lỗi im lặng, vì hàm vẫn trả về số.

**Khoá Redis khi tranh slot đã có** (2026-09-02, `RedisSlotLock` + cổng `ISlotLock`). Ba điều bắt
buộc nhớ khi sửa nó:

- **Nó là fast-path, không phải cơ chế đúng sai.** Trọng tài vẫn là `UNIQUE` ở `slot_allocations`.
  Không lấy được khoá thì **vẫn đi tiếp** — từ chối lệnh mua vì thua khoá sẽ biến một tối ưu thành
  lỗi nghiệp vụ, và Redis chết là cả sàn ngừng bán. Đã kiểm chứng: tắt hẳn Redis thì vẫn mua được,
  vẫn chọn đúng `slot_index` kế tiếp, ví không lệch sổ.
- **Nhả khoá phải so khớp token bằng Lua**, không `GET` rồi `DEL`. Khoá có thể hết hạn giữa chừng và
  người khác đã chiếm; xoá mù là mở khoá của họ. Khoá nhả **sau** commit, không phải trước.
- **Khoá chỉ đặt cho khung đầu tiên** và TTL rất ngắn (10s, ngắn hơn hold 5 phút nhiều). TTL dài thì
  một process chết sẽ chặn cả khu vực suốt quãng đó mà không đổi lại được gì.

Test khoá (`RedisSlotLockTests`) **bỏ qua khi không có Redis**, nên xanh không chứng minh được gì nếu
Redis không chạy — vì vậy khi `TEST_REDIS` được đặt tường minh mà không kết nối được thì test **ném
lỗi** thay vì bỏ qua. Chạy có Redis mất ~3s, bỏ qua chỉ vài chục ms; nhìn thời gian là biết.

Các test tranh slot khác cố ý chạy **không có khoá** (`NoSlotLock`) để chứng minh ràng buộc DB tự
mình chặn được — dùng khoá thật ở đó thì test vẫn xanh kể cả khi ai đó xoá mất `UNIQUE`.

Giới hạn đã biết, chưa làm: boost chỉ có hiệu lực khi `now()` rơi vào khung đã mua, và search đọc
trực tiếp từ Postgres mỗi request nên độ trễ hiệu lực bằng 0 mà **chưa cần** job `promotion:activate`.
Job đó chỉ trở nên bắt buộc khi đường đọc chuyển sang Redis.

**Đường search đã đo ở quy mô thật (2026-09-02)**: CTE `global` thiếu `MATERIALIZED` khiến p50 của
`/search` là 2,59 giây ở 5.000 hồ sơ; thêm một từ khoá còn 29ms. Redis read-path vì vậy tạm hoãn.
Toàn bộ chi tiết, bài học "đo trước, cache sau" và lý do `SearchQueryShapeTests` canh chuỗi SQL nằm
trong skill `ranking-algo-change`.

**Ô search khu vực có gợi ý** (2026-09-03) thay thẻ `<select>` phẳng 696 quận/huyện ở trang chủ và
`/tim-kiem`. Bốn điều đừng vô tình đảo ngược:

- **`areaSlug` phải đi kèm `provinceSlug` khi nó là slug quận.** Đứng một mình nó là slug **tỉnh**.
  Đây từng là bug thật: hai ô select cũ gửi slug quận trần, nên chọn "Huyện Châu Thành" (10 tỉnh có)
  trả về 0 kết quả kể cả khi quận đó có KTV. Mọi đường dựng URL tìm kiếm phải đi qua
  `lib/area-search.ts` chứ không tự ghép tham số — nó cũng lo việc xoá cặp slug khi chuyển sang toạ độ.
- **`name_ascii` do trigger `trg_area_name_ascii` trong DB dựng, không do đường ghi ứng dụng.** Bảng
  có hai đường ghi và một trong hai là `seed-areas` (raw SQL, không qua EF). Bắt cả hai cùng nhớ điền
  một cột dẫn xuất là chỗ hỏng được đảm bảo: seed báo thành công còn ô gợi ý trả rỗng. EF khai cột
  này `ValueGeneratedOnAddOrUpdate` để không ghi đè.
- **Chuỗi khớp bỏ dấu từ chính `name`, không mượn `slug`.** Slug và tên là hai thứ độc lập; khu vực
  có slug khác tên thì gõ đúng tên đang hiển thị lại không ra gì.
- **Câu suggest chốt top-N ở CTE `MATERIALIZED` rồi mới đếm KTV.** Cho `ktv_count` vào `ORDER BY`
  buộc Postgres đếm cho **mọi** dòng khớp — "xa" khớp 7.777 khu vực, 57ms và tăng theo số hồ sơ chứ
  không theo số khu vực. Cái giá là `ktv_count` không tham gia xếp hạng, đã cân nhắc và chấp nhận.

**Dashboard KTV và trang chủ dựng lại theo artboard** (2026-09-03). Bốn điều đừng vô tình đảo ngược:

- **Route group `(public)` tách khung trang bán hàng khỏi dashboard.** Dashboard có sidebar riêng
  248px; chồng thêm header/footer công khai lên là hai bộ điều hướng cùng lúc. `(public)` không đi
  vào URL nên mọi đường dẫn giữ nguyên. `not-found.tsx` phải nằm ở root nên nó **tự bọc**
  `PublicShell` — bỏ đi là trang 404 thành ngõ cụt không có đường quay lại.
- **Mọi mốc thời gian hiển thị phải đi qua `formatDate`/`formatDateTime`** (`lib/site.ts`), vốn ghim
  `timeZone: 'Asia/Ho_Chi_Minh'`. Gọi thẳng `toLocaleDateString('vi-VN')` thì server (UTC trong
  container) và trình duyệt cho ra hai chuỗi khác nhau: React báo hydration mismatch, và KTV ở múi
  giờ khác đọc sai ngày hết hạn chiến dịch. Backend vốn đã cắt khung ngày theo đúng múi giờ này.
- **`profile_views` đếm từ trình duyệt, không đếm ở endpoint đọc hồ sơ.** Trang hồ sơ được Next
  cache 600 giây, nên đếm ở đường đọc chỉ ghi được một lượt mỗi 10 phút — con số vẫn trông hợp lý
  nhưng không liên quan gì tới traffic thật. Beacon `POST /ktv/{id}/views` gộp theo cửa sổ 30 phút
  (rộng hơn lead 5 phút vì F5 không phải một ý định mới) và **nuốt lỗi khoá ngoại**: nó chạy trên
  trang khách đang xem, ném lỗi ở đó là đổi một dòng thống kê lấy cả trang.
- **Mọi phần trăm trên dashboard đều nullable và phải xử lý.** Tuần đầu của mọi KTV đều chưa có tuần
  trước để so, hồ sơ chưa ai xem thì không có mẫu số cho tỉ lệ liên hệ. "+100%" trên hồ sơ mới toanh
  là kiểu sai nghe rất thuyết phục.

Hai lỗi cùng một hình dạng đã gặp và đã có test canh: **`rating_avg` là `NUMERIC(3,2)`** nên nhân
với `rating_count` mà giữ nguyên scale sẽ tràn cột ở hồ sơ vài trăm đánh giá — cộng qua `double`
(xem `AreaService.GetStatsAsync` và `SiteStatsService`). Và **gói theo giờ phải hiển thị theo giờ**:
Instant Boost khai `duration_hours` với `duration_days=1`, ghi "1 ngày" ở đó là bán sai thứ khách
trả tiền.

**CORS cho hai endpoint gọi thẳng từ trình duyệt** (2026-09-03, `Common/CorsSetup.cs`). Đây là lỗi
đã tồn tại từ trước và chỉ lộ ra khi thêm beacon đếm lượt xem: `POST /leads` bị trình duyệt chặn,
tức khách bấm "Gọi ngay" **không lấy được số điện thoại** — mà server vẫn 200 với curl và mọi test
service vẫn xanh. `CorsTests` canh cả hai chiều, kể cả việc origin lạ **không** được cấp quyền.

Vì sao hai endpoint đó không đi qua Next.js proxy như phần còn lại: backend cần thấy đúng IP và
user agent của khách để gộp lead trùng (5 phút) và lượt xem trùng (30 phút). Qua proxy thì mọi khách
mang chung IP của server và cả hai cơ chế gộp sập thành một nhóm. Đổi lại là phải khai origin tường
minh — không dùng `AllowAnyOrigin` ở hai endpoint ghi thẳng vào số liệu tính tiền.

**Ba nhóm route, ba khung trang khác nhau** (2026-09-03): `(public)` có header/footer,
`(auth)` không có gì (màn đăng nhập chiếm trọn màn hình, chia hai cột), `/dashboard` có sidebar
riêng. Route group không đi vào URL nên mọi đường dẫn giữ nguyên.

**Bố cục mobile** (2026-09-03): khối lọc ở `/tim-kiem` xếp dọc và gộp ba chip thành một hàng cuộn
ngang dưới `sm` (`sm:contents` trả chúng về hàng wrap ở desktop); nút nổi "Xem bản đồ" chỉ hiện ở
mobile vì cặp nút trong khối lọc đã cuộn mất khi khách đọc tới hồ sơ thứ ba. Mọi thanh dính đáy phải
đi kèm `pb-*` tương ứng ở trang — thiếu là che mất nội dung cuối trang.

**Hangfire đã chạy** (2026-09-03, storage Postgres schema `hangfire`, xem `Modules/Jobs/`). Ba job
định kỳ: `hold:cleanup` (5 phút), `promotion:expire-sweep` (1 phút), `wallet:reconcile` (3 giờ sáng
giờ VN). Bốn điều đừng đảo ngược:

- **Tầng job cố ý mỏng, nghiệp vụ vẫn ở `WalletMaintenance`.** Lệnh CLI `maintenance` gọi đúng cùng
  những phương thức đó, nên chạy tay và chạy theo lịch không bao giờ làm hai việc khác nhau — điều
  quan trọng nhất đúng lúc phải chạy tay để chữa sự cố mà job tự động đang hỏng.
- **`wallet:reconcile` ném lỗi khi ví lệch, và không retry.** Job đỏ nằm trong dashboard thì người ta
  thấy; một dòng log Error lúc 3 giờ sáng thì không. Retry chỉ tạo ba lần đỏ cho cùng một sự việc và
  làm mờ mất thời điểm nó bắt đầu.
- **Múi giờ phải là id có thật trong tzdata (`Asia/Ho_Chi_Minh`).** Hangfire chỉ lưu *id* xuống DB
  rồi tra ngược mỗi lần tính lượt kế tiếp, nên `CreateCustomTimeZone("ICT", …)` tạo object hợp lệ
  trong tiến trình nhưng **làm app chết lúc khởi động** ở container Linux. Đã cắn một lần.
- **Lệnh CLI và môi trường `Testing` không dựng Hangfire server.** `AddHangfireServer` khởi động
  worker ngay lúc build host: `migrate` lúc deploy sẽ vừa áp migration vừa lặng lẽ chạy job, còn mỗi
  test `WebApplicationFactory` sẽ giành job từ cùng hàng đợi và chạy nghiệp vụ ví xen giữa các test.

Dashboard `/hangfire` **mặc định đóng** (401), mở bằng vai ADMIN hoặc cờ `Jobs:DashboardAnonymous` —
nó kích chạy và xoá được job. Không nối nó vào `[Authorize]` bằng token trên query string: đó là đẩy
JWT vào lịch sử trình duyệt, log proxy và Referer.

Phần Phase 3 còn lại: job delayed `promotion:expire` (chỉ bắt buộc khi đường đọc sang Redis),
analytics partition theo tháng, Redis read-path khi số đo đòi hỏi → rồi Phase 4. Chi tiết ở
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
- **Tile bản đồ đang dùng OSM công cộng** (`apps/web/src/lib/map.ts`). Không cần khoá nên chạy
  được ngay, nhưng OSM Tile Usage Policy không cho phép ứng dụng thương mại lưu lượng cao —
  phải đổi sang nhà cung cấp có hợp đồng trước khi mở traffic thật. Đổi ở đúng hai hằng số
  `TILE_URL`/`TILE_ATTRIBUTION`, không rải ra chỗ khác.
