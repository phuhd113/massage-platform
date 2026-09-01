namespace Massage.Api.Modules.Reviews.Entities;

public static class ReviewStatuses
{
    public const string Pending = "PENDING";
    public const string Published = "PUBLISHED";
    public const string Rejected = "REJECTED";
}

/// <summary>
/// Đánh giá của khách cho một KTV.
///
/// Chỉ review <see cref="ReviewStatuses.Published"/> mới được tính vào
/// rating_avg và hiển thị công khai: rating xuất hiện trong structured data
/// <c>AggregateRating</c> gửi cho Google, và đánh dấu rating không có review thật
/// là vi phạm chính sách, mất toàn bộ rich result của tên miền.
/// </summary>
public class Review
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }
    public Guid AuthorUserId { get; set; }

    /// <summary>Lead tương ứng nếu có — mầm cho quy tắc "chỉ ai từng liên hệ mới được đánh giá".</summary>
    public Guid? LeadId { get; set; }

    public short Rating { get; set; }
    public string? Comment { get; set; }

    public string Status { get; set; } = ReviewStatuses.Published;
    public string? RejectionReason { get; set; }
    public Guid? ModeratedBy { get; set; }
    public DateTimeOffset? ModeratedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
