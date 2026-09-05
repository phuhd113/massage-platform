namespace Massage.Api.Modules.Auth.Entities;

/// <summary>
/// Cặp token OAuth của Zalo, lưu ở Postgres vì <b>refresh token bị xoay mỗi lần dùng</b>:
/// Zalo cấp bản mới và vô hiệu hoá bản cũ ngay trong cùng lượt gọi.
///
/// Hệ quả bắt buộc nhớ: refresh token <b>không thể</b> chỉ nằm trong file cấu hình hay
/// biến môi trường. Giữ trong bộ nhớ thì restart container là mất bản mới, và bản trong
/// cấu hình lúc đó đã chết — OA ngừng gửi được tin cho tới khi có người vào Zalo lấy tay
/// một refresh token mới. Cấu hình chỉ là **hạt giống** cho lần chạy đầu tiên.
///
/// Bảng đúng một hàng (khoá theo <see cref="AppId"/>), cập nhật tại chỗ.
/// </summary>
public class ZaloToken
{
    public string AppId { get; set; } = "";
    public string AccessToken { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
