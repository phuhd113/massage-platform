namespace Massage.Api.Common.Notifications;

/// <summary>
/// Ghi email ra log thay vì gửi đi. Dùng cho máy dev và môi trường test — đồng thời là
/// bản rơi về khi chưa cấu hình nhà cung cấp nào.
/// </summary>
/// <remarks>
/// Cố ý **không** ném lỗi khi chưa cấu hình, khác <c>UnconfiguredOtpSender</c>: đường OTP
/// là đường đăng nhập nên người dùng phải biết ngay là nó hỏng, còn ở đây người duy nhất
/// cần biết là người vận hành — và họ đọc log. Ném ở đây chỉ tạo ra một dòng lỗi trong
/// log của mọi lượt nộp hồ sơ trên máy dev, nơi không ai định gửi email cả.
/// </remarks>
public class LogEmailSender(ILogger<LogEmailSender> logger) : IEmailSender
{
    public bool IsRealDelivery => false;

    public Task SendAsync(
        IReadOnlyList<string> to, string subject, string body, CancellationToken ct = default)
    {
        logger.LogInformation(
            "[EMAIL - KHÔNG GỬI THẬT] Tới: {To}\nTiêu đề: {Subject}\n{Body}",
            string.Join(", ", to), subject, body);

        return Task.CompletedTask;
    }
}
