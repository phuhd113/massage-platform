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

Phần Phase 3 còn lại: Hangfire (`promotion:expire`, sweep, `wallet:reconcile`, `hold:cleanup`),
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
