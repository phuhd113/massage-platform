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

**Thông báo validate của form đã theo ngôn ngữ trang** (2026-09-07,
`lib/use-form-validation.ts` + `lib/validation-messages.ts` + namespace `validation` trong i18n).
Trước đó bong bóng kiểu "Please lengthen this text to 8 characters or more" do **trình duyệt** sinh
ra, theo ngôn ngữ **trình duyệt** — khách Việt dùng Chrome tiếng Anh đọc tiếng Anh giữa trang tiếng
Việt. Cả 12 form đã gắn hook. Sáu điều đừng vô tình đảo ngược:

- **Dịch theo `ValidityState`, KHÔNG đọc `validationMessage`.** Chuỗi của trình duyệt đổi theo cả
  trình duyệt lẫn phiên bản; bắt nó bằng regex là dựng một bảng tra phải theo kịp Chrome, Firefox và
  Safari mãi mãi. `ValidityState` là API chuẩn và nói đúng *loại* lỗi.
- **KHÔNG dùng `noValidate`.** Bỏ hẳn validation trình duyệt là mất luôn những thứ nó làm tốt: chặn
  submit, tự cuộn tới và focus vào ô sai đầu tiên, và vẫn chạy khi JS hỏng ở chỗ khác. Chỉ đổi *câu
  chữ*, giữ nguyên cơ chế.
- **Phải `setCustomValidity('')` ở `input`/`change`.** Đây là bẫy kinh điển của API này: để lại chuỗi
  khác rỗng thì ô đó **vĩnh viễn không hợp lệ** — người dùng sửa đúng rồi vẫn không submit được. Đã
  có test trong trình duyệt thật canh đúng ca đó.
- **Nghe ở tầng `<form>` pha capture, không gắn `onInvalid` lên từng input.** Sự kiện `invalid` không
  bubble nhưng **có** capture, nên một chỗ nghe phủ mọi ô — kể cả ô thêm sau. Form mới chỉ cần một
  dòng `ref={formRef}`, và ô mới không thể quên phần dịch.
- **Hai hàm dựng chuỗi, không một**: `messagesFor(locale)` cho trang khách (có vi + en),
  `viMessages()` cho dashboard KTV và admin (cố ý chỉ tiếng Việt). `validation-messages.ts` **không**
  khai `'use client'` — nó chỉ tra chuỗi, và server component `tai-khoan/page.tsx` gọi nó để truyền
  xuống `ChangePasswordForm` qua prop.
- **`{min}`/`{max}` định dạng theo `numberLocale`, không ghim `vi-VN`.** Ô nạp tiền khai
  `max=50000000`; một câu "không được vượt quá 50000000" bắt người đọc tự đếm chữ số ngay trong màn
  hình họ đang định chuyển tiền. Nhưng `50.000.000` trên trang tiếng Anh lại đọc thành số thập phân.

Chuỗi hardcode `"Chỉ hỏi vị trí khi bạn bấm…"` trong `HeroSearch` cũng đã chuyển sang
`home.heroGeoPromise` trong cùng đợt — nó vốn hiện nguyên tiếng Việt trên trang EN.

**Ảnh thật thay placeholder ở hero và section duyệt hồ sơ** (2026-09-08, hai file trong
`apps/web/public/`). Kèm theo là một lỗ hổng hiệu năng có sẵn được phát hiện và sửa. Bốn điều
đừng vô tình đảo ngược:

- **`sharp` phải nằm trong `dependencies` VÀ được `COPY` tường minh vào standalone.** Đây là lỗi
  im lặng nhất trong nhóm này: thiếu nó, trình tối ưu ảnh của Next **không báo lỗi** mà trả
  nguyên file gốc ở mọi `w=`, đúng định dạng gốc, kèm HTTP 200. Đã đo trước khi sửa: `w=640` trả
  đúng 141.663 byte của bản 1600px, và `Accept: image/webp` vẫn nhận `image/jpeg`. Sau khi sửa
  cùng URL đó là **20.311 byte AVIF** — giảm 86%. Next nạp `sharp` **động** nên file trace của
  build standalone không thấy và không gói vào; `dependencies` một mình là chưa đủ. Áp dụng cho
  **mọi** ảnh chứ không riêng ảnh biên tập: avatar và gallery KTV từ R2 đi qua đúng trình đó.
- **Ảnh biên tập của sàn là file tĩnh trong `public/`, không đi qua R2.** Chúng không do ai tải
  lên và không đổi theo dữ liệu, nên cho chúng qua `MediaUrls` + `remotePatterns` là bắt trang chủ
  phụ thuộc vào việc storage có cấu hình đúng hay không. Import tĩnh cũng cho Next biết sẵn kích
  thước thật, nên không có ca nào lệch tỉ lệ.
- **Chỉ ảnh hero mang `priority`.** Nó là LCP element của trang chủ. Ảnh ở section duyệt hồ sơ
  nằm dưới màn hình đầu tiên và cố ý **không** có — thêm vào là tranh băng thông với chính ảnh
  đang giữ LCP.
- **`HomeHeroMedia` nhận `locale` + `t`, không nhận từng chuỗi qua prop.** Khối này có bốn chỗ
  hiển thị chữ (alt + ba nhãn) và ba chỗ định dạng số; truyền lẻ là bốn cơ hội để một cái bị quên.
  Cùng đợt đã sửa nốt ba ô số liệu vốn hardcode tiếng Việt — cùng hình dạng với lỗi
  `heroGeoPromise` ngay trên.
- **Vế con số dễ bỏ sót hơn vế chữ, và sai nguy hiểm hơn.** `buildHomeStats` từng ghim
  `toLocaleString('vi-VN')` cùng `.replace('.', ',')` cho điểm trung bình, nên trang EN hiện
  **"4,6" — đọc thành bốn nghìn sáu**. Một câu tiếng Việt lọt sang trang EN thì nhìn là thấy;
  một con số sai quy ước dấu phân cách vẫn trông như con số hợp lệ. Nay cả ba ô đi qua
  `INTL_LOCALE[locale]` và `formatVnd`, nên vi cho `4,6` / `0 ₫` còn en cho `4.6` / `₫0` — ký
  hiệu tiền đổi cả vị trí, việc mà một `${x} ₫` viết tay không bao giờ làm được.

Ảnh nguồn là PNG 7,4 MB mỗi file; đã chuyển sang JPEG 1600px (~140 KB) trước khi commit. Ảnh chụp
thực tế phải là JPEG/WebP — PNG chỉ đúng cho ảnh có vùng màu phẳng và cần trong suốt.

**Giới tính KTV và popup lọc ở `/tim-kiem`** (2026-09-08, cột `ktv_profiles.gender` +
`SearchFilterDialog`). KTV khai giới tính lúc tạo hồ sơ; khách lọc theo giới tính, kinh nghiệm,
đánh giá và trạng thái trong một hộp thoại. Bảy điều đừng vô tình đảo ngược:

- **Cột `gender` nullable và KHÔNG backfill.** Hồ sơ có trước ngày này để NULL; suy giới tính từ
  tên là đoán, mà đoán sai ở đây nghĩa là khách lọc "KTV nữ" gọi trúng một người nam — hỏng đúng
  cái nhu cầu trường này sinh ra để phục vụ. Hệ quả có chủ ý: **hồ sơ chưa khai vắng mặt ở mọi
  lượt lọc theo giới tính**, và có test canh đúng ca đó. Đừng "sửa" bằng cách cho NULL lọt qua.
- **Bắt buộc lúc TẠO, tuỳ chọn lúc SỬA.** `CreateKtvProfileDto.Gender` là `string` non-null,
  `UpdateKtvProfileDto.Gender` là `string?` nơi null nghĩa là **không đổi** — không phải "xoá về
  chưa khai". Diễn giải nó thành xoá sẽ âm thầm đưa hồ sơ ra khỏi bộ lọc mỗi lần KTV sửa một
  trường khác. Đường sửa vẫn nhận được vì hồ sơ cũ chỉ có lối đó để khai lần đầu — khác hẳn
  `ReferralCode`, thứ cố ý không có ở đường sửa vì nó là cơ sở tính tiền.
- **Hai giá trị, cố ý không có "khác".** Giá trị thứ ba sẽ không khớp bộ lọc nào, tức một ô chọn
  khiến người chọn nó biến mất khỏi kết quả tìm kiếm mà không có gì báo cho họ. CHECK
  `chk_ktv_gender` ở tầng DB, không chỉ FluentValidation: seed và sửa tay bằng SQL cũng chạm bảng
  này, và một giá trị lạ hỏng im lặng — hồ sơ vẫn lưu được, chỉ là không hiện ra đâu cả.
- **Bộ lọc nằm trong CTE `candidates`, trước khi tính điểm và phân trang.** Đặt sau `paged` thì
  nó lọc trên đúng 20 dòng của trang hiện tại: danh sách trang 1 trông vẫn đúng, nhưng `total`
  nói dối và phân trang hỏng hẳn. Có test canh chính `total`.
- **`minRating` phải kèm `rating_count > 0`.** Hồ sơ chưa ai đánh giá có `rating_avg = 0`, nên
  thiếu vế này thì ngưỡng "từ 0 sao" khác hẳn "không lọc" theo cách không ai đoán được. Ngưỡng so
  với `rating_avg` **thô**, không với điểm đã làm mượt Bayesian dùng để xếp hạng: khách chỉ nhìn
  thấy con số thô trên thẻ, lọc theo con số họ không thấy sẽ cho ra danh sách mà bộ lọc trông như
  đang sai. Tham số truyền `NpgsqlDbType.Numeric` để khớp `NUMERIC(3,2)`, không truyền double.
- **Giá trị lạ trả 400, không im lặng bỏ qua.** Bỏ qua nghĩa là giao diện hiện "đang lọc" trong
  khi kết quả không lọc gì. Nhưng trang `/tim-kiem` **lọc sạch tham số ở server trước khi gọi
  API** (danh sách trắng cho gender, kiểm dải cho hai số): query string do khách sửa được, và để
  một tham số phụ gõ sai làm cả trang tìm kiếm trả lỗi là đánh đổi tệ.
- **Popup tự mở một lần mỗi phiên, và chỉ khi trang đã có kết quả.** Nhớ bằng `sessionStorage`
  (`masgo_search_filter_seen`) chứ không `localStorage` — đây là lời mời lọc cho *lần đi tìm này*,
  không phải tuỳ chọn của người dùng; nhớ vĩnh viễn nghĩa là khách quay lại sau một tuần với nhu
  cầu khác hẳn sẽ không bao giờ được mời lọc nữa. Đây là chỗ **thứ ba** dùng browser storage.
  Ba điều kiện đi kèm, bỏ cái nào cũng thành phiền: **(1)** `/tim-kiem` trần không mở — màn hình
  đó đang mời chọn khu vực, popup đè lên là chặn đúng bước phải làm trước, và nó cũng **không đốt
  cờ phiên** nên popup vẫn còn dành cho khách sau khi họ chọn xong; **(2)** đã có bộ lọc trong URL
  thì không mở — khách đến từ link đã lọc sẵn đã có đúng thứ mình muốn; **(3)** ghi cờ **ngay lúc
  mở**, không đợi lúc đóng, cùng lý do với `KtvAnnouncement`. Đọc storage trong `useEffect`, không
  lúc khởi tạo state — cùng bẫy hydration đã ghi ở `lib/saved-area.ts`. `activeCount` cố ý **không**
  nằm trong deps: thêm vào thì popup bật lên ngay sau khi khách chủ động xoá hết bộ lọc.
- **Nút mở popup phải mang số bộ lọc đang bật.** Bộ lọc trong popup là bộ lọc khách không nhìn
  thấy; không có con số đó thì kết quả bị thu hẹp mà không có gì trên màn hình giải thích vì sao.
  Cùng lý do, popup mở ra **luôn đọc lại từ URL** chứ không giữ state riêng — bấm Back sẽ làm bản
  sao trong state lệch khỏi danh sách bên dưới. Bản nháp chỉ ghi vào URL khi bấm "Xem kết quả":
  đóng bằng Escape hay bấm ra ngoài phải bỏ hết thay đổi, và cả bốn tiêu chí đi trong **một** lượt
  điều hướng để không đẩy ba mục thừa vào lịch sử trình duyệt.

"Đang nhận khách" đã **chuyển từ hàng chip vào popup** — giữ ở cả hai chỗ là hai nút bấm cho cùng
một bộ lọc, phải tự giữ khớp nhau. Đã kiểm chứng trong trình duyệt thật (2026-09-08): lọc đúng ở
cả vi và en, URL chia sẻ lại được, bottom sheet ở 390px, không lỗi hydration, và `4.5+ stars` ở
trang EN dùng dấu chấm thập phân — đúng chỗ `HomeHeroMedia` từng sai.

**Thông báo chương trình Beta hiện một lần khi KTV vào dashboard** (2026-09-08,
`KtvAnnouncement` + `lib/ktv-announcement.ts`). Nội dung: miễn phí trong giai đoạn thử nghiệm, lộ
trình sẽ thu phí duy trì hồ sơ theo ngày, quyền lợi KTV Tiên phong, và số liên hệ Ban quản trị.
Năm điều đừng vô tình đảo ngược:

- **Nhớ "đã đọc" bằng localStorage kèm số phiên bản, KHÔNG bằng cột trong DB.** Đây là thông báo
  marketing chứ không phải bằng chứng pháp lý — thứ cần chứng minh "đã đồng ý với đúng những dòng
  này" là bản cam kết KTV (`commitment_version`, nội dung ở backend `KtvCommitments`). Thêm một cột
  chỉ để đếm lần đóng popup là trả giá một migration cho một tiện ích hiển thị, kèm nghĩa vụ
  backfill mỗi lần sửa câu chữ. Đánh đổi đã cân nhắc: nhớ theo **trình duyệt**, nên đổi máy sẽ thấy
  lại một lần.
- **Sửa câu chữ phải tăng `ANNOUNCEMENT_VERSION`.** Không tăng thì KTV đã đóng bản cũ không bao giờ
  thấy bản mới — mà lý do duy nhất để sửa một thông báo là muốn người ta đọc phần đã đổi. Cùng hình
  dạng với `KtvCommitments.CurrentVersion`, khác ở chỗ bản này không cần bằng chứng phía server.
- **Ghi nhận đã đọc ngay lúc mở, không đợi lúc đóng.** KTV đóng tab giữa chừng vẫn là đã thấy; hiện
  lại ở lần đăng nhập sau đọc như lỗi lặp.
- **Đặt ở `dashboard/layout.tsx` và nằm SAU nhánh CUSTOMER.** KTV vào dashboard qua nhiều đường
  (trang tổng quan, link sâu tới `/dashboard/goi`, và `/dashboard/ho-so` khi chưa có hồ sơ), gắn ở
  một page là bỏ sót đúng những lối vào khác. Nằm sau nhánh CUSTOMER nên tài khoản khách không bao
  giờ thấy — và cũng **không** bị ghi cờ, nên tài khoản sau này thành KTV vẫn được xem.
- **Khối "sẽ thu phí" tách riêng, không trộn vào danh sách quyền lợi miễn phí.** Đây là thông tin
  bất lợi cho người đọc; gói nó lẫn giữa các gạch đầu dòng "miễn phí 100%" là cách chắc chắn để sau
  này bị nói là đã giấu.

Đã kiểm chứng trong trình duyệt thật (2026-09-08): hiện đúng một lần cho KTV, không hiện lại sau
reload, **không** hiện cho tài khoản CUSTOMER, không có lỗi hydration, và khoá cuộn nền được trả
lại sau khi đóng.

**Thông báo đó cũng mở được từ màn hình đăng ký KTV** (2026-09-09, `BetaAnnouncementDialog` +
`KtvBetaAside`). Câu chữ tách khỏi `KtvAnnouncement` thành component dùng chung; cột phải của
`/dang-ky-ktv` nay là tóm tắt chương trình Beta + nút mở đúng hộp thoại đó. Bốn điều đừng vô tình
đảo ngược:

- **Một nguồn câu chữ, hai luật hiển thị.** Nội dung nằm ở `BetaAnnouncementDialog`, còn luật
  "hiện một lần" ở lại `KtvAnnouncement`. Chép câu chữ sang file thứ hai là để người đọc lúc đăng
  ký đồng ý với một bản còn bản họ thấy sau khi vào dashboard là bản khác — đây là lời hứa về
  chính sách thu phí, và `ANNOUNCEMENT_VERSION` chỉ canh được **một** bản.
- **Ở trang đăng ký là nút bấm, KHÔNG tự bật.** Popup tự hiện chồng lên ô nhập của người vừa tới
  để tạo tài khoản là đặt lời chào trước việc họ tới để làm. Quan trọng hơn: cờ localStorage bị
  đốt **ngay lúc mở**, nên tự bật ở đây sẽ tiêu mất lượt hiện duy nhất ở dashboard — KTV xem lướt
  lúc đang điền form rồi không bao giờ được mời đọc lại. Nút bấm không đụng tới cờ đó, nên hai
  đường độc lập.
- **Chỉ cửa KTV đổi; `/dang-ky` và `/dang-nhap` giữ nguyên khối cũ.** Bốn key `login.asideTitleKtv`
  / `asideKtv1..3` **giữ lại** dù không nơi nào đọc: chúng mô tả sàn không phụ thuộc thời gian,
  còn khối Beta gắn với một chương trình có hạn — kết thúc Beta là trả khối cũ về. Cùng lý do với
  `login.crossLink*` đang chờ bản OTP.
- **Nạp bằng `next/dynamic`, nhưng KHÔNG `ssr: false`.** Import tĩnh gom hộp thoại vào chunk chung
  của form, và chunk đó nạp ở cả hai cửa khách nơi nó không bao giờ render — đã đo trên bản build
  trước khi sửa. Tách chunk cắt được điều đó (`/dang-ky` 114 kB → 112 kB). Nhưng `ssr: false` thì
  cột phải trống ở lần vẽ đầu rồi mới hiện, một cú chớp ngay cạnh ô nhập; giữ SSR thì chữ có sẵn
  trong HTML và chỉ riêng nút sống muộn hơn một nhịp (chunk 2 KB).

Đã kiểm chứng trên bản build production (2026-09-09): khối Beta có trong HTML thô của
`/dang-ky-ktv` và `/en/dang-ky-ktv` (chỉ tiếng Việt, cùng lý do với dashboard KTV), hai cửa khách
không có, nội dung hộp thoại **không** nằm trong HTML ban đầu, và không chunk nào của cửa khách
còn chứa nó.

**KTV chưa tạo hồ sơ bị giữ ở `/dashboard/ho-so`** (2026-09-07, `lib/require-profile.ts`).
Tài khoản KTV mới đăng ký **không** tự có hồ sơ — phải gọi `POST /ktv/profile` riêng, và trước đó
mọi trang dashboard đều mở nhưng rỗng. Năm điều đừng vô tình đảo ngược:

- **Điều kiện là "đã tạo hồ sơ", KHÔNG phải "đã được duyệt".** Duyệt phụ thuộc admin xem CCCD bằng
  mắt; lấy VERIFIED làm điều kiện là nhốt KTV đã làm xong phần việc của mình ở ngoài dashboard nhiều
  giờ, và nhốt **vĩnh viễn** người bị REJECTED — trong khi việc họ cần làm lúc đó (sửa hồ sơ, gửi
  lại CCCD) nằm ở đúng trang này. Hai điều kiện vẫn tách bạch: có hồ sơ thì vào được `/dashboard/goi`,
  nhưng mua gói vẫn đòi VERIFIED.
- **`/dashboard/ho-so` không bao giờ bị chặn.** Nó là nơi hồ sơ được tạo — chặn ở đó là một vòng lặp
  kín không có lối ra.
- **Guard nằm ở từng page, không ở layout.** Layout không biết đường dẫn hiện tại (middleware cố ý
  loại trừ `/dashboard` khỏi matcher, nên không có header `x-pathname`), mà chặn ở layout mà không
  biết đường dẫn thì chặn luôn cả trang hồ sơ. `requireKtvProfile()` gọi một dòng ở đầu mỗi page.
- **`requireKtvProfile` trả luôn hồ sơ**, không chỉ `void`: trang gọi nó gần như luôn cần chính dữ
  liệu đó, và tách làm hai lời gọi là bắt backend trả lời hai lần cho cùng câu hỏi.
- **API hỏng thì cho đi tiếp.** Layout giữ `hasProfile = true` khi lời gọi ném lỗi khác 401 — nhốt
  KTV **đã có** hồ sơ vào trang tạo hồ sơ vì ví chập chờn là biến một sự cố nhỏ thành mất quyền
  truy cập.

Sidebar làm mờ các mục chưa vào được (`DashboardNav` nhận `hasProfile`), nhưng đó chỉ là nói trước
cho đỡ bấm nhầm — **guard thật nằm ở server**. Trang công khai không bị chặn: người đang cân nhắc
tạo hồ sơ có lý do chính đáng để xem sàn hoạt động thế nào trước.

**Ba nhóm route, ba khung trang khác nhau** (2026-09-03): `(public)` có header/footer,
`(auth)` không có gì (màn đăng nhập chiếm trọn màn hình, chia hai cột), `/dashboard` có sidebar
riêng. Route group không đi vào URL nên mọi đường dẫn giữ nguyên.

**Header rút còn hai mục + mục vị trí** (2026-09-07, `LocationNavButton` + `lib/saved-area.ts`).
Trước đó có bảy mục. Nay: **vị trí · Dành cho KTV**. Bảy điều đừng vô tình đảo ngược:

- **Bỏ khỏi header không phải là bỏ khỏi site.** "Tìm KTV", TP.HCM, Hà Nội và "cách duyệt hồ sơ"
  chuyển xuống footer — footer nằm trong HTML của **mọi** trang công khai nên giá trị liên kết nội
  bộ giữ nguyên. Xoá hẳn chúng mới là cắt đường Google đang đi. `/tim-kiem` bắt buộc phải còn **một**
  đường không phụ thuộc GPS ở footer: mục vị trí dẫn vào đó nhưng chỉ chạy khi khách cho quyền định
  vị, còn Googlebot thì không bao giờ cho.
- **"Dành cho KTV" trỏ `/dang-nhap`, không phải `/dang-ky-ktv`.** Phần lớn người bấm nó là KTV **đã
  có** hồ sơ, đang muốn vào làm việc; người chưa có đi tiếp một bước qua link dưới form. Ngược lại
  thì số đông quay lại mỗi ngày phải đi vòng.
- **`registerHref` trong `PasswordAuthForm` rẽ theo `redirectTo`.** `/dang-nhap` có hai lối vào rất
  khác nhau: KTV từ header (không `?next=`) và khách từ `ReviewForm` (luôn có `?next=`). Vai trò
  **chốt lúc tạo tài khoản** và không tự đổi được, nên gửi nhầm cửa là hỏng im lặng — KTV tạo phải
  tài khoản CUSTOMER sẽ vào `/dashboard` chỉ thấy màn hình giải thích, trong khi cả hai bước đều báo
  thành công. Có `?next=` → `/dang-ky` (giữ nguyên `next`); không có → `/dang-ky-ktv`. Chiều ngược
  lại ("Đã có tài khoản?") cũng phải giữ `?next=`.
- **Không còn dòng "sang cửa của đối tượng kia" trên màn đăng nhập.** Header đã trỏ KTV thẳng vào
  đây, nên một dòng hỏi ngược "bạn là khách à?" là mời người ta rời đúng màn hình họ vừa được dẫn
  tới. Bốn key `login.crossLink*` **giữ lại** vì `LoginForm` (bản OTP) còn dùng — xoá là làm bản đó
  đỏ khi khôi phục.
- **Nút vị trí KHÔNG tự dò khi tải trang**, đúng chính sách đã ghi ở `HeroSearch`: xin quyền GPS lúc
  khách vừa vào là cách nhanh nhất để bị từ chối vĩnh viễn ở cấp trình duyệt — và header nằm trên
  mọi trang, nên đây là chỗ sai lầm đó tốn kém nhất. Bị chặn một lần thì nút "Tìm quanh tôi" ở
  trang chủ chết theo.
- **Điều hướng ngay bằng toạ độ thật, không chờ dò tên quận.** Kết quả lọc theo toạ độ chứ không
  theo cái nhãn; chờ thêm một vòng gọi mạng chỉ để biết chữ hiển thị là đổi thời gian chờ lấy
  không gì cả. `resolveArea` chạy song song và chỉ để nhớ nhãn cho lần sau.
- **`lib/saved-area.ts` lưu tên + slug, KHÔNG lưu toạ độ.** Toạ độ là vị trí nhà khách: nó nằm mãi
  trên máy (kể cả máy dùng chung) để đổi lại đúng một lần bấm, trong khi lần bấm sau GPS cho toạ độ
  thật chính xác hơn bản sao cũ. Đây là **một trong hai** chỗ trong codebase dùng localStorage (chỗ
  kia là `lib/ktv-announcement.ts`) — mọi trạng thái khác đi qua URL hoặc cookie httpOnly. Mất nó
  thì header về "Chọn vị trí", không hỏng gì.
- **Đọc localStorage trong `useEffect`, không phải lúc khởi tạo state.** Server không có
  localStorage nên đọc ở lần render đầu cho hai kết quả khác nhau giữa server và client → hydration
  mismatch. Cũng phải kiểm từng trường sau `JSON.parse`: nội dung này sửa được bằng devtools, và một
  `areaSlug` là số sẽ đi thẳng vào URL tìm kiếm.
- **Đổi ngôn ngữ xuống footer nhưng phải hiện ở MỌI kích thước màn hình.** `LanguageSwitcher` từng
  ghi cứng `hidden … sm:block` cho header; lớp đó đi theo xuống footer sẽ giấu mất lối đổi ngôn ngữ
  **duy nhất** trên toàn bộ màn hình điện thoại (middleware cố ý không đoán theo `Accept-Language`).
  Nay nhận `className` qua prop, và hiện "English"/"Tiếng Việt" thay vì "EN"/"VI" — giữa những link
  chữ ở footer, "EN" một mình đọc như từ viết tắt chứ không như một lựa chọn.

`AccountNavLink` **còn file nhưng không route nào render**: bản này chỉ để KTV thấy lối đăng nhập
trên thanh điều hướng. Tài khoản khách vẫn sống nguyên — `/dang-nhap`, `/dang-ky`, `/tai-khoan` và
form đánh giá chạy như cũ, và khách cần đăng nhập thì gần như luôn đang đứng ở một hồ sơ, nơi
`ReviewForm` mời họ đúng lúc kèm `?next=` quay lại đúng trang đó. Mở lại chỉ là đặt lại một thẻ vào
`PublicShell`.

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
- **Ảnh gallery có trạng thái duyệt riêng.** Hồ sơ đã VERIFIED vẫn thêm ảnh mới bất cứ lúc nào,
  nên đi theo trạng thái hồ sơ nghĩa là mở một khe đăng nội dung không ai xem trên trang công
  khai của đúng ngành Google phạt nặng nhất khi phân loại nhầm — và hình phạt rơi lên cả tên
  miền. **Ảnh đại diện từ 2026-09-10 cũng phải qua duyệt** — xem mục riêng bên dưới; câu cũ ở
  đây ("avatar hiện ngay") đã không còn đúng.
- **Mỗi loại tài sản duyệt được phải có hàng đợi riêng** — xem mục "Bốn lần cùng một lỗi" bên
  dưới. Ảnh là loại đầu tiên (`/admin/duyet-anh`): danh sách hồ sơ lọc theo trạng thái **hồ sơ**,
  nên ảnh mới của một hồ sơ đã duyệt sẽ không xuất hiện ở đâu cả.
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

**Ba trang pháp lý công khai** (2026-09-10, `/an-toan`, `/dieu-khoan`, `/chinh-sach-bao-mat`
+ `lib/legal.ts` + `components/LegalPage.tsx`). Trước đợt này codebase **không có một trang
FAQ, giới thiệu, điều khoản hay chính sách nào** — grep 0 kết quả. Sáu điều đừng vô tình đảo
ngược:

- **`/an-toan` là nơi lời hứa "đã duyệt" sống ở đúng MỘT chỗ.** Trước đây câu khẳng định về
  việc duyệt hồ sơ nằm rải rác ở footer, badge trang chủ và meta description của ~700 trang
  khu vực — và đã trôi khỏi `AdminService.DecideProfileAsync` mà không có gì báo đỏ, phải đi
  sửa hàng loạt ngày 2026-09-09. Mọi câu trong phần "chúng tôi kiểm tra gì" phải kiểm được ở
  đúng hàm đó: hiện là **hai** điều kiện (CCCD VERIFIED + cam kết đúng phiên bản). Trang có
  mục riêng nói rõ **chứng chỉ hành nghề là tuỳ chọn** — không nói ra thì khách tự hiểu là
  bắt buộc, và ta lại hứa thừa đúng thứ vừa phải gỡ.
- **Khối "Điều chúng tôi không thể đảm bảo" là bắt buộc, và nằm TRONG phần nói về việc duyệt.**
  Một trang an toàn chỉ liệt kê thứ mình làm được sẽ đọc như bảo lãnh cho từng cuộc hẹn — thứ
  sàn không thể bảo lãnh và là chỗ tranh chấp sẽ rơi vào. Đẩy nó xuống cuối trang thì người
  đọc kỹ nhất phần "chúng tôi kiểm tra gì" lại là người không đọc vế còn lại.
- **`lib/legal.ts` là nguồn sự thật duy nhất cho pháp nhân, và đang còn placeholder.**
  `LEGAL_ENTITY_INCOMPLETE` bật cảnh báo **chỉ ngoài production**: ở production thứ hiện ra
  cho khách phải là chỗ trống trong khối pháp nhân, không phải một dòng nội bộ về tên file.
  **Phải điền trước khi mở traffic thật** — Nghị định 13/2023 buộc nêu rõ Bên Kiểm soát dữ
  liệu, và một trang chính sách khai sai pháp nhân tệ hơn không có vì nó là lời khai chủ động.
  Cố ý **không** nằm trong `i18n/*.ts`: tên doanh nghiệp, MST và địa chỉ đăng ký không dịch,
  để trong dictionary là mời một bản "cho thuận tai" vào đúng chỗ cần nguyên văn theo giấy phép.
- **`LEGAL_PAGES` trong `LegalPage.tsx` là danh sách duy nhất**, và footer + sitemap + cụm
  liên kết chéo đều dựng từ nó. Thêm trang pháp lý thứ tư là nó tự có mặt ở cả ba nơi. Thiếu
  đường vào từ giao diện thì trang không tồn tại với người dùng — lỗi đã cắn **bốn lần** trong
  dự án này (xem mục "Bốn lần cùng một lỗi"), và footer nằm trong HTML của mọi trang công khai
  nên đó cũng là thứ làm ba trang này tồn tại với Googlebot.
- **Ba trang khai `changeFrequency: 'yearly'`, priority 0.3.** Chúng đổi khi nghĩa vụ đổi chứ
  không hằng tuần; khai `daily` cho một văn bản gần như không đổi là dạy Googlebot bỏ qua chính
  tín hiệu đó ở những trang thật sự đổi hằng ngày. Chúng **không** đi qua `SitemapController`:
  backend khai "trang nào đáng index" dựa trên dữ liệu (ngưỡng KTV, hồ sơ đã duyệt), còn ba
  trang này không phụ thuộc dữ liệu nào.
- **`LEGAL_EFFECTIVE_DATE` phải tăng khi nghĩa vụ đổi**, cùng nguyên tắc với
  `KtvCommitments.CurrentVersion`; sửa lỗi chính tả thì giữ nguyên. Khác ở chỗ bản cam kết KTV
  cần bằng chứng phía server (ai đồng ý bản nào, lúc nào) còn ba trang này chỉ công bố — một
  ngày hiệu lực là đủ, không cần cột DB.

Bốn dòng "bị cấm tuyệt đối" ở `/an-toan` là bản rút gọn cho khách của `KtvCommitments.Items`
ở backend. **Sửa bản cam kết thì đọc lại cả bốn dòng đó** — đây đúng dạng lỗi "câu chữ UI trôi
khỏi luật backend mà không có gì báo đỏ", vì không test nào đọc câu chữ. Cùng lý do, mục 8 của
chính sách bảo mật kê **đúng ba chỗ** dùng browser storage đang có (`lib/saved-area.ts`,
`lib/ktv-announcement.ts`, cờ popup lọc trong `sessionStorage`); thêm chỗ thứ tư mà quên sửa
mục này thì chính sách kê thiếu, tức kê sai.

`/an-toan` cố ý **không** dùng `sm:text-display` cho `h1` như trang khu vực và trang hồ sơ: cỡ
display (3rem, weight 800) là cỡ tiêu đề bán hàng, ở đầu một văn bản pháp lý dài nó đọc như
khẩu hiệu và nuốt mất tương phản với các `h2` đánh số bên dưới — thứ duy nhất giúp quét nhanh
trang này.

**Giới hạn độ dài dòng đặt ở từng khối chữ, KHÔNG ở `<article>`.** Bản đầu bó cả article vào
`max-w-prose` và lưới thẻ bị ép theo: hai cột "Lời khuyên an toàn" tụt xuống ~31 ký tự mỗi cột,
tiêu đề ngắt giữa cụm ("Nói không với mọi đề / nghị ngoài phạm vi"), nửa phải màn hình bỏ trống.
Nay `<article>` là `max-w-3xl`, còn `LegalSection` nhận cờ `wide` cho những mục có lưới thẻ —
đoạn văn thuần bên trong mục `wide` tự giữ `max-w-prose` của riêng nó. Chỉ thấy được bằng mắt
trên bản dev; typecheck, lint và build đều xanh với bản sai.

Đã kiểm chứng trên bản build production (2026-09-10): cả sáu URL trả 200 và **prerender tĩnh**
(`●` cho cả `/vi` lẫn `/en`, khác các trang khu vực vì chúng không phụ thuộc API); canonical +
cụm hreflang đối xứng đủ ba thẻ ở cả hai chiều; nội dung nằm trong HTML thô; `BreadcrumbList`
hợp lệ; sitemap có đủ 6 `<loc>`; robots.txt không chặn trang nào; footer hiện cả ba link ở `/`
và `/en`; cụm liên kết chéo loại đúng trang hiện tại; cảnh báo placeholder **không** lọt ra
production build trong khi chỗ trống pháp nhân vẫn hiện.

Chưa làm, và cố ý: `/gioi-thieu` và `/cach-hoat-dong` (SEO informational) cùng `/cho-ktv`
(cẩm nang KTV). Trang cuối phải lấy nội dung về gói đẩy tin và chính sách hoàn tiền **từ
backend** chứ không viết tay vào JSX — cùng lý do với `KtvCommitments`: bản chép tay sẽ trôi
khỏi `PackageTypes` và logic hoàn tiền thật, và bản lệch chỉ lộ ra khi có KTV khiếu nại về tiền.

**Chứng chỉ hành nghề là TUỲ CHỌN** (2026-09-09). Điều kiện để hồ sơ sang VERIFIED chỉ có hai,
và cả hai nằm ở `AdminService.DecideProfileAsync`: **CCCD đã xác minh + cam kết đúng phiên bản**.
Chứng chỉ không phải điều kiện, `SearchService` cũng không lọc theo nó — hồ sơ 0 chứng chỉ vẫn
duyệt được và vẫn hiển thị. Hai test canh đúng điều đó (`Duyệt_CCCD_xong_thì_duyệt_được_hồ_sơ`,
`Đủ_CCCD_và_cam_kết_thì_duyệt_được` — cả hai duyệt thành công với 0 chứng chỉ), nên thêm ràng buộc
chứng chỉ vào đường duyệt sẽ làm chúng đỏ. Đó là chốt chặn có chủ ý, không phải test thiếu sót.

Đợt này **backend không đổi một dòng nào** — thứ sai chỉ là những gì hệ thống nói với người dùng:

- **Lời hứa công khai phải kiểm được ở `DecideProfileAsync`.** Đây là dạng lỗi cùng họ với "endpoint
  không có đường vào giao diện" ở mục ngay dưới, và cũng im lặng y hệt: câu chữ trong UI trôi khỏi
  luật ở backend mà **không có gì báo đỏ**, vì không test nào đọc câu chữ. Đã tồn tại tới lúc phát
  hiện: footer, meta description trang khu vực (~700 trang) và badge trang chủ đều khẳng định "**mọi**
  hồ sơ hiển thị đều đã qua duyệt chứng chỉ hành nghề" — một lời hứa **với khách** mà sàn không giữ,
  trong đúng cái ngành Google soi kỹ nhất. Nay mọi câu khẳng định nói về **đối chiếu danh tính**.
- **Phân biệt "khẳng định mọi hồ sơ đều có" với "mô tả tính năng".** Không phải chuỗi nào nhắc chứng
  chỉ cũng sai: "xem chứng chỉ trước khi gọi", "{n} chứng chỉ đã duyệt", và nhất là `areaDistrict.
  howTo1` ("**Ưu tiên** hồ sơ có chứng chỉ đã duyệt") đều giữ nguyên — câu cuối thậm chí chỉ **có
  nghĩa** khi chứng chỉ là tuỳ chọn. Đừng quét sạch từ khoá này khỏi trang: nó là từ khoá SEO thật.
- **`verifiedKtvCount` đếm hồ sơ đã DUYỆT, không đếm chứng chỉ.** Con số vốn luôn đúng; chỉ có câu
  chữ quanh nó gán nhầm cho chứng chỉ. Đừng "sửa" theo chiều ngược lại bằng cách đổi nguồn số.
- **Bản EN khẳng định mạnh hơn bản VI ở cùng một key.** "certified therapists" là khẳng định về
  **từng** người, trong khi vế tiếng Việt tương ứng chỉ là cụm từ khoá danh mục. Khi soát lời hứa,
  đọc từng bản một — dịch sát nghĩa không có nghĩa là mức khẳng định bằng nhau.
- **Dashboard KTV không có mục todo nhắc chứng chỉ**, cố ý: `TodoPanel` chỉ chứa việc "làm xong thì
  biến mất", mà một lời khuyên tuỳ chọn thì không bao giờ xong nên sẽ nằm đó vĩnh viễn và làm nhờn
  cả panel. Phần khuyến khích nằm ở section chứng chỉ trong `/dashboard/ho-so`, đúng ngữ cảnh.
  Dòng cũ ở đó còn tệ hơn: nó nói "hồ sơ cần ít nhất một chứng chỉ đã duyệt để hiển thị" — sai hẳn,
  và đọc như lý do khiến hồ sơ mãi không lên sàn.

Ba section trong `/dashboard/ho-so` giữ thứ tự CCCD → cam kết → chứng chỉ, và hai cái đầu mở bằng
"Bắt buộc." còn cái thứ ba mở bằng "Không bắt buộc." — đối xứng đó là thứ trả lời câu hỏi "tôi còn
thiếu gì" ngay trong lúc đọc lướt.

**Bốn lần cùng một lỗi: hàng đợi duyệt phải tách theo loại tài sản** (2026-09-08). Nguyên tắc:
**mỗi thứ admin duyệt được phải có hàng đợi riêng lọc theo trạng thái của chính nó**, không bao
giờ chỉ hiện lồng trong danh sách hồ sơ. Đã cắn bốn lần, và cả bốn đều **im lặng theo cùng một
kiểu**: người gửi nhận đúng câu "đã gửi, chờ duyệt", admin không thấy gì, và không bên nào biết
là đang chờ vô ích.

**Dạng tổng quát của lỗi này rộng hơn hàng đợi duyệt**: một endpoint không có đường vào giao diện
thì **không tồn tại đối với người dùng**, mà không có gì báo đỏ — nó vẫn trả 200 với curl, test
service vẫn xanh, và không test nào biết hỏi câu "có trang nào gọi tới nó không". Vì vậy khi thêm
một endpoint admin, việc chưa xong cho tới khi có trang **và** có mục sidebar.

Vì sao lồng vào danh sách hồ sơ luôn hỏng: danh sách đó lọc theo trạng thái **hồ sơ**, mà cả ba
loại tài sản đều thêm/gửi lại được **sau khi** hồ sơ đã duyệt xong — và không lượt nào trong số
đó làm đổi trạng thái hồ sơ. Chúng rơi vào tab "Đã duyệt", nơi admin không có lý do gì để mở.

- **Ảnh gallery** — lần một, đã tách thành `/admin/duyet-anh`.
- **Chứng chỉ hành nghề** — lần hai, tách thành `/admin/duyet-chung-chi` cùng
  `GET /admin/certifications`. Endpoint duyệt `PATCH /admin/certifications/{id}/verify` vốn đã
  có từ trước: thiếu là đường **tìm ra** thứ cần duyệt, không phải đường duyệt.
- **CCCD** — lần ba, và hình dạng hơi khác: `GET /admin/identity-documents` **đã có sẵn** từ đợt
  bắt buộc CCCD, chỉ là **không trang nào gọi tới nó**. Một endpoint không có đường vào giao diện
  thì không tồn tại đối với người dùng, mà cũng không có gì báo đỏ — nó vẫn trả 200 với curl. Nay
  là `/admin/duyet-cccd`. Đây là trường hợp nghiêm trọng nhất trong ba: gửi lại CCCD **cố ý** đưa
  trạng thái về PENDING mà không đụng tới trạng thái hồ sơ, nên lượt thay thẻ của một hồ sơ đã
  VERIFIED trước đây không xuất hiện ở bất kỳ đâu — đúng cái lỗ mà việc bắt buộc CCCD sinh ra để bịt.
- **Báo cáo vi phạm** — lần bốn (2026-09-08), và là lần tốn kém nhất vì nó hứa với **khách** chứ
  không phải với KTV. `GET /admin/reports` + `PATCH /admin/reports/{id}/resolve` có từ 2026-09-04
  nhưng không trang nào gọi tới, nên toàn bộ hệ thống báo cáo chạy vào hư không: khách bấm báo cáo,
  nhận đúng câu "đã ghi nhận", dữ liệu vào DB, và không ai đọc. Nay là `/admin/bao-cao`. Cùng đợt
  thêm `/admin/ra-soat-danh-gia` (`GET /admin/reviews`, cùng hình dạng — endpoint có từ 2026-09-04,
  chưa từng được dùng) và `/admin/doanh-thu` (`GET /admin/revenue`).

Hệ quả bắt buộc nhớ: **thêm loại tài sản duyệt được thứ năm thì phải thêm cả bốn thứ cùng lúc** —
endpoint hàng đợi, trang, mục trong `AdminNav`, và **đường xoá cache** (mục ngay dưới). Thiếu mục
sidebar thì trang tồn tại nhưng không ai tìm ra, tức là quay lại đúng lần thứ ba. Cùng lý do đó,
`tools/verify-r2.sh` cũng phải được bổ sung khi loại mới là file riêng tư (xem mục CCCD/chứng chỉ
bên trên).

Ba trang của lần thứ tư, ba điều đừng vô tình đảo ngược:

- **Trang báo cáo không gỡ hồ sơ tại chỗ.** Nó chỉ đóng dòng trong hàng đợi; việc gỡ đi qua đúng
  `PATCH /admin/ktv/{id}/verify` như cũ, nên thẻ báo cáo mang một link sang `/admin/duyet-ktv` chứ
  không phải một nút gỡ. Nhân bản logic đổi trạng thái hồ sơ vào đây sẽ tạo ra hai đường phải giữ
  cho khớp nhau mãi mãi — và một trong hai sẽ quên ghi lại ai quyết định.
- **Kiểm duyệt đánh giá đi qua `/api/admin-verify`, báo cáo thì `/api/proxy`.** Khác nhau vì đánh
  giá **tính lại `rating_avg`**, mà con số đó nằm trong `AggregateRating` của trang SEO — bản dựng
  cũ sẽ khai điểm sai cho cả Google đọc. Chốt một báo cáo không đổi gì trên trang công khai, nên
  xoá cache ISR ở đó là trả giá mà không đổi lại được gì (cùng lý do CCCD cố ý không đi qua).
- **Cảnh báo "chưa gắn lượt liên hệ không có nghĩa là giả" đặt ngay cạnh bộ lọc**, không ở cuối
  trang. Đó là chỗ dễ đọc sai nhất trên màn hình: danh sách trông hệt một danh sách đánh giá giả,
  trong khi phần lớn đánh giá thật cũng nằm trong đó (khách bấm gọi lúc chưa đăng nhập thì lead ẩn
  danh và không bao giờ khớp). `hasLead` chỉ đáng tin theo **chiều dương**.

Hai cái bẫy EF đã cắn khi làm trang doanh thu, cả hai **nổ lúc chạy chứ không lúc biên dịch**:
`OrderBy` trên thuộc tính của một record vừa dựng trong `Select` không dịch được (phải sắp xếp
trên khoá nhóm, **trước** projection), và `DateTimeOffset.ToOffset` cũng không — dùng `AddHours(7)`,
giờ Việt Nam là UTC+7 cố định nên không có DST để cộng sai. Báo cáo doanh thu cũng trả **tên** khu
vực chứ không chỉ `areaId`: một danh sách GUID buộc người đọc tra ngược bằng SQL, tức báo cáo chỉ
dùng được bởi người có quyền vào thẳng DB — đúng nhóm ít cần tới nó nhất.

**Mọi quyết định duyệt của admin phải đi qua `/api/admin-verify`, không phải `/api/proxy`**
(2026-09-07). Đây là **lần thứ ba** của cùng cái bẫy `revalidatePath` mà `/api/reviews` và
`/api/ktv-media` đã ghi lại, và lần này nó ẩn lâu nhất. Triệu chứng: admin duyệt chứng chỉ xong,
trạng thái đổi thành "Đã duyệt", nhưng trang hồ sơ công khai **không hiện gì** — trang là ISR 600
giây nên vẫn phục vụ bản dựng trước đó. Đã đo trực tiếp: API `by-slug` trả về đúng chứng chỉ trong
khi HTML trang không có nó, và xoá `.next/cache/fetch-cache` thì nó hiện ra ngay.

Bốn điều đừng đảo ngược:

- **Có HAI tầng cache, và chẩn đoán bằng tay sẽ đi sai đường nếu chỉ biết một.** `fetch-cache`
  nằm trên đĩa trong container (sống qua `restart`), còn tầng thứ hai nằm **trong bộ nhớ tiến
  trình**. Hệ quả đo được: xoá thư mục `fetch-cache` rồi tải lại trang vẫn ra nội dung cũ — vì
  tầng in-memory còn giữ; và `restart` không dọn `fetch-cache` — vì nó ở trên đĩa. Mỗi cách một
  mình đều cho kết quả "vẫn hỏng", nên rất dễ kết luận nhầm rằng nguyên nhân không phải cache.
  `revalidatePath` dọn **cả hai** — đó chính là việc nó làm, và là lý do nó là cách sửa đúng chứ
  không phải một mẹo dọn dẹp.
- **Nguy hiểm hơn hai lần trước vì người thao tác và người xem là hai người khác nhau.** Ở
  `/api/reviews` và `/api/ktv-media`, ai vừa bấm cũng là người nhìn kết quả, nên họ ít nhất *biết*
  có gì đó không ổn. Ở đây admin thấy "Đã duyệt" còn KTV mở hồ sơ mình không thấy gì — không ai ở
  vị trí nhìn thấy mâu thuẫn, nên nó chỉ lộ ra khi có người tình cờ đối chiếu.
- **Xoá cache cho MỌI ngôn ngữ trong `LOCALES`.** Bản `/en` là đường dẫn riêng với cache riêng;
  chỉ xoá bản tiếng Việt là để một nửa số trang giữ nội dung cũ, và là nửa ít người mở nên lâu mới
  lộ. Mẫu cũ trong `ProfileMediaSection` ghim `'vi'` — đó là chỗ còn thiếu, không phải mẫu để chép.
- **Duyệt hồ sơ cũng phải xoá cache, không riêng chứng chỉ và ảnh.** Chuyển sang VERIFIED là lần
  đầu trang công khai đó tồn tại, và gỡ xuống thì nó phải biến mất — kể cả, và nhất là, với hồ sơ
  vừa bị gỡ vì nghi vấn.

CCCD **cố ý không** đi qua đường này: ảnh CCCD không bao giờ ra trang công khai, nên xoá bản dựng
sẵn của một trang SEO ở đó là trả giá mà không đổi lại được gì.

**Trang "Dịch vụ và giá" của KTV + công tắc nhận khách** (2026-09-10, `/dashboard/dich-vu`,
`PUT /ktv/profile/online`, `/api/ktv-profile`). Sáu điều đừng vô tình đảo ngược:

- **Bật/tắt nhận khách là endpoint RIÊNG, không phải một trường trong `PATCH /ktv/profile`.**
  Đường sửa hồ sơ đưa hồ sơ đã duyệt về PENDING — đúng cho việc đổi tên hay đổi khu vực, nhưng
  gộp công tắc vào đó nghĩa là **mỗi lần KTV tắt nhận khách lúc đi ngủ là một lần hồ sơ rớt khỏi
  tìm kiếm chờ admin duyệt lại**, im lặng. Đây là thao tác dùng nhiều lần mỗi ngày, không phải một
  lượt khai báo lại hồ sơ. `ApiOnlineToggleTests` canh đúng điều đó — bản "gọn hoá" sẽ làm nó đỏ.
- **Công tắc cũng KHÔNG đụng `updated_at`.** Cột đó là "hồ sơ đổi nội dung lần cuối lúc nào" và
  sitemap đọc nó làm `lastmod`. Bật/tắt trong ngày không đổi một chữ nào trên trang, nên đẩy cột
  này lên là khai với Google rằng hàng trăm trang vừa được sửa — trong khi không trang nào đổi.
  Có test canh riêng.
- **Đây là lần thứ TƯ của cái bẫy `revalidatePath`**, sau `/api/reviews`, `/api/ktv-media` và
  `/api/admin-verify`. Bảng giá và trạng thái nhận khách đều nằm trên trang hồ sơ công khai (ISR
  600 giây), nên `ServicePricingForm` gọi `/api/proxy` là sai — và nó **đã sai từ trước đợt này**.
  Thiệt hại ở đây quy thẳng ra tiền theo hai chiều: KTV hạ giá mà khách vẫn thấy giá cũ, hoặc KTV
  tăng giá mà khách gọi tới theo giá đã hết hiệu lực rồi tranh cãi ngay ở cửa nhà. Đã đo trong
  trình duyệt thật: sửa giá xong, HTML thô của **cả `/vi` lẫn `/en`** hiện giá mới ngay lập tức.
- **`/api/ktv-profile` KHÔNG nhận `path` từ client**, khác mẫu `/api/ktv-media`. Mẫu đó để phía
  gọi tự dựng đường dẫn, và đó chính là chỗ `ProfileMediaSection` ghim `'vi'` rồi bỏ quên bản
  `/en`. Ở đây route tự hỏi backend hồ sơ của token này là ai rồi lặp `LOCALES`, nên không có tham
  số nào để quên. Đổi lại là một lượt `GET` thêm — chỉ ở đường ghi, vốn hiếm hơn đường đọc rất nhiều.
- **Section bảng giá cũ ở `/dashboard/ho-so` GIỮ NGUYÊN, và cả hai nơi render chung một
  `ServicePricingForm`.** Chép form ra bản thứ hai là dựng hai bản sẽ trôi khỏi nhau, và bản lệch
  chỉ lộ ra với KTV nào tình cờ dùng đúng lối vào ít được sửa hơn — ví dụ một bản còn gọi
  `/api/proxy`, tức mất bước xoá cache ở đúng một trong hai đường.
- **Chip trạng thái ở `/dashboard` là NÚT, không phải nhãn.** Trước đợt này nó là một `<span>`
  tĩnh và **không có chỗ nào trong toàn bộ giao diện bật/tắt được `is_online`** — cùng họ với lỗi
  "endpoint không có đường vào giao diện", nhưng nặng hơn vì cả endpoint cũng chưa có. `TodoPanel`
  thì vẫn khuyên "bật đang nhận khách", tức mời KTV làm một việc không có nút nào làm được. Chỗ
  hiển thị trạng thái và chỗ đổi trạng thái phải là một.

Cố ý không cập nhật lạc quan (optimistic) ở công tắc: đây là trạng thái quyết định việc có bị gọi
lúc đang bận hay không, nên một cái nút nhảy sang "đang tắt" rồi âm thầm bật lại khi request hỏng
là kiểu sai tệ nhất — KTV rời màn hình với niềm tin là mình đã tắt. Nút hiện trạng thái *đã ghi
được*, lấy từ response của backend chứ không từ thứ vừa gửi đi.

**Checklist tiến độ hồ sơ** (2026-09-10, `ProfileChecklist`) thay hai khối cũ ở đầu
`/dashboard/ho-so`: một danh sách 3 bước tĩnh chỉ hiện khi CHƯA có hồ sơ, và `StatusBanner` chỉ
hiện khi ĐÃ có. Hai khối cùng trả lời "tôi còn thiếu gì?" ở hai nhánh loại trừ nhau thì phải tự
giữ cho khớp nhau mãi mãi. Sáu điều đừng vô tình đảo ngược:

- **Nhóm "bắt buộc" phải khớp ĐÚNG `AdminService.DecideProfileAsync`** — hiện là hai điều kiện
  (CCCD VERIFIED + cam kết đúng phiên bản), cộng bước "có hồ sơ" vốn là tiền đề của cả hai. Thêm
  một mục backend không kiểm là bắt KTV làm việc thừa rồi tin rằng mình đang bị chặn vì nó; bỏ một
  điều kiện thật ra thì hồ sơ nằm chờ vô thời hạn trong khi màn hình báo "đã xong". Đây là cùng
  một họ lỗi với "lời hứa công khai phải kiểm được ở `DecideProfileAsync`" — câu chữ UI trôi khỏi
  luật backend mà **không có gì báo đỏ**, vì không test nào đọc câu chữ.
- **Chứng chỉ hành nghề nằm ở nhóm khuyến nghị, KHÔNG phải nhóm bắt buộc.** Nó tuỳ chọn (xem mục
  riêng ở trên). Đẩy lên nhóm trên là dựng lại đúng dòng sai đã gỡ ngày 2026-09-09.
- **Bốn trạng thái, không ba**: `done` / `pending` (chờ admin) / `todo` / `problem` (bị từ chối).
  Gộp `pending` vào `done` thì KTV gửi CCCD xong thấy "3/3" sẽ tưởng hết việc và không quay lại —
  trong khi CCCD bị từ chối là chuyện có thật và cần họ gửi lại. Vì vậy bộ đếm chỉ tính `done`.
- **Nhóm khuyến nghị hiện ĐỦ 5 mục kể cả khi chưa có hồ sơ**, dù lúc đó chưa làm được mục nào.
  Bản đầu gộp chúng thành một dòng "sẽ xuất hiện sau khi tạo hồ sơ" — và dòng đó thậm chí không
  nhắc tới chứng chỉ, nên KTV mới **không thấy bước chứng chỉ tồn tại**. Checklist tồn tại để cho
  biết con đường phía trước; giấu nó với đúng người đang cân nhắc có nên bắt đầu hay không là bỏ
  đi phần lớn giá trị của nó. Khi chưa có hồ sơ, các mục chỉ mất `href` (xem gạch dưới), không
  mất chỗ đứng.
- **Ảnh gallery là mục RIÊNG, tách khỏi ảnh đại diện.** Hai thứ khác nhau ở điểm quan trọng nhất:
  avatar hiển thị ngay, ảnh gallery phải qua duyệt. Gộp một dòng thì KTV tải ảnh phòng lên, không
  thấy nó đâu trên trang công khai, và tưởng là hỏng.
- **Neo `href` chỉ gắn khi section đích thật sự tồn tại.** Các section CCCD/cam kết/ảnh/chứng chỉ
  nằm trong nhánh `{profile && ...}` của trang, nên khi chưa có hồ sơ thì `#cccd` là một link
  không đi tới đâu cả — đã bắt được trong lúc kiểm bằng mắt, không phải suy luận. Cùng lý do, link
  không hiện cạnh mục đã xong: mời người ta bấm vào chỗ không còn gì để làm.
- **`serviceCount` truyền qua prop, không gọi API lần hai.** Trang đã lấy danh sách đó cho
  `ServicePricingForm` bên dưới.
- **Dùng token `warning`, KHÔNG dùng `champagne-500` cho trạng thái chờ.** Champagne cố ý chỉ dành
  cho vị trí trả phí (thẻ VIP, huy hiệu boost) — xem comment trong `tailwind.config.ts`; mượn nó
  cho một trạng thái quy trình là làm nhoè đúng tín hiệu KTV trả tiền để có.

**Một dòng "hồ sơ đã hiển thị trên website hay chưa"** đứng đầu checklist (`LiveStatus`). Điều kiện
là **đúng một thứ**: `verification_status = 'VERIFIED'` — mệnh đề duy nhất mà cả `SearchService` lẫn
đường đọc hồ sơ công khai lọc theo. `is_online` **không** tham gia: nó chỉ là bộ lọc tuỳ chọn của
khách. Thêm bất kỳ điều kiện nào khác vào dòng này (có ảnh, có dịch vụ, có chứng chỉ) là nói với KTV
rằng họ chưa lên sàn trong khi khách đang thấy họ. Tách khỏi `StatusLine` dù cùng đọc một trường:
dòng này trả lời "tôi có đang được nhìn thấy không", dòng kia trả lời "tôi còn phải làm gì" — người
vào kiểm tra nhanh chỉ cần vế đầu và phải đọc được trong một nhịp.

**Ảnh đại diện phải qua duyệt** (2026-09-10, `pending_avatar_key` + `/admin/duyet-anh-dai-dien`).
Đảo lại quyết định cũ "avatar hiện ngay". Lý do cũ có hai vế và **một vế đã sai từ lâu**: "avatar
nằm trong tầm mắt admin ở chính trang duyệt hồ sơ" chỉ đúng với hồ sơ mới — hồ sơ **đã VERIFIED**
đổi avatar bất cứ lúc nào và không lượt nào lọt vào mắt ai, tức đúng cái lỗ mà việc duyệt ảnh
gallery đã bịt từ đầu, chỉ khác là nó nằm ở tấm ảnh lớn nhất trên trang công khai. Bảy điều đừng
vô tình đảo ngược:

- **HAI cột, không phải một cột kèm cờ trạng thái.** `avatar_key` giữ ảnh **đang hiển thị** (bất
  biến: chỉ chứa ảnh đã duyệt), `pending_avatar_key` giữ ảnh chờ. Một cột thì hồ sơ đã duyệt đổi
  ảnh là mất hiển thị vài giờ, và KTV sẽ học được rằng đừng bao giờ đổi ảnh — tức tính năng tự vô
  hiệu hoá chính nó. Bị từ chối cũng không mất gì: ảnh cũ vẫn ở đó.
- **Mọi đường ghi của KTV vào `pending_avatar_key`.** Ghi thẳng vào `avatar_key` từ đường KTV là
  mở lại đúng lỗ hổng vừa bịt. `ApiAvatarModerationTests` canh chính điều đó.
- **Duyệt hồ sơ thì duyệt kèm avatar đang chờ** (`DecideProfileAsync`, chỉ chiều sang VERIFIED).
  Đây là vế **đúng** của quyết định cũ được giữ lại: admin vừa xem CCCD và toàn bộ hồ sơ, avatar
  nằm ngay trước mắt — bắt nó đi vòng qua hàng đợi riêng nghĩa là hồ sơ vừa duyệt xong lên sàn mà
  không có ảnh. **Từ chối hồ sơ không đụng tới avatar**: hai quyết định độc lập.
- **`avatar_verify_status` NULL nghĩa là "không có ảnh nào đang chờ"**, không phải PENDING. Mặc
  định PENDING sẽ đưa mọi hồ sơ chưa từng tải ảnh vào hàng đợi admin vĩnh viễn — không có gì để
  duyệt và không cách nào dọn. CHECK `chk_ktv_pending_avatar_pair` chặn ca ngược lại (PENDING mà
  không có ảnh), thứ lọt vào hàng đợi thành một ô trống.
- **Gỡ ảnh xoá CẢ HAI cột.** Chỉ xoá bản đang hiển thị sẽ để một ảnh chờ sống sót rồi tự lên sàn
  khi admin duyệt — ảnh KTV đã chủ động gỡ lại xuất hiện, muộn vài giờ, không ai hiểu vì sao.
- **Hàng đợi riêng, tách khỏi `/admin/duyet-anh`** (ảnh gallery), và thẻ hiện **cả hai ảnh** cạnh
  nhau: quyết định ở đây là "có nên thay tấm bên phải bằng tấm bên trái không", nhìn riêng tấm mới
  là thiếu đúng vế so sánh. Kèm mục sidebar — thiếu là quay lại đúng lỗi "endpoint không có đường
  vào giao diện" đã cắn bốn lần.
- **Đường GỬI avatar không xoá cache ISR, đường GỠ thì có.** Gửi không đổi một pixel nào trên trang
  công khai (ảnh cũ vẫn hiển thị) nên xoá cache ở đó là dựng lại một trang SEO mà không đổi lại
  được gì; gỡ thì ảnh biến mất thật. Cache được xoá đúng chỗ nó cần: lúc admin duyệt, qua
  `/api/admin-verify`.

Cùng đợt **sửa một bug đã ghi trong tài liệu mà chưa ai sửa**: `/api/ktv-media` nhận nguyên đường
dẫn từ client, và `ProfileMediaSection` ghim `'vi'` — nên bản `/en` không bao giờ được xoá cache.
Nay route tự lặp `LOCALES` (dùng `stripLocale`), client chỉ nói **có cần xoá hay không**.

**Nút đặt lịch ở cột phải bỏ tên KTV** (2026-09-10, `contact.callName`). Trước đó là "Đặt lịch với
{name}" / "Book {name}", nay là "Đặt lịch" / "Book now". Ba điều đừng vô tình đảo ngược:

- **Khách đang đứng trên trang hồ sơ của đúng người đó** — tên đã ở tiêu đề ngay phía trên, nhắc
  lại trong nút chỉ đẩy chữ xuống hai dòng ở khối cột phải hẹp và làm hai nút cạnh nhau lệch hẳn
  chiều rộng.
- **Nút Zalo GIỮ NGUYÊN.** Đây chỉ là đổi câu chữ; cả hai nút vẫn đứng cạnh nhau ở cột phải lẫn
  thanh dính đáy mobile.
- **Thanh đáy mobile vẫn là "Đặt lịch ngay"** (`contact.callNow`), cố ý khác nhãn cột phải: ở đó nút
  tách khỏi mọi ngữ cảnh khác nên một từ thúc giục còn chỗ đứng.

`firstName` vẫn được tính và vẫn dùng — nhưng chỉ cho `contact.phoneRevealed` ("Số điện thoại của
Mai"), đúng chỗ tên thật sự cần vì lúc đó khách sắp lưu số vào danh bạ.

**Token của tài khoản đã bị xoá nay trả 401, không phải 500** (2026-09-10, `OnTokenValidated` trong
`Program.cs`). Phát hiện từ một lỗi thật: trang duyệt ảnh báo "Đã có lỗi xảy ra, vui lòng thử lại"
và log server chỉ có `ktv_photos_verified_by_fkey`. Nguyên nhân: JWT **không thu hồi được** — chữ ký
vẫn hợp lệ và còn hạn sau khi tài khoản biến mất, nên mọi request đi tiếp bình thường rồi vỡ ở tận
khoá ngoại `verified_by` dưới DB. Ba điều đáng nhớ:

- **Ràng buộc DB đã làm đúng việc của nó** — không hàng nào ghi sai. Thứ hỏng chỉ là *cách báo lỗi*:
  một 500 kèm câu chung chung không nói được gì cho người thao tác, trong khi việc họ cần làm là
  đăng nhập lại. Đây là kịch bản production thật: admin bị thu hồi quyền hoặc tài khoản bị xoá.
- **Dùng `TryGetUserId()`, KHÔNG `GetUserId()`** trong handler này: bản kia ném lỗi khi claim hỏng,
  và một exception ở đây thành 500 — đúng thứ đoạn code đó sinh ra để loại bỏ.
- Cái giá là **một truy vấn theo khoá chính mỗi request đã xác thực**. Đường công khai
  (`AllowAnonymous`) không đi qua handler này nên các trang SEO không chịu chi phí đó.

Backfill: 2 avatar đang có được coi là **đã duyệt** — chúng đã hiển thị công khai từ trước và admin
đã nhìn thấy chúng ở trang duyệt hồ sơ. Đẩy ngược vào hàng chờ là phạt người dùng cũ vì một thay
đổi nội bộ họ không gây ra.

Đã kiểm chứng trong trình duyệt thật (2026-09-10) đủ năm trạng thái của nhóm bắt buộc: chưa có hồ
sơ (0/3), vừa tạo hồ sơ (1/3), CCCD chờ duyệt + đã cam kết (**2/3**, không phải 3/3), CCCD bị từ
chối (hiện đúng lý do admin nhập), và đã duyệt (3/3, giữ nguyên URL công khai + cảnh báo "sửa sẽ
phải duyệt lại" của `StatusBanner` cũ). Nhóm khuyến nghị kiểm ca hỗn hợp: 1 ảnh gallery đã duyệt
+ 1 chờ duyệt, 2 khu vực, chứng chỉ ở cả ba trạng thái. Neo nhảy đúng section, không lỗi console.

**Ảnh được nén ở trình duyệt trước khi gửi** (2026-09-11, `lib/image-compress.ts`). Sửa một lỗi
khiến KTV dùng điện thoại **không tải được ảnh nào lên** — cả ảnh hồ sơ lẫn ảnh CCCD, tức chặn
luôn đường duyệt hồ sơ. Ba lỗi chồng lên nhau, và lỗi thứ ba là thứ làm hai lỗi kia vô hình:

- **Ảnh camera gần như luôn vượt hạn mức 3MB.** Máy hiện tại cho ra 2–5MB mỗi tấm ở kích thước
  gốc, nên nhánh "vượt quá 3MB" không phải ca biên mà là **đường đi mặc định** của mọi KTV chụp
  bằng điện thoại. Nay `compressImage` resize cạnh dài về 1600px và xuất JPEG q0.82 trước khi
  gửi — đo trong trình duyệt thật: ảnh nhiễu 4000×3000 **11,61MB → 665KB (giảm 94%)**, mà ảnh
  nhiễu là ca xấu nhất cho JPEG nên ảnh chụp thật còn nhỏ hơn.
- **`accept` lọc theo đuôi file nên iOS làm mờ toàn bộ ảnh chụp.** Ảnh iPhone mặc định là HEIC;
  thiếu `.heic`/`.heif` trong `accept` thì trình chọn ảnh của iOS **không cho bấm tấm nào**, không
  kèm thông báo nào. Phải kê chúng **dù backend không nhận HEIC** — `accept` là bộ lọc của trình
  chọn file, chạy trước khi code của ta thấy file. Kèm `image/*` để bắt các đuôi lạ của Android.
- **Thông báo lỗi nằm ngoài màn hình, cách nút vừa bấm vài màn hình cuộn.** `ProfileMediaSection`
  render error/done **một lần ở đỉnh khối**, trong khi nút "Thêm ảnh" nằm cuối khối thứ hai. KTV
  bấm chọn ảnh, ảnh bị chặn, và màn hình **không đổi một pixel nào** ở chỗ họ đang nhìn — đọc
  đúng như nút bị hỏng. Nay `feedbackFor(key)` hiện thông báo ngay dưới đúng nút vừa bấm, tách
  riêng avatar và gallery.

Bốn quyết định trong `compressImage` đừng vô tình đảo ngược:

- **Nén ở client là tiện lợi, KHÔNG phải ràng buộc.** `UploadService.SaveAsync` vẫn kiểm cỡ file
  và vẫn kiểm **đuôi ↔ MIME phải khớp nhau** — đừng nới lỏng vế đó ở server vì "đã nén ở client":
  người gửi thẳng vào API không đi qua trình duyệt nào cả. Vì cùng lý do đó, đổi đuôi sang `.jpg`
  sau khi nén là **bắt buộc**, không phải thẩm mỹ: một blob `image/jpeg` mang tên `IMG_1234.HEIC`
  vẫn bị 400, và câu lỗi đọc như thể việc nén đã không xảy ra.
- **Hàm không bao giờ ném lỗi.** Ảnh không giải mã được, canvas bị chặn (chế độ chống
  fingerprint), `toBlob` trả null — mọi ca đều trả **file gốc** để lượt gửi đi tiếp và backend là
  bên quyết định. Ném ở đây là đổi một tối ưu lấy một tính năng hỏng hẳn trên trình duyệt lạ.
  Cũng trả file gốc khi bản nén **không nhỏ hơn**: đã đo, ảnh 200×200 cho ra bản "nén" lớn hơn
  đúng 1 byte.
- **JPEG chứ không WebP**, dù WebP nhỏ hơn: Safari cũ âm thầm rơi về PNG khi không xuất được
  WebP, mà PNG của một tấm ảnh chụp còn **nặng hơn bản gốc** — "nén" xong lại vượt hạn mức, im
  lặng. Định dạng lưu trữ không phải chỗ cần tối ưu: `next/image` đã chuyển sang AVIF/WebP ở
  đường đọc (xem mục `sharp`).
- **Tô nền trắng trước khi vẽ.** PNG trong suốt sang JPEG mà không tô nền ra nền **đen** — đã đo
  cả hai chiều: không tô cho `rgb(0,0,0)`, có tô cho `rgb(255,255,255)`. Nền đen trông như ảnh
  hỏng chứ không như một lựa chọn.

Hệ quả về câu chữ: **đừng quảng cáo hạn mức MB trên giao diện nữa.** Cả ba khối đã đổi sang "ảnh
chụp bằng điện thoại được tự động nén, không cần lo dung lượng" — nêu một con số người dùng không
còn chạm tới chỉ khiến họ đi nén ảnh bằng tay một cách vô ích. Cùng lý do, preview CCCD bỏ dòng
hiện dung lượng: sau nén con số đó là của bản gốc, đặt cạnh chữ "tự động nén" thành hai lời khai
mâu thuẫn.

**Không tăng `MaxImageSizeMb` để "sửa" lỗi này.** Đã cân nhắc và bác: nó không sửa được nguyên
nhân nào trong ba nguyên nhân trên (HEIC vẫn bị chặn, lỗi vẫn vô hình), chỉ dời ngưỡng — trong khi
ảnh hồ sơ nằm trên đường đọc SEO và mỗi MB thừa là LCP chậm thêm cho khách 3G, đúng điều comment
ở `UploadOptions.MaxImageSizeMb` đã ghi.

Đã kiểm chứng trong trình duyệt thật (2026-09-11): bundle trong container thật sự chứa chuỗi
`accept` mới và `createImageBitmap` (grep trong container, không tin dòng "Built" — xem bẫy ở mục
R2); nén 11,61MB → 665KB; PDF chứng chỉ **không** bị đưa qua canvas; ảnh nhỏ giữ nguyên bản gốc;
đổi tên đúng cả 6 ca kể cả `.heic` trần → `anh.jpg` và tên nhiều dấu chấm; 0 lỗi console.
Typecheck, ESLint và `next build` đều xanh. **Chưa kiểm trên iOS thật** — ca "thư viện ảnh iPhone
không còn làm mờ" và ca giải mã file HEIC thật chỉ thiết bị thật trả lời được.

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

**Đăng nhập bằng số điện thoại + mật khẩu** (2026-09-07, `POST /auth/register`, `POST /auth/login`,
`PATCH /auth/password`). Đây là lối vào **đang dùng**: Zalo ZNS đòi giấy phép kinh doanh mà dự án
chưa có, nên đường OTP tuy còn nguyên ở backend nhưng không dùng được với người thật. Chín điều
đừng vô tình đảo ngược:

- **Backend OTP giữ nguyên, chỉ gỡ khỏi UI.** `ApiFactory.LoginAsync` đăng nhập qua OTP cho **toàn
  bộ** integration suite, và bật lại khi có giấy phép chỉ là trả UI về. `LoginForm.tsx` (bản OTP,
  còn đủ `CodeInput`/`ResendTimer`) vẫn nằm cạnh `PasswordAuthForm.tsx`, tạm thời không route nào
  render — xoá là mất hết những quyết định đã ghi trong comment ở đó.
- **Không thêm cột `password_hash`**: nó có sẵn từ migration init và chưa từng được dùng. Migration
  `AddUserLoginLockout` chỉ thêm `failed_login_attempts` + `locked_until`.
- **Khoá tài khoản là bắt buộc, không phải tuỳ chọn.** OTP tự có trần thử cho từng mã
  (`OtpCode.Attempts`); mật khẩu không có gì tương đương, nên thiếu hai cột đó thì `/auth/login` là
  endpoint dò mật khẩu không giới hạn. 5 lần sai → khoá 15 phút, đăng nhập thành công reset về 0.
- **Rate limit `auth` và khoá tài khoản chặn hai thứ khác nhau**: khoá chặn dò **một** tài khoản,
  rate limit chặn quét **nhiều** tài khoản từ một nguồn. Vì `/auth/login` luôn ẩn danh nên nó chỉ
  phân vùng theo IP — `ForwardedHeaders` sau reverse proxy nay là **điều kiện để policy có tác
  dụng**, không còn là ghi chú vận hành.
- **Sai mật khẩu và số chưa đăng ký phải trả về response giống hệt nhau** — cùng 401, cùng câu chữ.
  Và tài khoản không tồn tại **vẫn phải chạy một lượt BCrypt.Verify với hash giả**
  (`PasswordHasher.DummyHash`): BCrypt cố ý chậm, nên thoát sớm khiến số chưa đăng ký trả lời nhanh
  hơn hẳn, tức dò được số nào có tài khoản chỉ bằng đồng hồ bấm giờ. Đã đo: 0,53s và 0,61s.
- **Đăng ký khi số đã có tài khoản → 409, kể cả tài khoản đó chưa đặt mật khẩu.** Cho ghi đè là
  biến trang đăng ký thành đường chiếm tài khoản OTP của người khác chỉ bằng việc biết số của họ.
  Người ở tình huống đó đặt mật khẩu qua `PATCH /auth/password` sau khi đăng nhập.
- **Đăng nhập và đăng ký là hai trang tách biệt**, khác hẳn OTP. Với OTP hai thao tác là một; với
  mật khẩu thì hệ thống không biết người gõ sai là ai, nên gộp lại sẽ hoặc phải lộ "số này đã có
  tài khoản", hoặc trả một câu lỗi không nói được gì. Ba cửa: `/dang-nhap` (chung), `/dang-ky`
  (khách), `/dang-ky-ktv` (KTV, kèm cột bán hàng).
- **`safeNext` nằm ở `lib/session.ts`**, không phải hàm local trong từng page — nay có ba trang cần
  nó, và một bản chép tay là đúng cách một trong các bản lệch đi rồi mở lại open redirect ở nửa
  không ai kiểm.
- **`GET /auth/me` trả `hasPassword`, không trả hash.** Trang `/tai-khoan` dùng cờ đó để quyết định
  hỏi hay không hỏi mật khẩu hiện tại: tài khoản tạo bằng OTP chưa có cái nào, bắt nó điền là khoá
  luôn lối duy nhất để nó đặt được mật khẩu.

**Chưa làm, và cố ý: quên mật khẩu.** Kênh reset khả thi duy nhất là OTP hoặc email, cả hai chưa
chạy. Admin reset bằng SQL — `UPDATE users SET password_hash = NULL, locked_until = NULL WHERE
phone = '0...'` rồi người dùng tự đặt lại ở `/tai-khoan`. Cũng cố ý: **không xác thực số điện thoại
lúc đăng ký** (`phone_verified_at` để NULL) vì chưa có cách nào làm được; chốt chặn thật với KTV vẫn
nguyên ở đường duyệt hồ sơ + CCCD.

Lưu ý vận hành hiện tại:

- **OTP mặc định vẫn ở chế độ stub** (`Otp:StubEnabled=true`): mã trả thẳng trong response và ghi
  log. Adapter gửi thật là **Zalo ZNS** — xem mục riêng bên dưới. Đường OTP hiện **không có lối vào
  trên giao diện**; xem mục đăng nhập bằng mật khẩu bên trên.
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
