---
name: wallet-tx-review
description: Checklist rà soát bắt buộc cho mọi thay đổi code chạm tới ví KTV, giao dịch tiền, gói đẩy tin, campaign hay cấp phát slot quảng cáo — kiểm tra idempotency, pattern Hold→Capture, race condition khi tranh slot VIP, và test đồng thời. Dùng skill này ngay khi bạn sắp viết hoặc review code liên quan tới nạp tiền, trừ tiền, số dư, refund, mua gói promotion, boost, ghim top, slot allocation, hoặc webhook thanh toán (VNPay/Momo/ZaloPay) — kể cả khi thay đổi trông có vẻ nhỏ.
---

# Rà soát code liên quan tới ví & slot quảng cáo

Đây là vùng code duy nhất trong dự án mà một lỗi im lặng sẽ biến thành **mất tiền thật của KTV** hoặc **bán trùng một slot cho hai người**. Cả hai đều không tự phục hồi và làm mất niềm tin không lấy lại được. Vì vậy checklist này chạy trước khi coi bất kỳ thay đổi nào là xong — kể cả thay đổi một dòng.

## 1. Idempotency — mọi ghi tiền phải chống lặp

Cổng thanh toán **sẽ** gọi webhook trùng (retry khi timeout, khi nhận response chậm). Client cũng sẽ double-click. Nếu không chống lặp, KTV được cộng tiền hai lần hoặc bị trừ tiền hai lần.

- [ ] Mọi bản ghi vào `wallet_transactions` có `idempotency_key` được truyền vào từ bên ngoài, **không phải tự sinh trong hàm** (tự sinh thì mỗi lần gọi lại ra key khác → vô nghĩa)
- [ ] Với nạp tiền: dùng chính `transactionId` của cổng thanh toán làm key
- [ ] Với trừ tiền do người dùng thao tác: dùng key do client gửi lên (header `Idempotency-Key`) hoặc `campaign_id` của bản nháp
- [ ] Xử lý trùng bằng `ON CONFLICT (idempotency_key) DO NOTHING` rồi kiểm tra `rowCount`, **không** dùng `SELECT trước rồi INSERT sau` (có khe hở giữa hai câu lệnh)
- [ ] Trả về thành công (không phải lỗi) khi phát hiện trùng — cổng thanh toán cần 200 để ngừng retry

## 2. Không bao giờ trừ tiền trước khi chắc chắn có slot

Thứ tự thao tác quyết định KTV có bị mất tiền oan hay không. Pattern bắt buộc:

```
Hold(số tiền)  →  xác nhận slot TRONG cùng transaction  →  Capture (nếu được) / Release (nếu thua)
```

- [ ] Không có đường code nào `UPDATE wallets SET balance = balance - x` trước khi slot được xác nhận
- [ ] Việc kiểm tra slot còn trống **và** việc chiếm slot nằm trong **cùng một transaction** — nếu tách ra, giữa hai bước sẽ có người khác chen vào
- [ ] Mọi nhánh thất bại (hết slot, unique violation, exception bất kỳ) đều `Release` hold — kiểm tra cả nhánh `catch` và nhánh `finally`
- [ ] Hold có `expires_at` và có job dọn hold quá hạn — nếu process chết giữa chừng, tiền của KTV không bị treo vĩnh viễn

## 3. Race condition — DB constraint là trọng tài cuối, Redis lock chỉ là fast-path

Đây là chỗ dễ mắc sai lầm nhất: thấy đã có Redis lock nên bỏ qua ràng buộc DB.

- [ ] `slot_allocations` vẫn có `UNIQUE (area_id, package_type, window_start, slot_index)` và code **dựa vào** nó, không chỉ dựa vào lock
- [ ] Code có bắt lỗi unique violation và xử lý mượt (trả 409 + release hold), không để lộ lỗi Postgres thô ra API
- [ ] Redis lock có TTL và có `requestId` để chỉ chủ sở hữu mới xoá được lock (tránh xoá nhầm lock của request khác)
- [ ] Nếu Redis chết hoàn toàn, luồng mua gói vẫn **đúng** (chỉ chậm hơn) — nếu không, kiến trúc đang đặt tính đúng đắn vào một cache

Lý do: Redis lock có thể hết hạn giữa chừng khi transaction DB chạy lâu hơn dự kiến. Lúc đó hai request cùng tin mình đang giữ lock. Chỉ ràng buộc DB mới chặn được.

## 4. Test đồng thời — không tin vào code đọc bằng mắt

Race condition không xuất hiện trong test tuần tự. Bắt buộc có test:

- [ ] Test **2+ request đồng thời tranh slot cuối cùng** → đúng 1 thành công, phần còn lại nhận 409 và được refund hold đầy đủ
- [ ] Test **webhook nạp tiền bắn 2 lần cùng payload** → số dư chỉ tăng 1 lần
- [ ] Test **số dư không đủ** → không tạo campaign, không tạo hold treo
- [ ] Sau mỗi test, khẳng định bất biến: `SUM(wallet_transactions.amount theo dấu) == wallets.balance`

## 5. Quan sát & đối soát

- [ ] Mọi thay đổi số dư đều có bản ghi tương ứng trong `wallet_transactions` với `balance_after` — không có đường nào sửa `balance` mà không ghi sổ
- [ ] Job đối soát hằng đêm vẫn chạy đúng sau thay đổi này
- [ ] Có log/alert khi phát hiện lệch, không im lặng bỏ qua

## Khi phát hiện vi phạm

Đừng "sửa tạm rồi ghi TODO". Vùng code này không có mức độ "gần đúng" — hoặc bất biến được giữ, hoặc tiền sẽ lệch. Nếu chưa chắc cách sửa đúng, dừng lại và nêu rõ rủi ro với người dùng thay vì merge.
