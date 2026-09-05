namespace Massage.Api.Modules.Auth.Sms;

/// <summary>
/// Cổng gửi mã OTP ra ngoài. Tách khỏi <see cref="IOtpService"/> có chủ ý: phần sinh mã,
/// băm, đếm số lần thử và vòng đời hết hạn là nghiệp vụ bảo mật và không được đụng tới
/// khi đổi nhà cung cấp. Đổi ZNS sang SMS hay ngược lại chỉ là thay adapter ở đây.
/// </summary>
public interface IOtpSender
{
    /// <summary>
    /// Tên nhà cung cấp, đưa vào log và response để biết mã đi đường nào.
    /// Không bao giờ chứa credential.
    /// </summary>
    string Channel { get; }

    /// <summary>
    /// Có trả mã về trong response hay không. Chỉ đúng với adapter stub —
    /// đây là thứ quyết định <c>debugCode</c> có mặt, thay cho việc
    /// <c>OtpService</c> tự đọc cờ cấu hình.
    /// </summary>
    bool RevealsCode { get; }

    /// <summary>
    /// Gửi mã. Ném <see cref="OtpDeliveryException"/> khi không gửi được —
    /// gọi phương thức này mà không nổ nghĩa là tin đã được nhà cung cấp nhận.
    /// </summary>
    Task SendAsync(string phone, string code, int ttlSeconds, CancellationToken ct = default);
}

/// <summary>
/// Không gửi được mã tới người dùng. Tách khỏi <see cref="InvalidOperationException"/>
/// để tầng HTTP dịch thành 503 (lỗi tạm thời phía nhà cung cấp) chứ không phải 500.
/// </summary>
public class OtpDeliveryException(string message, Exception? inner = null)
    : Exception(message, inner);
