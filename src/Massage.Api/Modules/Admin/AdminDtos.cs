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
