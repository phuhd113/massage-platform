# Sinh lại `vietnam-areas.json`

Dữ liệu 63 tỉnh / 696 quận-huyện / 10.051 phường-xã theo **cơ cấu hành chính trước
sáp nhập 2025**. Chọn cơ cấu cũ có chủ đích: URL `/massage-tan-noi/{tinh}/{quan}`
đã được index và từ khoá kiểu "massage tại nhà Quận 7" là kênh acquisition chính.

```bash
curl -sL "https://provinces.open-api.vn/api/?depth=3" -o vn-raw.json
node generate.js          # ghi ../../src/Massage.Api/Data/SeedData/vietnam-areas.json
```

`generate.js` tự kiểm các bất biến mà DB sẽ ép (`uq_area_root_slug`,
`uq_area_parent_slug`, `uq_area_level_code`) và **thoát khác 0 nếu vi phạm** — bắt ở
đây thì thấy tên khu vực cụ thể, bắt lúc seed chỉ thấy mã lỗi 23505.

## Toạ độ tâm khu vực

`vietnam-area-centroids.json` sinh riêng, từ **nguồn khác**: `provinces.open-api.vn`
không có hình học, nên centroid lấy từ polygon cấp 2 của GADM 4.1.

```bash
curl -sL "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_VNM_2.json.zip" -o gadm2.zip
unzip -o gadm2.zip && node centroids.js
```

GADM cũng theo **cơ cấu trước sáp nhập** — đúng cơ cấu mà file danh mục cố ý giữ.
Nhưng nó **không mang mã GSO** (`CC_2` toàn `"NA"`), nên khớp phải dựa vào tên: GADM
viết dính liền không dấu cách (`"AnPhú"`) và bỏ tiền tố loại đơn vị. Chuỗi khớp vì vậy
bỏ hết dấu gạch và thử cả bản có/không tiền tố — được 685/696 quận.

11 quận còn lại nằm trong `DISTRICT_OVERRIDE`, **mỗi dòng có lý do riêng** và phần lớn
là chênh lệch thời điểm chụp thật (GADM chụp 2022): Nghi Sơn/Phú Mỹ là huyện cũ vừa
lên thị xã, Quảng Hoà và Long Đất là hai huyện nhập lại, Chũ mới tách năm 2024, Huế
tách làm hai quận năm 2025. Hai huyện đảo Hoàng Sa và Trường Sa **cố ý để NULL**: GADM
không có polygon cho chúng, và toạ độ đoán sẽ hút mọi khách ven biển miền Trung về một
huyện không có KTV nào.

Script **thoát khác 0** khi có quận không khớp hoặc khi toạ độ rơi ra ngoài khung
102–110°E / 8–24°N. Vế thứ hai canh đúng một lỗi: đảo `lon`/`lat` cho ra điểm giữa Ấn
Độ Dương mà vẫn là số hợp lệ, và cột này chỉ máy đọc nên sẽ không ai nhìn thấy.

**Nếu đổi nguồn hoặc đổi cách khớp, kiểm lại hai con số 694/696 và 63 tỉnh trước.**

## Đã đối chiếu chéo (2026-09-03)

`kenzouno1/DiaGioiHanhChinhVN` là nguồn độc lập thứ hai: **63 tỉnh và toàn bộ 696 mã
quận/huyện khớp tuyệt đối**. Cấp phường lệch 26/11 trên ~10.050 dòng (0,3%) do khác
thời điểm chụp — chấp nhận được vì phường chỉ dùng làm nhãn địa chỉ, không có trang
SEO, không vào `coverage_areas`, không dính slot quảng cáo.

**Nếu đổi nguồn, kiểm lại đúng ba con số 63 / 696 / ~10.000 trước.** Một dataset lỡ
dùng cơ cấu 34 tỉnh sau sáp nhập sẽ phá đúng những URL mà lựa chọn này sinh ra để giữ.

## Hai chỗ phải tự tay xử lý

**`SLUG_OVERRIDE`** — ba slug đang chạy khác slug mà tên chuẩn của dataset sinh ra:

| Đang chạy (đã index) | Dataset sinh ra |
|---|---|
| `tp-ho-chi-minh` | `thanh-pho-ho-chi-minh` |
| `ha-noi` | `thanh-pho-ha-noi` |
| `tp-thu-duc` | `thanh-pho-thu-duc` |

Giữ slug cũ, chỉ lấy `code`/`name`. Khoá override theo `code` chứ không theo tên.

**Hậu tố mã cho slug phường trùng nhau** — 23 cặp phường khác nhau thật sự đụng slug
trong cùng quận sau khi bỏ dấu ("Sa Pa" / "Sa Pả", "Hoằng Phú" / "Hoằng Phụ", "Nậm
Cắn" / "Nậm Càn"). Dữ liệu không sai; slug mới là thứ không đủ phân biệt. Bản xuất
hiện sau lấy thêm mã GSO làm hậu tố. Mã là bất biến của dataset nên slug ổn định qua
mọi lần seed lại — **đừng đổi sang đánh số thứ tự**, thứ tự phụ thuộc thứ tự duyệt.
