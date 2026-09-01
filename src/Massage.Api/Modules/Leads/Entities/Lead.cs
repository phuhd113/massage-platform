namespace Massage.Api.Modules.Leads.Entities;

public static class LeadChannels
{
    public const string Call = "CALL";
    public const string Zalo = "ZALO";
    public const string Sms = "SMS";

    public static readonly string[] All = [Call, Zalo, Sms];
}

/// <summary>
/// Một lần khách bấm liên hệ với KTV. Đây là đơn vị giá trị mà nền tảng tạo ra
/// cho KTV, nên bảng này vừa là số liệu cho dashboard (Phase 3) vừa là dữ liệu
/// gốc để phát hiện click ảo (Phase 4) — vì vậy ghi đủ ip/user agent/device ngay
/// từ bây giờ, bổ sung sau sẽ không có dữ liệu lịch sử để đối chiếu.
/// </summary>
public class Lead
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }

    /// <summary>Null khi khách chưa đăng nhập — phần lớn lead sẽ rơi vào trường hợp này.</summary>
    public Guid? CustomerUserId { get; set; }

    public string Channel { get; set; } = null!;

    /// <summary>Khu vực khách đang xem lúc bấm, để quy doanh thu về đúng khu vực.</summary>
    public Guid? AreaId { get; set; }

    public string? SourceUrl { get; set; }
    public string? Ip { get; set; }
    public string? UserAgent { get; set; }

    /// <summary>Hash của (ip + user agent), dùng để gộp các lần bấm lặp của cùng một thiết bị.</summary>
    public string? DeviceHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
