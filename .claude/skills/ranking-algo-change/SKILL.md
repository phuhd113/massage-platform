---
name: ranking-algo-change
description: Guardrail khi sửa công thức Ranking Score, trọng số xếp hạng KTV, hoặc luồng cache Redis GEO/ZSET của nền tảng massage marketplace — bảo vệ mô hình doanh thu (gói trả phí luôn thắng hạng) và nguyên tắc Postgres là source of truth. Dùng skill này bất cứ khi nào bạn chạm tới logic xếp hạng, thứ tự kết quả tìm kiếm, trọng số rating/khoảng cách/boost, chỉ mục Redis GEO, sorted set điểm số, hoặc khi người dùng nói "KTV này nên hiện lên trước", "sửa thuật toán search", "tối ưu tìm kiếm theo khu vực".
---

# Sửa thuật toán xếp hạng & cache tìm kiếm

Thứ hạng tìm kiếm ở đây không chỉ là trải nghiệm — **nó chính là sản phẩm đang được bán**. KTV trả tiền để đổi lấy vị trí. Một thay đổi trọng số tưởng vô hại có thể khiến gói VIP mất giá trị, hoặc ngược lại, khiến kết quả tìm kiếm toàn KTV trả phí ở xa và chất lượng kém — cả hai đều làm hỏng nền tảng theo hướng khó phát hiện sớm.

## Cấu trúc điểm số phải giữ nguyên

```
FinalScore = BoostPoints (rời rạc, theo hạng gói)  +  BaseScore (liên tục, 0–100)
```

Hai thành phần này **cố ý tách biệt** và không được trộn lẫn:

- **BoostPoints** rời rạc và cách nhau đủ xa (VIP Pin +500, Instant Boost +300, Featured Badge +150) để một KTV trả phí luôn đứng trên toàn bộ KTV không trả phí. Đây là lời hứa thương mại với người mua gói.

  > Featured Badge từng là +50 và **không** giữ được lời hứa đó — nhỏ hơn dải BaseScore nên KTV miễn phí điểm nền cao vẫn vượt lên. Nâng lên 150 ngày 2026-09-01. Bài học: khi kiểm khoảng cách, phải kiểm **cả bậc từ hạng thấp nhất xuống 0**, không chỉ khoảng cách giữa các hạng trả phí với nhau. Đó là bậc bị bỏ sót.
- **BaseScore** liên tục (rating 0.40 + khoảng cách 0.35 + tỉ lệ phản hồi 0.15 + độ mới hoạt động 0.10) và chỉ quyết định thứ tự **bên trong cùng một hạng** — VIP so với VIP, organic so với organic.

Khi cần chỉnh, hãy chỉnh **trong** một trong hai thành phần, đừng làm mờ ranh giới giữa chúng:

- [ ] Khoảng cách giữa **mọi cặp hạng liền kề** vẫn lớn hơn dải giá trị tối đa của BaseScore (100), **tính cả bậc từ hạng thấp nhất xuống 0** (KTV không mua gói) — nếu không, một KTV organic điểm cao có thể vượt KTV trả phí, phá vỡ cam kết bán hàng. Chạy `PackageTypes.TierGapsAreValid()`, đừng nhẩm bằng mắt
- [ ] Nếu đổi điểm của một hạng theo hướng **có lợi** cho người mua, cân nhắc backfill `campaigns.boost_points` cho campaign còn ACTIVE — cột đó sao chép lúc mua, không backfill thì hai KTV cùng giữ một gói giống hệt nhau lại xếp hạng khác nhau
- [ ] Trọng số BaseScore vẫn cộng lại bằng 1.0
- [ ] Mọi thành phần vẫn được chuẩn hoá về 0–1 trước khi nhân trọng số (rating chia 5, khoảng cách chia bán kính tìm kiếm)
- [ ] Rating dùng làm mượt kiểu Bayesian khi `rating_count` thấp — nếu không, một KTV có đúng 1 review 5 sao sẽ vượt KTV có 200 review 4.8 sao

## Postgres là source of truth, Redis chỉ là cache

Đây là ranh giới dễ bị xói mòn nhất theo thời gian: thêm một trường vào Redis "cho tiện", rồi vài tháng sau không ai biết dữ liệu thật nằm ở đâu.

- [ ] Không có trạng thái nào **chỉ** tồn tại trong Redis — mọi thứ trong `ranking:{cityId}`, `boost:{ktv_id}`, `listings:active:{cityId}` đều tái tạo được từ Postgres
- [ ] Cập nhật theo kiểu **write-through**: nghiệp vụ ghi Postgres xong thì cập nhật Redis ngay, không đợi TTL
- [ ] TTL (5–10 phút) chỉ là lưới an toàn tự phục hồi khi có sự kiện bị lỡ, **không phải** cơ chế cập nhật chính — nếu thấy mình dựa vào TTL để dữ liệu đúng, luồng write-through đang thiếu ở đâu đó
- [ ] Có đường fallback: Redis miss hoặc chết → query PostGIS trực tiếp (`ST_DWithin`) và warm lại cache. Kết quả có thể chậm hơn nhưng phải **đúng**
- [ ] Có script/job rebuild toàn bộ index Redis từ Postgres, đã test chạy được

## Boost phải phản ứng tức thì

"Instant Hourly Boost" là gói bán theo khung giờ — nếu boost mất 5 phút mới có hiệu lực, KTV mất phần đáng kể thứ họ đã trả tiền.

- [ ] Khi campaign chuyển sang ACTIVE → `boost:{ktv_id}` được ghi ngay trong luồng đó, không đợi cron
- [ ] Khi campaign hết hạn → boost bị xoá ngay; cron sweep mỗi phút chỉ là lưới an toàn bắt các job bị lỡ do worker crash
- [ ] Độ lệch giữa thời điểm hiệu lực thực tế và `start_at`/`end_at` < 5 giây

## Hiệu năng

- [ ] Đường tìm kiếm chính vẫn đọc từ Redis, không phải PostGIS (PostGIS là fallback)
- [ ] Số candidate lấy về từ `GEOSEARCH` có giới hạn hợp lý trước khi merge điểm — không kéo cả nghìn KTV về app rồi mới sort
- [ ] p95 latency API search vẫn trong ngưỡng mục tiêu sau thay đổi; đo lại, đừng suy đoán

## Trước khi merge: kiểm chứng bằng dữ liệu, không bằng trực giác

Thay đổi xếp hạng ảnh hưởng tới doanh thu, nên cần bằng chứng:

- [ ] Chạy thử công thức mới trên tập truy vấn mẫu (vài khu vực đông và vài khu vực thưa KTV), so sánh top-10 trước/sau
- [ ] Khẳng định: trong mọi khu vực mẫu, không có KTV organic nào vượt lên trên KTV đang có gói VIP Pin còn hiệu lực
- [ ] Khẳng định: khu vực thưa KTV không trả về danh sách rỗng do trọng số khoảng cách quá gắt
- [ ] Nếu thay đổi làm giảm khả năng hiển thị của nhóm KTV nào đó, nêu rõ điều này với người dùng trước khi merge — đó là quyết định kinh doanh, không phải quyết định kỹ thuật
