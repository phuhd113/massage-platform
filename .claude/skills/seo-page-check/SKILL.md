---
name: seo-page-check
description: Checklist audit SEO bắt buộc cho mọi trang public mới hoặc được sửa trên frontend Next.js của nền tảng massage marketplace — trang tìm kiếm, hồ sơ KTV, landing theo khu vực/dịch vụ. Kiểm tra SSR/ISR, structured data schema.org, meta tag theo địa danh, canonical cho biến thể filter, noindex chống thin content, và Core Web Vitals. Dùng skill này bất cứ khi nào bạn tạo hoặc sửa một route/page hiển thị cho khách hàng (không phải dashboard KTV hay admin), khi người dùng nhắc tới SEO, thứ hạng Google, traffic organic, hoặc khi thêm trang danh sách theo quận/huyện/tỉnh thành.
---

# Audit SEO cho trang public

SEO là kênh acquisition chính của dự án: người tìm "massage tại nhà Quận 7" là khách có ý định mua ngay, và CPC quảng cáo cho nhóm từ khoá này rất đắt. Mỗi trang public là một cửa vào từ Google — trang làm ẩu không chỉ không lên hạng, mà còn kéo đánh giá chất lượng của cả tên miền xuống.

Chạy checklist này trước khi coi một trang là xong.

## 1. Rendering — không bao giờ client-render thuần

- [ ] Trang render ở server (SSR hoặc ISR), nội dung chính có mặt trong HTML trả về lần đầu
- [ ] Kiểm chứng bằng cách xem HTML thô (`curl` hoặc View Source), **không** phải DevTools Elements — DevTools hiển thị DOM sau khi JS chạy nên luôn trông có vẻ ổn
- [ ] Danh sách KTV, mô tả khu vực, rating đều nằm trong HTML đầu tiên; chỉ phần filter/tương tác mới là client component
- [ ] Trang khu vực dùng ISR với `revalidate` ngắn (60–300s) — vừa mới, vừa không tra DB mỗi request

## 2. Metadata

- [ ] `title` duy nhất theo địa danh + dịch vụ, ~50–60 ký tự (vd: `Massage trị liệu tại nhà Quận 7 | 24 KTV có chứng chỉ`)
- [ ] `description` ~150–160 ký tự, viết cho người đọc chứ không nhồi từ khoá
- [ ] Không có hai trang nào dùng chung title/description — trùng lặp khiến Google gộp trang và bỏ index bớt
- [ ] Có Open Graph + Twitter Card (dịch vụ này được chia sẻ nhiều qua Zalo/Facebook)
- [ ] Có `<link rel="canonical">` trỏ về URL chuẩn

## 3. Structured data (schema.org)

| Trang | Schema |
|---|---|
| Hồ sơ KTV | `Service` hoặc `ProfessionalService` + `AggregateRating` + `Review` |
| Landing khu vực | `BreadcrumbList` + `ItemList` cho danh sách KTV |
| Trang chủ | `Organization` + `WebSite` kèm `SearchAction` |

- [ ] `AggregateRating` chỉ dùng dữ liệu review **thật**. Đánh dấu rating không có review thật là vi phạm chính sách Google, dẫn tới mất toàn bộ rich result của tên miền — rủi ro lớn hơn nhiều so với lợi ích ngắn hạn.
- [ ] Kiểm tra bằng Rich Results Test trước khi lên production

## 4. Chống thin & duplicate content — rủi ro lớn nhất của mô hình này

Mô hình `khu-vực × dịch-vụ` sinh ra hàng nghìn tổ hợp URL. Nếu để Google index toàn bộ, phần lớn sẽ là trang gần như trống hoặc giống hệt nhau — Google gọi đây là doorway page và phạt cả tên miền.

- [ ] Trang khu vực chỉ được `index` khi có **đủ số KTV tối thiểu** (đề xuất ≥3) **và** có nội dung biên tập riêng (giới thiệu khu vực, lưu ý chọn KTV, FAQ riêng)
- [ ] Trang khu vực thưa dữ liệu → `noindex, follow` (giữ luồng link equity, mở index lại khi đủ dữ liệu)
- [ ] Mọi biến thể do filter/sort (`?sort=`, `?price=`, `?page=`) có canonical trỏ về URL gốc
- [ ] Nội dung mô tả khu vực **không** copy-paste giữa các quận/huyện chỉ thay tên

## 5. URL & internal linking

- [ ] URL đọc được, tiếng Việt không dấu, phân cấp theo địa danh: `/massage-tai-nha/{tinh-thanh}/{quan-huyen}`, `/ktv/{slug}-{id}`
- [ ] Có breadcrumb hiển thị **và** đánh dấu `BreadcrumbList`
- [ ] Có link hai chiều: khu vực ↔ khu vực lân cận, khu vực ↔ dịch vụ, hồ sơ KTV ↔ trang khu vực của họ
- [ ] Trang mới đã nằm trong `sitemap.xml` động

## 6. Core Web Vitals (ưu tiên mobile)

Traffic dịch vụ tại nhà chủ yếu từ điện thoại, nên đo bằng cấu hình mobile:

- [ ] Ảnh dùng `next/image` (AVIF/WebP), có `width`/`height` cố định cho avatar KTV để tránh layout shift
- [ ] Ảnh dưới fold lazy-load; ảnh hero trong viewport dùng `priority`
- [ ] JS chặn render tối thiểu — phần tương tác tách thành client component nhỏ, không kéo cả trang thành client
- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms trên PageSpeed Insights (mobile)

## 7. Chặn crawl đúng chỗ

- [ ] `robots.txt` chặn `/dashboard`, `/admin`, `/api`; cho phép mọi trang public
- [ ] Trang cần đăng nhập không rò rỉ vào sitemap
