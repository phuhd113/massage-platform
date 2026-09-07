using FluentValidation;
using Massage.Api.Modules.Collaborators.Entities;

namespace Massage.Api.Modules.Collaborators;

public record UpsertCollaboratorDto(string Code, string FullName, string? Phone, string? Note);

/// <summary>
/// Sửa CTV. <b>Không có trường <c>Code</c></b> — mã đã phát ra ngoài thì không đổi được,
/// xem <c>CollaboratorService.UpdateAsync</c>. Mọi trường null nghĩa là "giữ nguyên".
/// </summary>
public record UpdateCollaboratorDto(string? FullName, string? Phone, string? Note, string? Status);

/// <param name="ReferredCount">Tổng số hồ sơ đã giới thiệu, mọi trạng thái.</param>
/// <param name="VerifiedCount">
/// Số hồ sơ đã được duyệt. Đây mới là con số đáng dùng để tính hoa hồng: hồ sơ tạo ra
/// rồi không bao giờ qua duyệt thì chưa mang lại gì cho sàn.
/// </param>
public record CollaboratorSummaryDto(
    Guid Id,
    string Code,
    string FullName,
    string? Phone,
    string Status,
    string? Note,
    DateTimeOffset CreatedAt,
    int ReferredCount,
    int VerifiedCount);

public record ReferredKtvDto(
    Guid Id,
    string FullName,
    string Slug,
    string VerificationStatus,
    DateTimeOffset? ReferredAt,
    DateTimeOffset CreatedAt);

public class UpsertCollaboratorDtoValidator : AbstractValidator<UpsertCollaboratorDto>
{
    public UpsertCollaboratorDtoValidator()
    {
        // Chỉ chữ, số và gạch ngang: mã được đọc qua điện thoại và gõ lại bằng tay, nên
        // khoảng trắng hay ký tự lạ ở giữa là nguồn lỗi gõ không đáng có. Kiểm trên bản
        // đã chuẩn hoá để "an-01" và " AN-01 " cùng qua được.
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã cộng tác viên không được để trống")
            .Must(c => Collaborator.NormalizeCode(c).Length is >= 3 and <= 32)
            .WithMessage("Mã phải từ 3 đến 32 ký tự")
            .Must(c => Collaborator.NormalizeCode(c).All(ch => char.IsAsciiLetterOrDigit(ch) || ch == '-'))
            .WithMessage("Mã chỉ gồm chữ không dấu, số và dấu gạch ngang");

        RuleFor(x => x.FullName).NotEmpty().Length(2, 120);
        RuleFor(x => x.Phone).MaximumLength(15);
    }
}

public class UpdateCollaboratorDtoValidator : AbstractValidator<UpdateCollaboratorDto>
{
    public UpdateCollaboratorDtoValidator()
    {
        RuleFor(x => x.FullName).Length(2, 120).When(x => x.FullName is not null);
        RuleFor(x => x.Phone).MaximumLength(15);
        RuleFor(x => x.Status)
            .Must(s => s is CollaboratorStatuses.Active or CollaboratorStatuses.Disabled)
            .When(x => x.Status is not null)
            .WithMessage("Trạng thái phải là ACTIVE hoặc DISABLED");
    }
}
