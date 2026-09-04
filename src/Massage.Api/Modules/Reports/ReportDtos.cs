using FluentValidation;
using Massage.Api.Modules.Reports.Entities;

namespace Massage.Api.Modules.Reports;

public record CreateReportDto(Guid KtvId, string Reason, string? Detail);

public class CreateReportDtoValidator : AbstractValidator<CreateReportDto>
{
    public CreateReportDtoValidator()
    {
        RuleFor(x => x.KtvId).NotEmpty();

        RuleFor(x => x.Reason).NotEmpty()
            .Must(r => ProfileReportReasons.All.Contains(r))
            .WithMessage($"Lý do phải là một trong: {string.Join(", ", ProfileReportReasons.All)}");

        // Giới hạn độ dài để một người gửi hàng loạt không nhét được cả trang văn bản
        // vào hàng đợi admin phải đọc bằng mắt.
        RuleFor(x => x.Detail).MaximumLength(2000);

        // OTHER mà không mô tả thì admin không có gì để xử lý — dòng đó chỉ làm dài
        // hàng đợi. Các lý do còn lại tự nó đã nói đủ nên mô tả là tuỳ chọn.
        RuleFor(x => x.Detail).NotEmpty()
            .When(x => x.Reason == ProfileReportReasons.Other)
            .WithMessage("Chọn lý do \"Khác\" thì cần mô tả cụ thể");
    }
}

/// <param name="Deduplicated">
/// True khi lần gửi này được gộp vào một báo cáo trước đó của cùng thiết bị cho
/// cùng hồ sơ. Trả về thay vì im lặng để frontend nói đúng sự thật ("đã ghi nhận
/// trước đó") thay vì báo thành công lần thứ hai cho một việc không xảy ra.
/// </param>
public record ReportCreatedDto(Guid Id, DateTimeOffset CreatedAt, bool Deduplicated);

public record ReportDto(
    Guid Id,
    Guid KtvId,
    string KtvFullName,
    string KtvVerificationStatus,
    string Reason,
    string? Detail,
    string Status,
    Guid? ReporterUserId,
    Guid? ReviewedBy,
    DateTimeOffset? ReviewedAt,
    string? ResolutionNote,
    DateTimeOffset CreatedAt);

/// <param name="PendingReportCount">
/// Số báo cáo còn chờ xử lý của **cùng hồ sơ đó**, kể cả dòng này.
///
/// Đây là con số quyết định thứ tự đọc: một hồ sơ bị mười người khác nhau báo cáo
/// khác hẳn về mức độ so với mười hồ sơ mỗi cái một báo cáo, mà nhìn danh sách phẳng
/// theo thời gian thì hai trường hợp trông giống hệt nhau.
/// </param>
public record ReportQueueItemDto(ReportDto Report, int PendingReportCount);

public record ResolveReportDto(string Decision, string? Note);

public class ResolveReportDtoValidator : AbstractValidator<ResolveReportDto>
{
    public ResolveReportDtoValidator()
    {
        RuleFor(x => x.Decision).NotEmpty()
            .Must(d => d is ProfileReportStatuses.ActionTaken or ProfileReportStatuses.Dismissed)
            .WithMessage(
                $"Quyết định phải là {ProfileReportStatuses.ActionTaken} "
                + $"hoặc {ProfileReportStatuses.Dismissed}");

        RuleFor(x => x.Note).MaximumLength(1000);
    }
}
