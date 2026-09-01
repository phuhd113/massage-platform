using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Reviews.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Massage.Api.Modules.Reviews;

public class ReviewService(AppDbContext db)
{
    public async Task<ReviewDto> CreateAsync(
        Guid ktvId, Guid authorUserId, CreateReviewDto dto, CancellationToken ct = default)
    {
        var ktv = await db.KtvProfiles
            .Where(k => k.Id == ktvId && k.VerificationStatus == VerificationStatuses.Verified)
            .Select(k => new { k.Id, k.UserId })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Không tìm thấy KTV đang hoạt động");

        if (ktv.UserId == authorUserId)
            throw new BadRequestException("Không thể tự đánh giá hồ sơ của chính mình");

        var review = new Review
        {
            KtvId = ktvId,
            AuthorUserId = authorUserId,
            Rating = dto.Rating,
            Comment = dto.Comment,
            // Đăng ngay thay vì chờ duyệt: bắt duyệt tay từng review sẽ làm luồng
            // đánh giá chết ngay từ đầu, khi chưa có ai trực. Đổi lại có unique
            // (ktv, author), rate limit, và admin gỡ được sau — xem ModerateAsync.
            Status = ReviewStatuses.Published,
        };

        db.Reviews.Add(review);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: "23505" })
        {
            // Bắt đúng mã 23505 chứ không phải mọi DbUpdateException: bắt trần sẽ
            // nuốt luôn lỗi mất kết nối và báo "đã đánh giá rồi" sai sự thật.
            throw new ConflictException("Bạn đã đánh giá KTV này rồi");
        }

        await RecomputeRatingAsync(ktvId, ct);

        return ToDto(review);
    }

    public async Task<ReviewListDto> ListPublishedAsync(
        Guid ktvId, int page, int size, CancellationToken ct = default)
    {
        var query = db.Reviews.Where(r => r.KtvId == ktvId && r.Status == ReviewStatuses.Published);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .Skip((page - 1) * size)
            .Take(size)
            .ToListAsync(ct);

        return new ReviewListDto(items.Select(ToDto).ToList(), page, size, total);
    }

    public async Task<ReviewDto> ModerateAsync(
        Guid reviewId, Guid adminUserId, ModerateReviewDto dto, CancellationToken ct = default)
    {
        var review = await db.Reviews.FirstOrDefaultAsync(r => r.Id == reviewId, ct)
            ?? throw new NotFoundException("Không tìm thấy đánh giá");

        review.Status = dto.Status;
        review.RejectionReason = dto.Status == ReviewStatuses.Rejected ? dto.RejectionReason : null;
        review.ModeratedBy = adminUserId;
        review.ModeratedAt = DateTimeOffset.UtcNow;
        review.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        await RecomputeRatingAsync(review.KtvId, ct);

        return ToDto(review);
    }

    /// <summary>
    /// Tính lại rating_avg/rating_count từ các review đã đăng.
    ///
    /// Chạy lại toàn bộ thay vì cộng dồn: cộng dồn sẽ trôi dần mỗi khi có review bị
    /// gỡ hoặc đăng lại, và rating là dữ liệu gửi cho Google qua AggregateRating —
    /// sai lệch ở đó là vấn đề chính sách chứ không chỉ là hiển thị xấu.
    /// </summary>
    public async Task RecomputeRatingAsync(Guid ktvId, CancellationToken ct = default)
    {
        var stats = await db.Reviews
            .Where(r => r.KtvId == ktvId && r.Status == ReviewStatuses.Published)
            .GroupBy(_ => 1)
            .Select(g => new { Count = g.Count(), Sum = g.Sum(r => (int)r.Rating) })
            .FirstOrDefaultAsync(ct);

        var count = stats?.Count ?? 0;
        // NUMERIC(3,2) kèm CHECK (rating_avg BETWEEN 0 AND 5) — làm tròn ở đây thay
        // vì để Postgres tự cắt, để giá trị ghi xuống đúng bằng giá trị đã tính.
        var avg = count == 0 ? 0m : Math.Round((decimal)stats!.Sum / count, 2, MidpointRounding.AwayFromZero);

        await db.KtvProfiles
            .Where(k => k.Id == ktvId)
            .ExecuteUpdateAsync(s => s
                .SetProperty(k => k.RatingCount, count)
                .SetProperty(k => k.RatingAvg, avg), ct);
    }

    private static ReviewDto ToDto(Review r) =>
        new(r.Id, r.KtvId, r.Rating, r.Comment, r.Status, r.CreatedAt);
}
