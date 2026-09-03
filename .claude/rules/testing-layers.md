---
paths:
  - "tests/**"
---

# Kiến trúc — Ba tầng test, mỗi tầng bắt một loại lỗi

| Tầng | Ở đâu | Bắt được gì |
|---|---|---|
| Domain | `tests/Massage.Wallet.Domain.Tests` | Quy tắc nghiệp vụ tiền bạc. Không cần DB, chạy vài chục mili giây |
| Service | `tests/Massage.Api.Tests/*ServiceTests.cs` | Truy vấn thật, ràng buộc DB, race condition |
| HTTP | `tests/Massage.Api.Tests/Api*Tests.cs` | Mã trạng thái, ánh xạ exception, quyền theo role, binding multipart, rate limit |

Tầng HTTP dùng `ApiFactory` (bọc `WebApplicationFactory<Program>`), **phải nằm trong
`PostgresCollection`** vì nó dùng chung database với fixture, còn xUnit chạy các collection song song.
Đăng nhập trong test đi qua đúng luồng OTP thật thay vì tự ký JWT.

Nó sinh ra sau khi một lỗi thật lọt qua hai tầng kia: `GET /ktv/campaigns` trả 404 thay vì danh sách
rỗng, làm hỏng dashboard của KTV vừa đăng ký, trong khi mọi test service vẫn xanh. Khi thêm endpoint
mới, hãy thêm cả test ở tầng này — đặc biệt là các trường hợp "rỗng", "không có quyền", và "lỗi
nghiệp vụ ra mã HTTP nào".

`ApiFactory.ErrorsOrEmpty()` trả log lỗi phía server: `AppExceptionHandler` cố ý không lộ chi tiết
500 ra response, nên khi test đỏ thì đó là chỗ duy nhất đọc được nguyên nhân.
