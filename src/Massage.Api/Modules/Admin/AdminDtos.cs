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
