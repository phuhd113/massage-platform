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

**"Tìm quanh tôi" tự điền khu vực đang đứng** (2026-09-04, `GET /areas/resolve`). Cột
`administrative_areas.centroid` (geography, index GiST partial) giữ tâm 63 tỉnh và 694/696
quận, seed từ polygon GADM 4.1 qua `tools/area-dataset/centroids.js`. Năm điều đừng đảo ngược:

- **Đây là "gần tâm nhất", KHÔNG phải "nằm trong ranh giới".** Bảng chỉ có centroid nên quận
  trả về có thể sai ở rìa những huyện dài hoặc lõm. Chấp nhận được vì nó chỉ là **cái nhãn**:
  kết quả tìm kiếm vẫn lọc theo bán kính quanh toạ độ thật, `resolve` không đụng vào đó. Hệ quả
  bắt buộc nhớ: **đừng dùng nó để quyết định KTV nào được boost ở khu vực nào** — giới hạn "tìm
  theo toạ độ thì mọi gói đang chạy đều được tính" vẫn còn nguyên, và gỡ nó cần polygon thật
  chứ không phải điểm gần nhất.
- **Trả đúng hình dạng của `/areas/suggest`.** Frontend dùng chung `lib/area-search.ts` để dựng
  URL; một DTO thứ hai mang cùng thông tin sẽ đẻ ra đường dựng URL thứ hai — đúng chỗ cặp
  `areaSlug`/`provinceSlug` từng bị gửi thiếu vế.
- **Chỉ trả cấp DISTRICT, và chỉ trong bán kính 60km.** Rơi về tỉnh khi không quận nào đủ gần
  là gán một khu vực rộng hàng trăm km cho câu hỏi "tôi đang ở quận nào"; bỏ ngưỡng thì khách
  ở nước ngoài nhận một tên quận nghe rất thuyết phục. Không dò ra thì **204, không phải 404** —
  GPS trôi ra biển là trạng thái bình thường, và 404 sẽ hiện thành báo đỏ cho một tiện ích phụ.
- **Nhãn dò được phải biến mất khi rời chế độ toạ độ.** `SearchFilters` xoá nó ngay khi URL
  không còn `lat` — giữ lại nghĩa là ô hiện tên quận khách đang đứng trong khi kết quả là của
  quận họ vừa chọn tay. Sai rất khó thấy vì cả hai đều là tên quận thật.
- **Việc dò theo dõi toạ độ trong URL, không nằm trong hàm bấm nút.** Trang có ba lối vào cùng
  mang `lat`/`lon`: bấm nút tại chỗ, đến từ trang chủ, và mở lại link đã lưu. Đặt trong handler
  chỉ đúng lối đầu.

Hai huyện đảo Hoàng Sa/Trường Sa **cố ý không có tâm** (GADM không có polygon), và phường/xã
cũng không cần — partial index chỉ phủ dòng có tâm nên hàng nghìn NULL không phình cây.

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

**Khách đăng ký được, không chỉ KTV** (2026-09-04). Đây là bug thật đã sửa: route
`/api/auth/session` ghi cứng `role: 'KTV'`, nên **mọi** người đăng nhập qua giao diện đều thành kỹ
thuật viên — kể cả khách chỉ muốn viết một đánh giá. Backend vốn đã nhận cả hai vai trò từ đầu.
Năm điều đừng đảo ngược:

- **Không có trang "đăng ký" riêng.** Với OTP thì đăng ký và đăng nhập là *cùng một thao tác*: số
  chưa có tài khoản thì backend tạo mới, số đã có thì cấp token cho tài khoản cũ. Tách ra sẽ là hai
  màn hình giống hệt nhau, và bắt người dùng tự nhớ mình từng đăng ký hay chưa.
- **Hai cửa vào theo đối tượng, không phải theo hành động**: `/dang-nhap` (khách, mặc định) và
  `/dang-ky-ktv` (KTV, kèm cột phải bán hàng). Không gộp thành một trang có ô chọn vai trò: 95%
  người mở màn hình đăng nhập là khách, bắt tất cả trả lời "bạn là ai" là dựng rào cho đa số để
  phục vụ thiểu số.
- **`role` chỉ có tác dụng khi tạo tài khoản mới.** Tài khoản đã tồn tại giữ nguyên vai trò cũ, nên
  KTV đăng nhập nhầm ở cửa khách vẫn về `/dashboard` — form điều hướng theo vai trò **thật** trả về
  từ server, không theo cửa vừa bước vào. Đã kiểm chứng cả hai chiều.
- **Route session lọc `role` bằng danh sách trắng.** Thân request đến từ trình duyệt và `role`
  quyết định quyền của tài khoản mới; backend cũng chặn ADMIN nhưng để một giá trị lạ đi tới đó là
  đã thừa một lớp.
- **`/dashboard` phân biệt "chưa đăng nhập" với "đã đăng nhập nhưng là khách".** Tài khoản CUSTOMER
  nhận 403 ở `/wallet/balance`, mà code cũ dịch mọi 403 thành redirect về trang đăng nhập — khách
  đăng nhập lại thành công rồi bị đá tiếp, thành vòng lặp không lối thoát. Nay hiện màn hình giải
  thích kèm hai lối ra. `getSessionRole()` đọc payload JWT **không kiểm chữ ký** nên chỉ được dùng
  để điều hướng, không bao giờ để cấp quyền.

`?next=` trên `/dang-nhap` chỉ nhận đường dẫn nội bộ (`safeNext`), chặn cả `//host` vì trình duyệt
hiểu nó là URL tuyệt đối — nhận nguyên trạng là mở open redirect ngay trên trang đăng nhập thật.

**Form viết đánh giá trên trang hồ sơ** (2026-09-04, `ReviewForm`) — đích đến thật cho tài khoản
khách, vốn trước đó đăng nhập xong không dùng được vào việc gì. Ba điều đừng đảo ngược:

- **Trạng thái đăng nhập phải hỏi ở client, không render sẵn.** Trang hồ sơ là ISR 600 giây, tức
  một bản HTML phục vụ mọi người xem; nướng "đã đăng nhập hay chưa" vào đó là hoặc phát phiên của
  người này cho người khác, hoặc phải bỏ cache trên chính trang sống nhờ SEO. `GET /api/auth/session`
  trả đúng `{authenticated, role}` kèm `Cache-Control: no-store` và **không** trả gì định danh được
  người dùng — form chỉ cần biết nên hiện ô nhập hay lời mời đăng nhập.
- **Gửi đánh giá phải kèm `revalidatePath`, không chỉ `router.refresh()`.** Đây là lỗi đã đo được
  chứ không phải đề phòng: `refresh()` chạy lại server component nhưng lời gọi lấy danh sách đánh
  giá bên dưới vẫn cache 600 giây, nên đánh giá vừa viết **không hiện ra**. Người viết tưởng hỏng,
  viết lại, và lần này nhận 409 "bạn đã đánh giá rồi" — đọc như hệ thống tự mâu thuẫn. Vì
  `revalidatePath` chỉ gọi được từ server nên form đi qua route riêng `/api/reviews` thay vì
  `/api/proxy`, và route đó chỉ xoá cache khi backend đã nhận thật.
- **Form nằm dưới danh sách đánh giá, trong cùng section.** Người vừa đọc đánh giá của người khác
  là người sẵn sàng viết nhất, và vị trí đó nằm ngoài màn hình đầu tiên nên việc nó xuất hiện muộn
  (sau khi hỏi phiên) không gây nhảy bố cục dưới mắt ai.

**Trang tài khoản khách `/tai-khoan`** (2026-09-04) + `GET /me/reviews`. Ba điều đừng đảo ngược:

- **Nằm trong `(public)` chứ không phải `/dashboard`.** Khách không có sidebar riêng và vẫn đang
  trong luồng duyệt site — vào từ header rồi quay ra tìm tiếp. KTV mở `/tai-khoan` bị đưa về
  `/dashboard`: họ đã có màn làm việc đầy đủ hơn hẳn.
- **`/me/reviews` trả về **mọi** trạng thái, khác endpoint công khai.** Người viết phải thấy đánh
  giá của mình đang bị gỡ và lý do; nếu không nó chỉ biến mất khỏi trang hồ sơ, họ viết lại, rồi
  nhận 409 vì ràng buộc một-tài-khoản-một-KTV. Endpoint lấy id người dùng **từ token**, không nhận
  tham số — một id trên query string là đường đọc đánh giá của người khác.
- **Link "Đăng nhập/Tài khoản" trên header là client component** (`AccountNavLink`). Gọi `cookies()`
  trong `PublicShell` sẽ ép **mọi** trang dưới nhóm `(public)` thành dynamic — đánh đổi ISR của
  những trang sống nhờ SEO lấy một chữ trên thanh điều hướng.

Lịch sử liên hệ cố ý **chưa** đưa vào trang này: `leads` ghi cả lượt bấm của khách chưa đăng nhập,
nên phần lớn lịch sử của một người sẽ không có trong đó — một danh sách khuyết quá nửa còn khó hiểu
hơn là không có.

**Nền cho chống đánh giá giả** (2026-09-04). Đo trước khi làm: **0/6** đánh giá khớp được với một
lead, và nguyên nhân là một lỗ có sẵn — `ContactButtons` gọi thẳng `POST /leads` sang origin backend
**không kèm token**, mà token nằm trong cookie httpOnly của origin Next nên không đi kèm request
cross-origin. Hệ quả: **mọi** lead đều ẩn danh, kể cả của khách vừa đăng nhập, và quy tắc "chỉ ai
từng liên hệ mới được đánh giá" ở Phase 4 không thể thực thi. Bốn điều đừng đảo ngược:

- **Hai đường ghi lead, chọn theo trạng thái đăng nhập.** Khách đã đăng nhập đi qua `/api/leads` của
  Next (gắn được `customer_user_id`); khách ẩn danh nhận 401 rồi **rơi về gọi thẳng backend**, vì chỉ
  đường đó mới mang đúng IP để cơ chế gộp lead trùng 5 phút còn ý nghĩa. Với khách đã đăng nhập thì
  IP không còn quan trọng: `ComputeDeviceHash` đã lấy `userId` làm thành phần đầu của khoá gộp.
- **Đánh giá không có lead vẫn được đăng.** Phần lớn khách bấm gọi *trước* khi đăng nhập nên lead lúc
  đó ẩn danh và không bao giờ khớp; chặn họ là cắt mất gần hết nguồn đánh giá thật, trong khi rating
  chính là thứ Google đọc. `lead_id` chỉ **ghi nhận** mối liên hệ khi nó tồn tại.
- **`hasLead` là dấu hiệu, không phải bằng chứng.** `true` đáng tin (người này thật sự đã liên hệ);
  `false` chưa kết luận được gì. Đừng biến nó thành điều kiện tự động gỡ đánh giá.
- **`GET /admin/reviews` là đường *tìm* đánh giá đáng gỡ.** Trước đây chỉ có `PATCH .../moderate` để
  gỡ, nên kiểm duyệt chỉ chạy khi có người báo cáo. Hàng đợi xếp: chưa gắn lead → tài khoản viết càng
  mới càng lên trước (tài khoản lập xong đánh giá ngay là hình dạng của việc bơm sao) → mới nhất.

**`ƒ (Dynamic)` trong output của `next build` KHÔNG có nghĩa là mất cache** (đo ngày 2026-09-04).
Các trang SEO — `/`, `/ktv/{slugId}`, `/massage-tan-noi/*`, `/dich-vu/{slug}` — đều hiện `ƒ` chứ
không phải `○`, và điều đó **đúng như thiết kế**, không phải lỗi:

- Chữ `ƒ` chỉ nói "không prerender lúc build". Trang chủ khai `force-dynamic` tường minh để **build
  không phụ thuộc vào một API đang chạy** — nếu không, CI phải dựng cả stack chỉ để đóng gói
  frontend. Ba trang còn lại là route động không có `generateStaticParams`, nên Next cũng không thể
  dựng sẵn danh sách đường dẫn lúc build.
- **Cache fetch vẫn sống nguyên**, kể cả dưới `force-dynamic`: `next: { revalidate }` trong
  `lib/api.ts` là thứ quyết định, và nó độc lập với việc trang có được prerender hay không. Đo bằng
  `pg_stat_user_tables`: 10 lần tải trang chủ → **0** lần chạm DB; 3 lần tải trang hồ sơ → **1** lần.
- Chi phí render HTML mỗi request là không đáng kể: trang `ƒ` mất ~25–45ms, trang tĩnh thật `○`
  (`/dang-ky-ktv`) mất ~20–45ms — không phân biệt được.
- Nội dung SEO vẫn nằm đủ trong HTML thô: `ProfessionalService` + `AggregateRating` ở trang hồ sơ,
  `BreadcrumbList` ở trang khu vực, `canonical` ở cả ba.

Đừng "sửa" bằng cách thêm `generateStaticParams` để đổi `ƒ` thành `○`: nó buộc build phải gọi API
liệt kê toàn bộ KTV và 696 quận/huyện, đánh đổi tính độc lập của CI lấy một chữ cái trong bảng
output mà số đo cho thấy không mua được gì thêm.

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

**Analytics partition theo tháng đã chạy** (2026-09-03, `analytics_events`, xem `Modules/Analytics/`).
Ba loại sự kiện dựng thành phễu IMPRESSION → VIEW → LEAD, là bằng chứng để KTV quyết định có gia hạn
gói đẩy tin hay không. Năm điều đừng đảo ngược:

- **Impression ghi qua hàng đợi trong bộ nhớ, KHÔNG chạm DB trong request.** Một lượt `/search` trả
  20 KTV là 20 dòng; ghi thẳng sẽ biến truy vấn 29ms thành 21 lần đi DB — đo hiệu quả quảng cáo mà
  làm hỏng chính đường đọc đang được quảng cáo. Đã đo sau khi nối: `/search` vẫn 28,6ms.
- **Hàng đầy thì bỏ sự kiện, không chặn** (`BoundedChannelFullMode.DropWrite`). Chặn để giữ một dòng
  thống kê là biến sự cố ghi analytics thành sự cố ngừng phục vụ khách. Số dòng bỏ được gom lại rồi
  log theo lô, không log từng dòng — hàng đầy nghĩa là đang quá tải, log mỗi dòng là thêm một cơn bão.
- **PRIMARY KEY là `(id, created_at)`, không phải `id`.** Bảng partition không ép được tính duy nhất
  nếu khoá không chứa cột phân mảnh — `PRIMARY KEY (id)` trần bị Postgres từ chối thẳng.
- **Không có khoá ngoại tới `ktv_profiles`** (khác `leads`). Khoá ngoại từ bảng partition phải khai
  lại ở **từng** partition, nên job tạo partition hằng tháng sẽ phải nhớ điều đó mãi mãi — quên một
  tháng là mất ràng buộc trong im lặng. Đổi lại `RecordViewAsync` tự kiểm KTV có tồn tại.
- **`leads` vẫn là nguồn của con số lead trên dashboard**, không đọc từ analytics. Đó là con số đem
  tính tiền nên phải lấy từ nguồn không bao giờ bị dọn và không bao giờ bị bỏ khi hàng đợi đầy. Dòng
  LEAD trong analytics chỉ để dựng phễu, và chỉ ghi khi lead **không** bị gộp.

Job `analytics:partitions` (2 giờ sáng hằng ngày) tạo trước 3 tháng, bỏ partition quá 6 tháng bằng
`DETACH CONCURRENTLY` rồi `DROP` (drop thẳng cần khoá ACCESS EXCLUSIVE trên bảng cha, tức chặn mọi
lượt ghi). Chạy **hằng ngày** dù việc chỉ có nghĩa mỗi tháng một lần: lỡ một job tháng là hỏng nguyên
tháng. Job **ném lỗi** khi `analytics_events_default` có dữ liệu — hàng nằm ở đó nghĩa là đã có lúc
thiếu partition, và chúng **chặn** việc tạo partition cho chính tháng chúng thuộc về, nên lỗi tự khoá
lại và càng để lâu càng khó gỡ. Job không tự dọn: dọn tức là xoá số liệu thật.

**Ảnh hồ sơ KTV và Cloudflare R2 đã chạy** (2026-09-04, `Common/Storage/` + bảng `ktv_photos`).
Ba loại file, **hai chế độ truy cập khác nhau**: `avatars/` và `photos/` công khai (nằm trên
card tìm kiếm và trang SEO, phải cache được ở CDN), còn `certifications/` riêng tư — nó là ảnh
chụp giấy tờ tuỳ thân. Hướng dẫn dựng bucket: [docs/cloudflare-r2-setup.md](docs/cloudflare-r2-setup.md).
Bảy điều đừng đảo ngược:

- **DB lưu key, không lưu URL.** `ktv_profiles.avatar_key`, `ktv_photos.storage_key`, và
  `certifications.file_url` (giữ tên cột cũ, đổi nội dung) đều chứa đường dẫn tương đối trong
  bucket. Lưu URL đầy đủ thì đổi bucket, đổi custom domain hay đổi nhà cung cấp đều thành một
  lượt backfill toàn bảng, và những hàng chưa kịp sửa trỏ tới host đã chết. URL dựng lúc đọc,
  ở đúng một chỗ (`MediaUrls`).
- **Chứng chỉ chỉ ra ngoài bằng URL ký hạn 15 phút.** Đây là **lỗ hổng đã sửa**, không phải
  tính năng mới: `/uploads` trước đây được `UseStaticFiles` phục vụ công khai, nên ai đoán được
  tên file đều tải được giấy tờ tuỳ thân của KTV. Custom domain của R2 phục vụ mọi key trong
  bucket, nên phải có WAF rule chặn `certifications/` — xem tài liệu.
- **Adapter chọn theo credential, không theo tên môi trường.** Có `R2:AccessKeyId` thì dùng R2,
  không thì `LocalObjectStorage`. Một cờ `UseR2=true` riêng sẽ có lúc bật mà thiếu key, và lúc
  đó app khởi động bình thường rồi mới hỏng ở lượt upload đầu tiên — tức hỏng trên tay KTV thật
  chứ không phải lúc deploy. Thiếu `R2:PublicBaseUrl` khi đã có key thì app **từ chối khởi
  động**: cùng lý do với `Jwt:Secret`.
- **Ảnh gallery có trạng thái duyệt riêng, ảnh đại diện thì không.** Hồ sơ đã VERIFIED vẫn thêm
  ảnh mới bất cứ lúc nào, nên đi theo trạng thái hồ sơ nghĩa là mở một khe đăng nội dung không
  ai xem trên trang công khai của đúng ngành Google phạt nặng nhất khi phân loại nhầm — và hình
  phạt rơi lên cả tên miền. Avatar thì hiện ngay: nó nằm trong tầm mắt admin ở chính trang duyệt
  hồ sơ, và bắt hồ sơ mới chờ mới có mặt là chặn đúng nhóm cần được nhìn thấy nhất.
- **Hàng đợi duyệt ảnh là trang riêng** (`/admin/duyet-anh`), không nhét vào trang duyệt hồ sơ.
  Danh sách kia lọc theo trạng thái **hồ sơ**, nên ảnh mới của một hồ sơ đã duyệt sẽ không xuất
  hiện ở đâu cả.
- **Xoá file khỏi storage phải sau khi DB commit**, nên service trả key cũ ra cho controller
  dọn thay vì tự xoá. Đảo lại thì một lỗi lưu DB để hồ sơ trỏ tới file vừa bị xoá — ảnh vỡ trên
  trang công khai, không lấy lại được. Ngược lại, vượt hạn mức ảnh thì **file đã lên storage rồi**
  (kiểm hạn mức trước không chặn được hai lượt song song), nên controller xoá nó trong `catch` —
  không thì mỗi lần chạm trần lại bỏ lại một file không ai tham chiếu.
- **Đổi ảnh phải đi qua `/api/ktv-media`, không phải `/api/proxy`.** Cùng cái bẫy `revalidatePath`
  mà `/api/reviews` đã ghi lại: trang hồ sơ là ISR 600 giây, nên đổi ảnh đại diện xong mà không
  xoá cache thì chính KTV mở trang mình vẫn thấy ảnh cũ và tưởng lượt tải lên đã hỏng. Ảnh gallery
  thì **không** xoá cache — nó vào hàng chờ duyệt nên trang công khai chưa đổi gì.

**Năm cái bẫy đã cắn khi bật R2 thật** (2026-09-05) — cả năm đều im lặng, và bốn cái đầu đọc
như lỗi quyền của Cloudflare chứ không như lỗi code:

- **`services.Configure<R2Options>()` phải được gọi.** `StorageSetup` đọc cấu hình cục bộ để
  *chọn* adapter, nhưng nếu quên bind vào DI thì `R2ObjectStorage` nhận bản mặc định — `Bucket`
  thành `"massage-platform"` thay vì bucket thật, và R2 trả **"Access Denied"**. Tốn cả một vòng
  đi kiểm token Cloudflare trước khi nhìn ra.
- **`UseChunkEncoding = false` trên từng request.** AWS SDK từ 3.7.402 ký theo luồng
  (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD`), thứ R2 trả thẳng "not implemented". Cờ này nằm ở
  **request**, không có trên `AmazonS3Config`.
- **`DisablePayloadSigning` thì KHÔNG dùng.** Nó đổi chữ ký sang UNSIGNED-PAYLOAD và R2 trả
  "Access Denied" — trông hệt lỗi quyền.
- **`docker compose build` có thể trả "Built" trong khi publish đã fail**, và container tiếp tục
  chạy image cũ. Kiểm bằng `stat -c %y /app/Massage.Api.dll` trong container, đừng tin dòng
  "Built"; `--no-cache` là cách thấy lỗi biên dịch thật.
- **`NEXT_PUBLIC_MEDIA_BASE_URL` phải là build arg trong Dockerfile**, không chỉ là biến lúc
  chạy: `next.config.mjs` dựng `images.remotePatterns` từ nó và Next chốt danh sách đó vào bản
  build. Thiếu thì mọi ảnh nhận `"url" parameter is not allowed` (400) trong khi trang vẫn 200,
  nên lỗi chỉ lộ ra khi có người nhìn đúng tấm ảnh. Cũng vì vậy đổi origin ảnh phải
  `docker compose up -d --build web`, restart không đủ.

`remotePatterns` khai **một entry cho mỗi tiền tố** (`/avatars/**`, `/photos/**`), không gộp
bằng brace (`/{avatars,photos}/**`): picomatch hiểu cú pháp đó nhưng Next khớp bằng đường khác
và từ chối thẳng. Và không mở `/**` — thế thì `certifications/` cũng đi qua được trình tối ưu ảnh.

**`tools/verify-r2.sh` là cách duy nhất biết R2 có thật sự chạy không**, vì app không báo lỗi
khi thiếu cấu hình — nó lặng lẽ dùng đĩa local. Script upload thật, kiểm file rơi vào đâu, và
kiểm luôn chứng chỉ có bị lộ công khai không.

**Public Development URL (`r2.dev`) không đặt WAF rule được** — nó không thuộc zone nào của tài
khoản. Hệ quả: khi còn dùng nó, `certifications/` **tải được công khai** bởi ai có key (đã đo,
200). Key là GUID nên khó đoán, nhưng đó là "khó đoán", không phải "được bảo vệ" — đừng tải lên
chứng chỉ thật cho tới khi nối custom domain và thêm WAF rule.

**CCCD và cam kết KTV là hai điều kiện bắt buộc để duyệt hồ sơ** (2026-09-05, bảng
`ktv_identity_documents` + ba cột `commitment_*` trên `ktv_profiles`). Cả hai ràng buộc nằm ở
`AdminService.DecideProfileAsync`, không phải chỉ là cảnh báo trên giao diện admin. Bảy điều đừng
đảo ngược:

- **CCCD là bảng riêng, một hàng mỗi KTV** (`UNIQUE (ktv_id)`), không nhét vào `certifications`.
  Chứng chỉ là danh sách nhiều-và-tuỳ-chọn; CCCD là một-đối-một và bắt buộc. Hai mặt nằm **chung
  một hàng** nên luôn được duyệt cùng nhau — duyệt riêng từng mặt là để lọt việc ghép mặt trước
  của thẻ này với mặt sau của thẻ khác. CHECK `chk_identity_doc_two_sides` chặn việc gửi cùng một
  ảnh cho cả hai ô, lỗi thao tác lọt qua mọi kiểm tra khác vì cả hai đều là key hợp lệ.
- **Cố ý KHÔNG lưu số CCCD và tên trên thẻ.** Admin đọc trên ảnh lúc duyệt, và chưa có nghiệp vụ
  nào truy vấn theo số. Không lưu thì không lộ được — đây là định danh cấp quốc gia, rò rỉ một lần
  là không thu hồi. Cần chặn một người mở nhiều hồ sơ thì thêm cột hash có muối, đừng thêm số thô.
- **Gửi lại CCCD luôn đưa trạng thái về PENDING** và ghi đè ảnh cũ. Giữ nguyên VERIFIED khi ảnh đã
  đổi là để hồ sơ đã duyệt thay thẻ khác vào mà không ai nhìn lại — đúng cái lỗ mà việc bắt buộc
  CCCD sinh ra để bịt. `submitted_at` tách khỏi `created_at` vì hàng bị ghi đè tại chỗ: xếp hàng
  đợi theo `created_at` thì người bị từ chối rồi gửi lại nằm nguyên chỗ cũ và không bao giờ được
  xem lại.
- **Nội dung cam kết nằm ở backend** (`KtvCommitments`), frontend chỉ render. Đây là tài liệu pháp
  lý: khi tranh chấp, thứ cần chứng minh là "đã đồng ý với đúng những dòng này" — danh sách nằm
  trong JSX thì bản đã ký không tái dựng được. **Sửa nội dung phải tăng `CurrentVersion`**, nếu
  không hồ sơ cũ sẽ trông như đã đồng ý với điều họ chưa từng đọc.
- **Lưu số phiên bản + thời điểm + IP, không phải một cờ boolean.** "Đã tick" mà không biết tick
  vào bản nào thì vô dụng đúng lúc cần tới nó nhất. Client gửi **số phiên bản mình vừa đọc** và
  backend từ chối khi lệch — tab mở từ trước lúc cập nhật sẽ không ghi nhận nhầm.
- **Không backfill hồ sơ cũ thành đã cam kết** (mặc định 0). Chúng chưa từng thấy bản cam kết nào,
  và tự gán là tạo bằng chứng giả cho chính mình. Hệ quả có chủ ý: hồ sơ cũ phải xác nhận lại.
- **Chỉ chặn chiều sang VERIFIED.** Từ chối hay gỡ hồ sơ không cần điều kiện nào — chặn ở đó sẽ
  khoá đúng đường gỡ những hồ sơ đáng ngờ nhất.

`identity/` là **prefix riêng tư thứ hai**, cùng luật với `certifications/`: DB lưu key, ra ngoài
bằng URL ký 15 phút. Hai chỗ phải nhớ điều đó và cả hai từng là lỗi im lặng — `LocalObjectStorage.
SignedUrl` chọn endpoint **theo tiền tố key** (trả nhầm endpoint chứng chỉ thì đường CCCD tra nhầm
bảng và luôn 404), và `lib/media.ts` phải khớp cả hai đường file riêng tư khi vòng qua proxy. WAF
rule trên custom domain cũng khai **từng tiền tố một** — thêm loại giấy tờ mới mà quên sửa rule thì
không có gì báo lỗi, file vẫn lưu đúng, chỉ là ai có key đều tải được. `tools/verify-r2.sh` nay
kiểm cả hai prefix; thêm loại thứ ba thì thêm vào đó luôn.

Đã đo ngày 2026-09-05: vì còn dùng `r2.dev` (không đặt WAF rule được), **cả `certifications/` lẫn
`identity/` đang tải được công khai bởi ai có key** — script báo đỏ đúng hai chỗ đó. Đừng tải lên
CCCD thật cho tới khi nối custom domain và thêm WAF rule.

**Cộng tác viên và mã giới thiệu** (2026-09-05, `Modules/Collaborators` + bảng `collaborators`,
hai cột `referred_by_collaborator_id`/`referred_at` trên `ktv_profiles`). KTV điền mã lúc **tạo**
hồ sơ; CTV do admin tạo ở `/admin/cong-tac-vien`. Bảy điều đừng đảo ngược:

- **Bảng riêng, không phải chuỗi tự do trên hồ sơ.** Mã là cơ sở trả hoa hồng nên nó phải trỏ tới
  người có thật: gõ sai một chữ thì báo lỗi ngay lúc tạo hồ sơ, thay vì lưu êm một chuỗi không ai
  sở hữu rồi chỉ vỡ ra lúc đối soát. Nó cũng cho phép đếm bằng join, thay vì gộp theo chuỗi nơi
  `AN01` và `an01` thành hai người.
- **`ktv_profiles` giữ khoá ngoại, không giữ chuỗi mã.** Mã đổi được, "ai mang người này về" thì
  không — lưu chuỗi thì mọi hồ sơ cũ mất dấu ngay khi mã được sửa.
- **Mã chốt lúc tạo.** `CreateKtvProfileDto` có `ReferralCode`, `UpdateKtvProfileDto` **không** —
  để KTV tự đổi là mở đường cho một CTV đổi mã của mình vào hồ sơ người khác mang về. Form ẩn hẳn
  ô nhập ở trang sửa; có test canh cả hai chiều.
- **Tuỳ chọn, không bắt buộc.** SEO là nguồn chính và đa số KTV không có mã nào; bắt buộc sẽ chặn
  đúng nhóm đến miễn phí, hoặc đẩy họ đi gõ bừa một mã cho qua.
- **Chuẩn hoá mã ở đúng một chỗ** (`Collaborator.NormalizeCode`, chữ hoa + trim) và **dùng chung
  cho cả đường ghi lẫn đường đọc**. Chuẩn hoá một vế thôi thì mã lưu được nhưng không bao giờ tra
  ra — hỏng im lặng vì cả hai thao tác đều báo thành công.
- **`ON DELETE RESTRICT`, khác `CASCADE` của ảnh/chứng chỉ.** Xoá CTV đang có hồ sơ phải *thất bại*
  chứ không được lặng lẽ gỡ liên kết — đó là xoá cơ sở tính hoa hồng của những lượt hợp lệ. Ngừng
  hợp tác thì `status='DISABLED'`: mã hết dùng cho hồ sơ mới, lịch sử nguyên vẹn.
- **`GET /referral-codes/{code}` nằm ở controller riêng.** Đây là lỗi thật đã bị test bắt:
  `CollaboratorController` khai `[Authorize(Roles = ADMIN)]` ở cấp class, và một `[Authorize]` ở
  cấp method **không nới rộng** được ràng buộc đó — mọi filter đều phải qua, nên form đăng ký của
  KTV nhận 403 và không bao giờ kiểm được mã. Endpoint này cũng chỉ trả **tên** CTV, không trả số
  điện thoại: ai đoán trúng mã cũng gọi được, nên nó không được thành đường rò thông tin liên hệ.

Index `idx_ktv_referred_by` là **partial** (`WHERE ... IS NOT NULL`) nên chỉ khai trong migration —
EF không mô hình hoá được mệnh đề `WHERE`, khai index đầy đủ trong `OnModelCreating` sẽ làm mọi lần
`migrations add` sau sinh diff rác. Cùng lý do với `uq_area_root_slug`.

Chưa làm, và cố ý: **tính và trả hoa hồng**. Đó là module chạm tiền nên phải đi theo kiến trúc
Hexagonal (xem `architecture-modules.md`) chứ không nối thêm vào module CRUD phẳng này. Hiện chỉ
mới ghi nhận *ai giới thiệu ai* — `verifiedCount` là con số đáng dùng làm cơ sở, không phải
`referredCount`, vì hồ sơ tạo ra rồi không bao giờ qua duyệt thì chưa mang lại gì cho sàn.

**Báo cáo vi phạm đã chạy** (2026-09-04, `Modules/Reports` + bảng `profile_reports`). Roadmap xếp
việc này vào "cần chuẩn bị từ Phase 1, không đợi Phase 4" vì nó chạm đúng hai trụ cột của dự án:
pháp lý, và kênh acquisition chính — Google hạ hạng mạnh tên miền bị phân loại là nội dung người
lớn. Bốn điều đừng đảo ngược:

- **Báo cáo không tự ẩn hồ sơ.** Một nút ẩn được bằng vài lần bấm là vũ khí để KTV đối thủ hạ nhau,
  và hồ sơ bị ẩn oan là doanh thu mất thật. Việc gỡ hồ sơ đi qua đúng đường duyệt hồ sơ đã có
  (`PATCH /admin/ktv/{id}/verify`), nơi đã ghi sẵn ai quyết định và vì sao — nhân bản logic đó vào
  module Reports sẽ tạo ra hai đường đổi trạng thái hồ sơ phải giữ cho khớp nhau mãi mãi.
- **Hàng đợi xếp theo số báo cáo còn chờ của hồ sơ, không theo thời gian.** Một hồ sơ bị hai mươi
  người báo cáo khác hẳn về mức độ so với hai mươi hồ sơ mỗi cái một báo cáo, mà danh sách phẳng
  theo thời gian thì hai trường hợp trông giống hệt nhau. Con số đó đếm bằng subquery tương quan:
  EF **không dịch được** left-join tới `GroupBy`, và bản viết bằng join chỉ nổ lúc chạy.
- **Nhận báo cáo cho mọi hồ sơ tồn tại, không chỉ hồ sơ đã duyệt** (khác `leads`). Hồ sơ vừa bị gỡ
  xuống PENDING vì nghi vấn chính là hồ sơ cần thêm bằng chứng nhất.
- **`POST /reports` gọi thẳng từ trình duyệt như `/leads`**, nên nằm trong danh sách CORS. Cửa sổ
  gộp là 24 giờ theo thiết bị — rộng hơn hẳn lead (5 phút) vì người báo cáo lại cùng hồ sơ sau mười
  phút gần như chắc chắn vẫn đang nói về đúng chuyện đó, và để một người tự bơm số báo cáo lên là
  làm hỏng chính thước đo mức độ nghiêm trọng ở gạch đầu dòng trên.

Phần Phase 3 còn lại: job delayed `promotion:expire` và Redis read-path — cả hai chỉ trở nên bắt
buộc khi đường đọc chuyển sang Redis, mà số đo hiện tại (`/search` 28,6ms ở 5.000 hồ sơ) chưa đòi
hỏi điều đó. `promotion:activate` và `instant-boost:golden-hour` trong roadmap gốc **không còn cần**:
campaign ACTIVE ngay trong transaction mua và search đọc thẳng Postgres, nên độ trễ hiệu lực đã bằng
0 mà không cần job nào. Chi tiết ở
[blueprint](https://claude.ai/code/artifact/a6b39c02-9ed5-4b79-abb1-d7bf68c0c6c0) — đã cập nhật
theo stack .NET; khi kiến trúc đổi, cập nhật lại artifact đó thay vì tạo bản mới.

**Đổi tên dịch vụ "massage tại nhà" → "massage tận nơi" và slug URL** (2026-09-06). Kèm theo
đó, tên sàn tách khỏi cụm từ khoá: `SITE_NAME` nay là **MasGo** ở cả hai ngôn ngữ, khớp domain
masgo.vn. Sáu điều đừng vô tình đảo ngược:

- **`/massage-tai-nha/*` phải 301 vĩnh viễn về `/massage-tan-noi/*`, mãi mãi.** ~760 URL cũ đã
  được index và đó là kênh acquisition chính; gỡ luật redirect trong `next.config.mjs` là vứt
  toàn bộ link equity đã tích. Luật khai **hai vế** — có prefix `/en` và không — vì redirect của
  `next.config` chạy **trước** middleware, nên `/en/massage-tai-nha/...` không tự khớp luật
  không prefix. Thiếu vế thứ hai thì hỏng đúng một nửa, và là nửa ít người mở nên lâu mới lộ.
- **`permanent: true` phát ra 308, không phải 301.** Google xử lý 308 y hệt 301 cho việc index,
  nên đây không phải lỗi — nhưng ai `curl -I` đi tìm chữ "301" sẽ tưởng sai và "sửa" thành
  redirect tạm, tức giữ URL cũ trong index vô thời hạn.
- **Tiền tố URL khai đúng một lần mỗi phía**: `AREA_PATH_PREFIX` (`lib/site.ts`) và
  `SitemapController.AreaPathPrefix`. Hai hằng này phải đổi cùng lúc — sitemap khai URL đang bị
  redirect nghĩa là tự bảo Google đi qua một hop rồi mới tới đích, trong khi canonical trên
  trang lại trỏ thẳng: hai lời khai mâu thuẫn về cùng một trang.
- **Tên sàn không còn là cụm từ khoá.** Trước đây `SITE_NAME` chính là "Massage tại nhà", nên
  template title dựng ra "Massage tận nơi Quận 7 | Massage tận nơi" — lặp từ khoá mà không thêm
  thông tin, và không để lại cái tên nào cho khách nhớ. Từ khoá đã nằm ở vế trái của title; vế
  phải giờ là thứ phân biệt sàn này với sàn khác trong cùng trang kết quả.
- **`common.siteName` trong `i18n/*.ts` đã xoá, không phải bỏ sót.** Không nơi nào đọc nó —
  mọi chỗ dùng `SITE_NAME` từ `lib/site.ts`. Thêm lại là dựng nguồn sự thật thứ hai cho tên sàn,
  và bản lệch sẽ chỉ lộ ra ở đúng trang nào lỡ dùng nhầm key.
- **`NEXT_PUBLIC_SITE_URL` ở `docker-compose.yml` và `.env.example` vẫn là localhost, cố ý.**
  Biến này đi thẳng vào canonical, hreflang và `og:url`; đặt domain thật ở stack dev thì mọi
  trang chạy trên máy dev tự khai canonical trỏ về production. Domain thật khai bằng
  `SITE_URL=https://masgo.vn` ở môi trường deploy. Mặc định trong code (`site.ts`) là
  `https://masgo.vn` để bản deploy quên khai biến vẫn không rơi về localhost.
- **`NEXT_PUBLIC_SITE_URL` phải là build arg, KHÔNG chỉ là biến lúc chạy** — bẫy thứ hai cùng
  hình dạng với `NEXT_PUBLIC_MEDIA_BASE_URL`, phát hiện khi audit lần này. `app/robots.ts` là
  route **tĩnh**: Next đánh giá nó một lần lúc build rồi ghi thẳng ra file, trong khi
  `sitemap.xml` là route **động** và đọc env lúc chạy. Khai thiếu vế build thì `robots.txt` giữ
  host lúc build còn sitemap dùng host lúc chạy — hai file mà Googlebot luôn đọc cùng nhau lại
  khai hai host khác nhau, dòng `Sitemap:` trỏ sang host khác với chính các `<loc>` bên trong,
  và Google bỏ qua sitemap đó. Cả hai file vẫn trả 200 và trông hợp lệ khi mở riêng lẻ. Vì vậy
  đổi domain phải `docker compose up -d --build web`, restart không đủ. Đã kiểm chứng cả hai
  cấu hình: dev cho localhost ở cả robots/sitemap/canonical, `SITE_URL=https://masgo.vn` cho
  masgo.vn ở cả ba.

Chuỗi "massage tại nhà" **còn lại đúng ba chỗ và cả ba đều đúng**: comment lịch sử trong
`site.ts`, alt text `HomeHeroMedia` (mô tả bối cảnh thật — trị liệu tận nơi *tại nhà khách*), và
`ServiceSeeder` mô tả nơi diễn ra dịch vụ. Các dòng trong docs nói "người tìm *massage tại nhà
Quận 7*" cũng giữ nguyên: đó là hành vi tìm kiếm có thật trên Google, không đổi theo cách sàn tự
gọi tên dịch vụ. Migration `20260903015608_AreasNationwide.cs` giữ nguyên chữ cũ vì migration đã
áp là lịch sử, không sửa lại.

**Đăng nhập gửi OTP qua Zalo ZNS** (2026-09-05, `Modules/Auth/Sms/` + bảng `zalo_tokens`).
Thay chỗ cắm bỏ ngỏ từ Phase 0. Hướng dẫn lấy credential: [docs/zalo-zns-setup.md](docs/zalo-zns-setup.md).
Bảy điều đừng vô tình đảo ngược:

- **Việc gửi đứng TRƯỚC khi ghi DB.** Vô hiệu mã cũ rồi mới phát hiện không gửi được nghĩa là
  người dùng vừa mất mã đang cầm trên tay để đổi lấy một mã không bao giờ tới — với người bấm
  "gửi lại" vì tin đến chậm, đó là biến một phiền toái thành đăng nhập hỏng hẳn. Đánh đổi đã
  cân nhắc: gửi xong mà lưu DB hỏng thì mã tới nơi nhưng không xác thực được, hiếm hơn nhiều và
  người dùng chỉ cần bấm gửi lại. Đã kiểm chứng bằng cách đảo ngược thứ tự — 2 test đỏ.
- **`debugCode` suy ra từ adapter (`IOtpSender.RevealsCode`), không từ cờ cấu hình.** Trước đây
  `OtpService` tự đọc `Otp:StubEnabled`, nên vẫn còn tổ hợp cấu hình vừa gửi tin thật vừa trả mã
  ra response. Nay tổ hợp đó không tồn tại được: chỉ `StubOtpSender` khai `RevealsCode = true`.
- **Stub thắng ZNS khi cả hai cùng có.** Máy dev có `.env` thật mà không có luật này sẽ gửi tin
  tới số thật và đốt quota — im lặng, vì lượt gửi vẫn thành công.
- **Thiếu cấu hình KHÔNG chặn app khởi động** (khác `Jwt:Secret`). Thiếu nhà cung cấp chỉ làm
  hỏng đường đăng nhập; chặn cả app là biến một tính năng hỏng thành toàn bộ sàn ngừng phục vụ,
  kể cả các trang SEO vốn không cần đăng nhập. Lỗi nổ ở lượt xin mã đầu tiên, kèm log rõ nguyên nhân.
- **ZNS trả HTTP 200 cho cả lượt THẤT BẠI** — chỉ trường `error` trong body mới nói thật. Đọc
  status code là đủ để tin rằng mọi tin đều gửi được trong khi không tin nào tới nơi. Cùng loại
  bẫy với `docker compose build` báo "Built" khi publish đã fail.
- **Số điện thoại phải đổi sang `84xxxxxxxxx`** (`ToZaloPhone`). Hệ thống lưu `0xxxxxxxxx`; gửi
  thẳng thì ZNS trả lỗi tham số, và lỗi đó đọc như lỗi quyền.
- **`OtpDeliveryException` → 503, và message KHÔNG ra client.** `AppExceptionHandler` trả
  `ex.Message` ra ngoài cho mọi status khác 500, còn message ở đây nêu đích danh khoá cấu hình
  còn thiếu (`Zalo:Zns:*`). Log giữ đủ chi tiết; client nhận một câu chung. Route `/api/auth/otp`
  của Next cũng chỉ chuyển tiếp **status**, không chuyển tiếp câu chữ — message backend vẫn chỉ
  có tiếng Việt, đẩy ra là để một câu tiếng Việt hiện giữa giao diện tiếng Anh.

**Refresh token của Zalo bị xoay mỗi lần dùng**, nên nó nằm ở bảng `zalo_tokens` chứ không phải
trong file cấu hình — Zalo cấp bản mới và vô hiệu bản cũ trong cùng lượt refresh. Giá trị trong
cấu hình chỉ là **hạt giống cho lần chạy đầu tiên**. Giữ trong bộ nhớ thì restart container là
mất bản mới và bản trong cấu hình lúc đó đã chết: OA ngừng gửi được cho tới khi có người vào Zalo
lấy tay token khác. `InvalidateAsync` chỉ đẩy hạn về quá khứ, **không xoá hàng** — refresh token
trong đó là thứ duy nhất còn dùng được, xoá đi là tự khoá mình ra ngoài.

Đã kiểm chứng ngày 2026-09-05 bằng credential giả: app gọi tới Zalo thật và nhận `Invalid appId`,
tức URL, header `secret_key`, dạng form body và cách đọc lỗi đều đúng — chỉ credential là giả.
`ZaloZnsSenderTests` chạy trên HTTP giả nên không cần Postgres lẫn Zalo.

Lưu ý vận hành hiện tại:

- **OTP mặc định vẫn ở chế độ stub** (`Otp:StubEnabled=true`): mã trả thẳng trong response và ghi
  log. Adapter gửi thật là **Zalo ZNS** — xem mục riêng bên dưới.
- **Tài khoản ADMIN đầu tiên tạo thủ công** bằng SQL (`UPDATE users SET role='ADMIN' ...`). Không
  mở endpoint tự phong quyền admin.
- **`Jwt:Secret` phải ≥32 ký tự**, app từ chối khởi động nếu thiếu — cố ý fail fast vì secret rỗng
  khiến mọi token đều giả mạo được mà không lộ ra cho tới khi bị khai thác.
- **File lưu ở Cloudflare R2 khi có credential, đĩa local khi không** — xem mục "Ảnh hồ sơ KTV
  và Cloudflare R2" bên dưới. Không có cấu hình nào phải bật: `StorageSetup` chọn adapter theo
  việc có `R2:AccessKeyId` hay không.
- **Tile bản đồ đang dùng OSM công cộng** (`apps/web/src/lib/map.ts`). Không cần khoá nên chạy
  được ngay, nhưng OSM Tile Usage Policy không cho phép ứng dụng thương mại lưu lượng cao —
  phải đổi sang nhà cung cấp có hợp đồng trước khi mở traffic thật. Đổi ở đúng hai hằng số
  `TILE_URL`/`TILE_ATTRIBUTION`, không rải ra chỗ khác.

**Bản tiếng Anh cho khách đã chạy** (2026-09-05, `apps/web/src/i18n/` + `src/middleware.ts`).
Tiếng Việt là mặc định và **không có prefix**; bản tiếng Anh nằm dưới `/en` và dùng lại
slug tiếng Việt (`/en/massage-tan-noi/tp-ho-chi-minh`). Chín điều đừng vô tình đảo ngược:

- **Middleware `rewrite`, KHÔNG bao giờ `redirect`, và không negotiate `Accept-Language`.**
  URL tiếng Việt phải giữ nguyên từng ký tự vì Google đã index chúng; thêm một hop redirect
  vào ~760 URL là đánh đổi kênh acquisition chính lấy sự gọn gàng của đường dẫn. Tự động
  chuyển theo `Accept-Language` là cách kinh điển khiến Google index nội dung tiếng Anh dưới
  URL tiếng Việt — và vì Googlebot thường không gửi header đó, lỗi chỉ xuất hiện ở phía
  Google chứ không bao giờ tái hiện được trên trình duyệt. Đổi ngôn ngữ **chỉ** qua link
  tường minh ở header.
- **`middleware.ts` phải nằm trong `src/`**, cạnh `src/app`. Đặt ở gốc `apps/web` thì Next bỏ
  qua hoàn toàn: build xanh, `middleware-manifest.json` rỗng, và **mọi** URL tiếng Việt trả
  404 trong khi `/en/...` vẫn chạy bình thường. Đã cắn.
- **Matcher phải viết `'.*\..*'`, không phải `'.*\.'`.** Trong string literal của TypeScript,
  `\.` bị rút thành `.` — mà `.` không escape khớp mọi ký tự, nên biểu thức loại trừ nuốt gần
  hết đường dẫn và middleware gần như không bao giờ chạy. Cùng triệu chứng với lỗi trên. Kiểm
  bằng `.next/server/middleware-manifest.json`, đừng tin file nguồn.
- **`generateStaticParams` trên `[locale]` là bắt buộc.** Thiếu nó, Next coi `[locale]` là
  dynamic segment không biết trước giá trị và bỏ ISR cho **mọi** route con — build vẫn xanh,
  chỉ khác một chữ trong bảng output.
- **Root layout KHÔNG render `<html>`/`<body>`**; `[locale]/layout.tsx` làm việc đó. `lang`
  phải theo ngôn ngữ trang, mà root layout không có `params`; đọc `headers()` ở đó sẽ biến
  **mọi** route thành dynamic và giết ISR của chính những trang sống nhờ SEO.
- **hreflang khai trong `generateMetadata` của từng trang, không đặt ở layout.** Metadata của
  layout merge **nông**: page nào khai `alternates.canonical` sẽ ghi đè trọn `alternates` của
  layout, kể cả phần `languages` — hreflang biến mất khỏi đúng những trang cần nó nhất, mà
  build vẫn xanh. Dựng qua `alternatesFor` (`lib/seo.ts`) để cụm luôn đối xứng; Google bỏ qua
  cả cụm nếu một vế không trỏ ngược lại.
- **Backend trả cả hai ngôn ngữ trong một payload**, không nhận `?locale=`. `lib/api.ts` cache
  ở tầng fetch theo URL, nên một tham số locale sẽ tạo hai cache key cho cùng một dữ liệu và
  nhân đôi lượt gọi backend mỗi khi ISR revalidate. Đã đo: 3 lượt vi + 3 lượt en trang quận =
  **0** lần chạm DB.
- **`translateAreaName` chỉ dùng ở đường hiển thị.** Ô gợi ý khu vực khớp theo `name_ascii` do
  trigger trong DB dựng từ `name` tiếng Việt; đổi chuỗi đem đi khớp ở client sẽ làm ô gợi ý
  trả rỗng trong khi mọi thứ khác trông vẫn bình thường. Tiền tố khai rõ đặt trước hay sau
  tên ("District 7" nhưng "Cần Thơ City"), và sáu thành phố trực thuộc trung ương có bảng tên
  quốc tế riêng vì "Ho Chi Minh City" không suy ra được bằng luật.
- **Nội dung do người dùng viết giữ nguyên tiếng Việt**, bọc `lang="vi"` tại chính element
  chứa chữ, kèm nhãn "Written in Vietnamese" chỉ hiện ở bản tiếng Anh. Không dịch máy: Google
  coi nội dung dịch máy hàng loạt là spam và hình phạt rơi lên **cả tên miền**.

Cờ `indexable` của backend áp dụng chung cho cả hai ngôn ngữ, nên quận dưới ngưỡng nhận
`noindex, follow` ở bản EN và không vào sitemap — **bản tiếng Anh không nhân đôi rủi ro
doorway page**. Chuỗi trong `innerHTML` của popup Leaflet (`SearchMap.popupHtml`) phải dịch
thủ công: không công cụ nào dò được text nằm trong template literal.

Chưa làm, và cố ý: **dashboard KTV và trang admin vẫn chỉ có tiếng Việt** — cả hai nhóm người
dùng đều là người Việt, dịch ~420 chuỗi ở đó là công lớn mà gần như không ai đọc. **Message
lỗi API cũng vẫn tiếng Việt**: frontend map lỗi theo HTTP status ở mọi flow khách, nên không
câu nào của backend lọt ra mặt khách.
