# Sinh lại `vietnam-areas.json`

Dữ liệu 63 tỉnh / 696 quận-huyện / 10.051 phường-xã theo **cơ cấu hành chính trước
sáp nhập 2025**. Chọn cơ cấu cũ có chủ đích: URL `/massage-tai-nha/{tinh}/{quan}`
đã được index và từ khoá kiểu "massage tại nhà Quận 7" là kênh acquisition chính.

```bash
curl -sL "https://provinces.open-api.vn/api/?depth=3" -o vn-raw.json
node generate.js          # ghi ../../src/Massage.Api/Data/SeedData/vietnam-areas.json
```

`generate.js` tự kiểm các bất biến mà DB sẽ ép (`uq_area_root_slug`,
`uq_area_parent_slug`, `uq_area_level_code`) và **thoát khác 0 nếu vi phạm** — bắt ở
đây thì thấy tên khu vực cụ thể, bắt lúc seed chỉ thấy mã lỗi 23505.

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
