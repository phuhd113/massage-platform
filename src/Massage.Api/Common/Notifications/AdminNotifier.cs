using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.Extensions.Options;

namespace Massage.Api.Common.Notifications;

/// <summary>
/// Soạn và gửi các thông báo vận hành cho ban quản trị.
/// </summary>
/// <remarks>
/// <para>
/// <b>Mọi phương thức ở đây đều nuốt lỗi.</b> Đây là quyết định trung tâm của module:
/// người gây ra lượt gửi (KTV vừa nộp hồ sơ) **không phải** người nhận email, nên để một
/// sự cố ở Resend chặn được onboarding của họ là đánh đổi sai chiều — cùng nguyên tắc với
/// beacon <c>profile_views</c> nuốt lỗi khoá ngoại: không đổi một dòng thông báo lấy cả
/// một luồng đang phục vụ người dùng thật.
/// </para>
/// <para>
/// Cái giá đã cân nhắc: email hỏng thì hồ sơ nằm im trong hàng đợi tới khi có người mở
/// trang duyệt. Chấp nhận được vì <c>/admin/duyet-ktv</c> vẫn là nguồn sự thật và vẫn
/// đầy đủ — email chỉ rút ngắn thời gian phát hiện, không phải cơ chế duy nhất để biết.
/// Vì vậy lỗi ghi ở mức <c>Error</c> kèm đủ ngữ cảnh: nó là thứ duy nhất nói được rằng
/// kênh thông báo đang chết.
/// </para>
/// </remarks>
public class AdminNotifier(
    IEmailSender email,
    IOptions<NotificationOptions> options,
    ILogger<AdminNotifier> logger)
{
    private readonly NotificationOptions _options = options.Value;

    /// <summary>
    /// KTV đã làm xong phần việc của mình (ký cam kết + gửi CCCD) và hồ sơ đang chờ duyệt.
    /// </summary>
    /// <remarks>
    /// Gửi ở **thời điểm hồ sơ đủ điều kiện để xem xét**, không phải ở mỗi thao tác của
    /// KTV. Hai điều kiện đó đến từ hai endpoint độc lập và theo thứ tự bất kỳ, có thể
    /// cách nhau nhiều giờ; gửi ở cả hai nơi nghĩa là hai email cho cùng một người, và
    /// cái đến trước báo một việc chưa làm được gì.
    /// </remarks>
    public async Task KtvProfileReadyForReviewAsync(
        KtvProfile profile, string phone, CancellationToken ct = default)
    {
        var subject = $"[MasGo] Hồ sơ KTV chờ duyệt: {profile.FullName}";

        var body = $"""
            Một hồ sơ kỹ thuật viên vừa hoàn tất và đang chờ duyệt.

            Họ tên:      {profile.FullName}
            Số điện thoại: {phone}
            Giới tính:   {GenderLabel(profile.Gender)}
            Kinh nghiệm: {profile.YearsExperience} năm
            Khu vực:     {profile.BaseAddress ?? "(chưa khai)"}

            KTV đã ký cam kết và đã gửi ảnh CCCD. Việc còn lại:

            1. Duyệt ảnh CCCD:  {Url("/admin/duyet-cccd")}
            2. Duyệt hồ sơ:     {Url("/admin/duyet-ktv")}

            Hồ sơ chỉ lên sàn sau khi CCCD được duyệt VÀ hồ sơ được duyệt.
            """;

        await SendAsync(subject, body, $"hồ sơ KTV {profile.Id}", ct);
    }

    /// <summary>
    /// Gửi, nuốt mọi lỗi. Trả về thầm lặng khi chưa cấu hình người nhận — trạng thái đó là
    /// bình thường trên máy dev và không đáng làm bẩn log của mọi lượt nộp hồ sơ.
    /// </summary>
    private async Task SendAsync(string subject, string body, string context, CancellationToken ct)
    {
        var recipients = _options.AdminEmailList;
        if (recipients.Count == 0)
        {
            logger.LogDebug(
                "Bỏ qua thông báo ({Context}): chưa khai Notifications:AdminEmails.", context);
            return;
        }

        try
        {
            await email.SendAsync(recipients, subject, body, ct);
        }
        catch (Exception ex)
        {
            // Mức Error có chủ ý: một kênh thông báo chết mà chỉ để lại dòng Warning sẽ
            // trôi qua mắt đúng lúc cần nhất — lúc không ai biết là mình đang không được
            // báo gì cả.
            logger.LogError(ex,
                "Không gửi được thông báo cho ban quản trị ({Context}). Hồ sơ vẫn nằm "
                + "trong hàng đợi duyệt và không bị ảnh hưởng.", context);
        }
    }

    private string Url(string path) => $"{_options.AdminBaseUrl.TrimEnd('/')}{path}";

    private static string GenderLabel(string? gender) => gender switch
    {
        Genders.Male => "Nam",
        Genders.Female => "Nữ",
        _ => "(chưa khai)",
    };
}
