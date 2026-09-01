using FluentValidation;
using Massage.Api.Modules.Reviews.Entities;

namespace Massage.Api.Modules.Reviews;

public record CreateReviewDto(short Rating, string? Comment);

public class CreateReviewDtoValidator : AbstractValidator<CreateReviewDto>
{
    public CreateReviewDtoValidator()
    {
        RuleFor(x => x.Rating).InclusiveBetween((short)1, (short)5)
            .WithMessage("Điểm đánh giá phải từ 1 đến 5 sao");
        RuleFor(x => x.Comment).MaximumLength(2000);
    }
}

public record ModerateReviewDto(string Status, string? RejectionReason);

public class ModerateReviewDtoValidator : AbstractValidator<ModerateReviewDto>
{
    public ModerateReviewDtoValidator()
    {
        RuleFor(x => x.Status)
            .Must(s => s is ReviewStatuses.Published or ReviewStatuses.Rejected)
            .WithMessage($"Trạng thái phải là {ReviewStatuses.Published} hoặc {ReviewStatuses.Rejected}");

        // Cùng quy tắc với duyệt hồ sơ: từ chối phải nêu lý do, nếu không người bị
        // từ chối không biết phải sửa gì và sẽ gửi lại y hệt.
        RuleFor(x => x.RejectionReason).NotEmpty()
            .When(x => x.Status == ReviewStatuses.Rejected)
            .WithMessage("Từ chối phải nêu lý do");
    }
}

public record ReviewDto(
    Guid Id,
    Guid KtvId,
    short Rating,
    string? Comment,
    string Status,
    DateTimeOffset CreatedAt);

public record ReviewListDto(IReadOnlyList<ReviewDto> Items, int Page, int Size, int Total);
