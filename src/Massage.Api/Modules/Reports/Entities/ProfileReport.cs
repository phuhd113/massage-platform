namespace Massage.Api.Modules.Reports.Entities;

/// <summary>
/// Lý do báo cáo. Danh sách đóng chứ không phải ô nhập tự do: admin xử lý hàng đợi
/// này phải phân loại được hàng trăm dòng mà không đọc hết từng dòng, và
/// <see cref="ProfileReportReasons.Prostitution"/> là loại cần xử lý trước tất cả
/// những loại còn lại.
/// </summary>
public static class ProfileReportReasons
{
    /// <summary>Dùng hồ sơ làm vỏ bọc cho dịch vụ trá hình.</summary>
    public const string Prostitution = "PROSTITUTION";

    /// <summary>Ảnh hoặc mô tả phản cảm, không phải nội dung trị liệu.</summary>
    public const string InappropriateContent = "INAPPROPRIATE_CONTENT";

    /// <summary>Thông tin sai sự thật: chứng chỉ giả, giá khác xa thực tế.</summary>
    public const string FalseInformation = "FALSE_INFORMATION";

    /// <summary>Mạo danh người khác.</summary>
    public const string Impersonation = "IMPERSONATION";

    /// <summary>Hành vi không chuyên nghiệp trong lúc phục vụ.</summary>
    public const string Misconduct = "MISCONDUCT";

    public const string Other = "OTHER";

    public static readonly string[] All =
    [
        Prostitution, InappropriateContent, FalseInformation, Impersonation, Misconduct, Other,
    ];
}

public static class ProfileReportStatuses
{
    public const string Pending = "PENDING";

    /// <summary>Đã xem, xác nhận vi phạm và đã xử lý hồ sơ.</summary>
    public const string ActionTaken = "ACTION_TAKEN";

    /// <summary>Đã xem, không phải vi phạm.</summary>
    public const string Dismissed = "DISMISSED";

    public static readonly string[] All = [Pending, ActionTaken, Dismissed];
}

/// <summary>
/// Một lần khách báo cáo hồ sơ KTV có vi phạm.
///
/// Vì sao bảng này tồn tại từ sớm chứ không đợi Phase 4: mô hình "massage tại nhà"
/// bị lợi dụng làm vỏ bọc cho dịch vụ trá hình khá thường xuyên, và rủi ro đó chạm
/// đúng hai trụ cột của dự án — pháp lý, và kênh acquisition chính. Google hạ hạng
/// mạnh tên miền bị phân loại là nội dung người lớn, mà mất SEO ở đây là mất gần như
/// toàn bộ khách. Không có đường để người dùng báo cáo thì nền tảng chỉ biết chuyện
/// đó khi đã quá muộn để sửa.
///
/// Báo cáo **không** tự động ẩn hồ sơ. Một nút ẩn được bằng vài lần bấm là một vũ khí
/// để KTV đối thủ hạ nhau, và hồ sơ bị ẩn oan là doanh thu mất thật. Nó chỉ đưa hồ sơ
/// vào hàng đợi để admin quyết định bằng đường duyệt hồ sơ vốn đã có.
/// </summary>
public class ProfileReport
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }

    /// <summary>
    /// Null khi người báo cáo chưa đăng nhập — và phần lớn sẽ như vậy. Bắt đăng nhập
    /// mới được báo cáo sẽ chặn đúng nhóm người có nhiều khả năng báo cáo nhất: khách
    /// vừa nhìn thấy nội dung vi phạm trên một trang công khai.
    /// </summary>
    public Guid? ReporterUserId { get; set; }

    public string Reason { get; set; } = null!;

    /// <summary>Mô tả thêm của người báo cáo, không bắt buộc trừ khi lý do là OTHER.</summary>
    public string? Detail { get; set; }

    public string Status { get; set; } = null!;

    public string? Ip { get; set; }
    public string? UserAgent { get; set; }

    /// <summary>Hash của (ip + user agent), dùng để gộp các lần gửi lặp của cùng thiết bị.</summary>
    public string? DeviceHash { get; set; }

    public Guid? ReviewedBy { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }

    /// <summary>Ghi chú của admin lúc chốt — vì sao xử lý hoặc vì sao bỏ qua.</summary>
    public string? ResolutionNote { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
