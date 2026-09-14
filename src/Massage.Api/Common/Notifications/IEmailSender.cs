namespace Massage.Api.Common.Notifications;

/// <summary>
/// Cổng gửi email **nội bộ** — thông báo vận hành cho ban quản trị, không phải email
/// gửi tới khách hay KTV. Hệ thống chưa thu thập email của người dùng (đăng nhập bằng
/// số điện thoại), nên mọi người nhận đều đến từ cấu hình.
/// </summary>
/// <remarks>
/// Cùng hình dạng với <c>IOtpSender</c> và vì cùng một lý do: adapter chọn theo
/// **credential** chứ không theo cờ bật/tắt riêng, và thiếu cấu hình **không** chặn app
/// khởi động — xem <c>EmailSenderSetup</c>.
///
/// Khác một điểm quan trọng: <c>IOtpSender</c> nằm trên đường đăng nhập nên lỗi của nó
/// phải nổi lên tới người dùng (503). Email ở đây là thông báo cho **người vận hành**,
/// và người gây ra lượt gửi (KTV vừa nộp hồ sơ) không phải người nhận — ném lỗi ở đó là
/// chặn onboarding của họ vì một sự cố không liên quan gì đến họ. Vì vậy mọi đường gọi
/// đều nuốt lỗi và chỉ ghi log; xem <c>AdminNotifier</c>.
/// </remarks>
public interface IEmailSender
{
    /// <summary>
    /// Gửi một email dạng text thuần tới danh sách người nhận.
    /// Ném khi gửi thất bại — tầng gọi chịu trách nhiệm quyết định có nuốt lỗi hay không.
    /// </summary>
    Task SendAsync(
        IReadOnlyList<string> to,
        string subject,
        string body,
        CancellationToken ct = default);

    /// <summary>
    /// Adapter này có thật sự gửi đi ngoài hay không. Dùng để log phân biệt "đã gửi" với
    /// "chỉ ghi log vì chưa cấu hình" — cùng lý do với <c>IOtpSender.RevealsCode</c>:
    /// suy ra từ adapter chứ không đọc lại cờ cấu hình ở tầng gọi, nếu không sẽ có lúc
    /// cờ và adapter nói hai điều khác nhau.
    /// </summary>
    bool IsRealDelivery { get; }
}
