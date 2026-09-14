using Massage.Api.Common.Notifications;

namespace Massage.Api.Tests;

/// <summary>
/// Ghi lại email thay vì gửi — để test khẳng định "đã gửi mấy lần, nội dung gì".
/// </summary>
/// <remarks>
/// <see cref="ThrowOnSend"/> mô phỏng nhà cung cấp hỏng. Đó là ca đáng test nhất của
/// module này: cả thiết kế dựa trên lời hứa rằng lỗi email **không** chặn KTV nộp hồ sơ,
/// và lời hứa đó chỉ kiểm được bằng cách làm cho nó hỏng thật.
/// </remarks>
public sealed class FakeEmailSender : IEmailSender
{
    private readonly List<SentEmail> _sent = [];
    private readonly object _gate = new();

    public bool IsRealDelivery => true;

    /// <summary>Ném lỗi ở mọi lượt gửi, mô phỏng Resend từ chối hoặc mạng hỏng.</summary>
    public bool ThrowOnSend { get; set; }

    public IReadOnlyList<SentEmail> Sent
    {
        get { lock (_gate) return [.. _sent]; }
    }

    public Task SendAsync(
        IReadOnlyList<string> to, string subject, string body, CancellationToken ct = default)
    {
        if (ThrowOnSend)
            throw new InvalidOperationException("Nhà cung cấp email hỏng (giả lập trong test)");

        lock (_gate) _sent.Add(new SentEmail([.. to], subject, body));
        return Task.CompletedTask;
    }

    public sealed record SentEmail(IReadOnlyList<string> To, string Subject, string Body);
}
