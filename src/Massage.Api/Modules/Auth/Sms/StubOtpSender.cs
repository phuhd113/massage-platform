namespace Massage.Api.Modules.Auth.Sms;

/// <summary>
/// Không gửi gì, chỉ ghi log và trả mã về trong response. Dùng cho dev và test.
///
/// <see cref="RevealsCode"/> là <c>true</c> ở đúng một chỗ này. Trước đây
/// <c>OtpService</c> tự đọc cờ <c>Otp:StubEnabled</c> để quyết định có trả mã hay không;
/// giờ điều đó suy ra từ chính adapter đang dùng, nên không còn tổ hợp cấu hình nào
/// vừa gửi tin thật vừa trả mã ra response.
/// </summary>
public class StubOtpSender(ILogger<StubOtpSender> logger) : IOtpSender
{
    public string Channel => "STUB";
    public bool RevealsCode => true;

    public Task SendAsync(string phone, string code, int ttlSeconds, CancellationToken ct = default)
    {
        logger.LogWarning("[OTP STUB] {Phone} -> {Code}", phone, code);
        return Task.CompletedTask;
    }
}

/// <summary>
/// Không có nhà cung cấp nào được cấu hình. Ném lỗi rõ ràng ở lượt gửi đầu tiên thay vì
/// âm thầm không gửi gì rồi để người dùng chờ một mã không tồn tại.
/// </summary>
public class UnconfiguredOtpSender : IOtpSender
{
    public string Channel => "NONE";
    public bool RevealsCode => false;

    public Task SendAsync(string phone, string code, int ttlSeconds, CancellationToken ct = default) =>
        throw new OtpDeliveryException(
            "Chưa cấu hình nhà cung cấp SMS. Đặt Otp:StubEnabled=true cho môi trường dev, "
            + "hoặc điền Zalo:Zns:* để gửi qua ZNS.");
}
