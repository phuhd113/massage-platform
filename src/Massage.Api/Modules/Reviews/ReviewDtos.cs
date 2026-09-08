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

/// <summary>Một đánh giá nhìn từ hàng đợi rà soát của admin.</summary>
/// <param name="HasLead">
/// Người viết có lượt liên hệ nào với KTV này được ghi nhận không.
///
/// <b>Dấu hiệu, không phải bằng chứng.</b> Khách bấm gọi lúc chưa đăng nhập thì lead
/// ẩn danh và không bao giờ khớp được, nên rất nhiều đánh giá thật cũng có
/// <c>false</c> ở đây. Ngược lại mới đáng tin: <c>true</c> nghĩa là người này thật sự
/// đã liên hệ. Đừng biến cột này thành điều kiện tự động gỡ đánh giá.
/// </param>
/// <param name="AuthorAccountAgeHours">
/// Tài khoản được tạo bao lâu trước khi viết đánh giá này. Tài khoản lập xong đánh
/// giá ngay là hình dạng của việc bơm sao; con số này để admin xếp thứ tự đọc.
/// </param>
public record ReviewForModerationDto(
    Guid Id,
    Guid KtvId,
    string KtvFullName,
    string KtvSlug,
    Guid AuthorUserId,
    short Rating,
    string? Comment,
    string Status,
    bool HasLead,
    double AuthorAccountAgeHours,
    DateTimeOffset CreatedAt);

/// <summary>
/// Một đánh giá do chính người đang đăng nhập viết, kèm đủ thông tin để dựng link
/// ngược về hồ sơ KTV.
/// </summary>
/// <param name="KtvSlug">
/// Đi cùng <paramref name="KtvId"/> vì URL hồ sơ là <c>/ktv/{slug}-{id}</c> — cần cả
/// hai. Trả kèm ở đây thay vì để frontend gọi thêm một lượt cho mỗi dòng.
/// </param>
/// <param name="Status">
/// Có trả về, khác endpoint công khai vốn chỉ trả review đã đăng: người viết phải
/// thấy được đánh giá của mình vừa bị gỡ, nếu không họ chỉ thấy nó biến mất.
/// </param>
public record MyReviewDto(
    Guid Id,
    Guid KtvId,
    string KtvFullName,
    string KtvSlug,
    short Rating,
    string? Comment,
    string Status,
    string? RejectionReason,
    DateTimeOffset CreatedAt);
