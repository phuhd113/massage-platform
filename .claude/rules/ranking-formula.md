# Kiến trúc — Công thức xếp hạng (Phase 2+)

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
