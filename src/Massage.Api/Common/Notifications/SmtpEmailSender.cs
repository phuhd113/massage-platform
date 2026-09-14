using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Options;
using MimeKit;

namespace Massage.Api.Common.Notifications;

/// <summary>
/// Gửi email qua SMTP (hiện là Email Server của P.A Việt Nam).
/// </summary>
/// <remarks>
/// <para>
/// Dùng MailKit chứ không phải <c>System.Net.Mail.SmtpClient</c>: bản kia bị .NET đánh dấu
/// obsolete và **không nói được SSL implicit** trên port 465 — nó chỉ biết STARTTLS, nên
/// cấu hình 465 sẽ treo tới timeout thay vì báo lỗi rõ ràng.
/// </para>
/// <para>
/// Mở kết nối mới mỗi lượt gửi thay vì giữ một <c>SmtpClient</c> dùng lại. Lượt gửi ở đây
/// rất thưa (mỗi hồ sơ KTV một email), nên giữ kết nối sống chỉ để tiết kiệm một lượt bắt
/// tay TLS là đổi lấy một kết nối treo âm thầm khi máy chủ đóng phía nó — và
/// <c>SmtpClient</c> của MailKit **không thread-safe**, nên dùng chung sẽ hỏng ngay khi
/// hai KTV nộp hồ sơ cùng lúc.
/// </para>
/// </remarks>
public class SmtpEmailSender(
    IOptions<SmtpOptions> smtp,
    IOptions<NotificationOptions> notifications,
    ILogger<SmtpEmailSender> logger) : IEmailSender
{
    private readonly SmtpOptions _smtp = smtp.Value;
    private readonly NotificationOptions _notifications = notifications.Value;

    public bool IsRealDelivery => true;

    public async Task SendAsync(
        IReadOnlyList<string> to, string subject, string body, CancellationToken ct = default)
    {
        if (to.Count == 0) return;

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_notifications.FromName, _notifications.FromEmail));
        foreach (var address in to)
            message.To.Add(MailboxAddress.Parse(address));

        message.Subject = subject;
        message.Body = new TextPart("plain") { Text = body };

        using var client = new SmtpClient
        {
            Timeout = _smtp.TimeoutSeconds * 1000,
        };

        // 465 dùng SSL ngay từ đầu (implicit); 587 mở kết nối thường rồi nâng cấp bằng
        // STARTTLS. Chọn sai kiểu cho cổng nào cũng dẫn tới treo chứ không phải lỗi rõ
        // ràng — đó là lý do suy ra từ số cổng thay vì để thành một cờ cấu hình thứ ba
        // mà người khai có thể đặt lệch với cổng.
        var security = _smtp.Port == 465
            ? SecureSocketOptions.SslOnConnect
            : SecureSocketOptions.StartTls;

        await client.ConnectAsync(_smtp.Host, _smtp.Port, security, ct);
        await client.AuthenticateAsync(_smtp.Username, _smtp.Password, ct);
        await client.SendAsync(message, ct);

        // Đóng lịch sự: bỏ qua bước này thì máy chủ thấy kết nối rơi giữa chừng và một số
        // bản cấu hình tính đó vào hạn mức chống lạm dụng.
        await client.DisconnectAsync(true, ct);

        logger.LogInformation(
            "Đã gửi email tới {Count} người nhận qua SMTP {Host}:{Port}: {Subject}",
            to.Count, _smtp.Host, _smtp.Port, subject);
    }
}
