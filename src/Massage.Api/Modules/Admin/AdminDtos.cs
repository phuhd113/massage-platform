using FluentValidation;
using Massage.Api.Modules.KtvProfiles.Entities;

namespace Massage.Api.Modules.Admin;

public record VerifyDecisionDto(string Decision, string? Reason);

public class VerifyDecisionDtoValidator : AbstractValidator<VerifyDecisionDto>
{
    public VerifyDecisionDtoValidator()
    {
        RuleFor(x => x.Decision)
            .Must(d => d is VerificationStatuses.Verified or VerificationStatuses.Rejected)
            .WithMessage("Quyết định phải là VERIFIED hoặc REJECTED");

        // Từ chối mà không nêu lý do thì KTV không biết phải sửa gì và sẽ nộp lại
        // y hệt, tạo vòng lặp tốn công cho cả hai phía.
        RuleFor(x => x.Reason)
            .NotEmpty().MinimumLength(5).MaximumLength(500)
            .WithMessage("Cần nêu lý do từ chối để KTV biết cách bổ sung")
            .When(x => x.Decision == VerificationStatuses.Rejected);
    }
}

/// <summary>Doanh thu ròng của một khu vực với một loại gói.</summary>
/// <param name="NetRevenue">
/// Đã trừ hoàn tiền: tổng của CAPTURE (âm) và REFUND (dương) rồi đảo dấu. Vì vậy một
/// khu vực bị huỷ nhiều hơn bán có thể ra số **âm** — đó là con số đúng, đừng kẹp về 0.
/// </param>
public record RevenueRowDto(
    Guid AreaId,
    string AreaName,
    string PackageType,
    decimal NetRevenue,
    int Transactions);

/// <param name="Date">Ngày theo **giờ Việt Nam**, không phải UTC.</param>
public record RevenueDayDto(DateOnly Date, decimal NetRevenue);

/// <param name="Daily">
/// Chuỗi theo ngày để vẽ xu hướng. Chỉ có ngày **có phát sinh** giao dịch — ngày
/// không bán được gì thì không có dòng nào, nên phía đọc phải tự điền 0 cho những
/// ngày trống nếu muốn một trục thời gian liên tục.
/// </param>
public record RevenueReportDto(
    DateTimeOffset From,
    DateTimeOffset To,
    decimal Total,
    IReadOnlyList<RevenueRowDto> Items,
    IReadOnlyList<RevenueDayDto> Daily);

/// <summary>
/// Một KTV nhìn từ trang tra cứu của admin.
///
/// Khác <c>GET /admin/ktv</c> (hàng đợi duyệt) ở chỗ nó trả **mọi trạng thái** và kèm
/// số liệu vận hành. Hai màn hình cố ý tách nhau: hàng đợi trả lời "còn gì phải duyệt",
/// trang này trả lời "người tên X là ai, đang thế nào" — câu hỏi thứ hai luôn bắt đầu
/// bằng một cái tên hoặc số điện thoại, không bao giờ bằng một trạng thái duyệt.
/// </summary>
/// <param name="Phone">
/// Số điện thoại tài khoản. Đây là **thứ admin tra cứu theo** khi KTV gọi điện tới, nên
/// nó là lý do chính trang này tồn tại. Chỉ có ở đường admin — hồ sơ công khai vẫn giấu
/// số, và quy tắc đó không đổi.
/// </param>
/// <param name="ActiveCampaigns">
/// Số campaign đang chạy **tại thời điểm hỏi**, không phải tổng số đã mua. Admin cần biết
/// KTV này có đang trả tiền hay không để xử lý khiếu nại theo đúng mức ưu tiên.
/// </param>
/// <param name="WalletBalance">
/// Null khi KTV chưa từng có ví (chưa nạp lần nào) — khác hẳn với 0 đồng, vốn nghĩa là
/// đã có ví và đã tiêu hết. Gộp hai thứ đó thành 0 sẽ giấu mất một nửa câu trả lời cho
/// câu hỏi "người này đã bao giờ trả tiền chưa".
/// </param>
public record AdminKtvRowDto(
    Guid Id,
    Guid UserId,
    string FullName,
    string Slug,
    string Phone,
    string? Gender,
    short YearsExperience,
    string? BaseAddress,
    string VerificationStatus,
    string? RejectionReason,
    string? AvatarUrl,
    decimal RatingAvg,
    int RatingCount,
    int LeadCount,
    int ReviewCount,
    int ActiveCampaigns,
    decimal? WalletBalance,
    bool HasIdentityDoc,
    string? IdentityStatus,
    bool CommitmentsUpToDate,
    DateTimeOffset? LastActiveAt,
    DateTimeOffset CreatedAt);
