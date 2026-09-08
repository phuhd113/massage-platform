using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Admin;
using Massage.Api.Modules.Auth.Entities;
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

        // Lead gần nhất của chính người này với chính KTV này, nếu có.
        //
        // **Không bắt buộc phải có.** Phần lớn khách bấm gọi trước khi đăng nhập —
        // lead lúc đó ẩn danh nên không bao giờ khớp được — và chặn họ đánh giá sẽ
        // cắt mất gần hết nguồn đánh giá thật, trong khi rating chính là thứ Google
        // đọc. Ở đây chỉ **ghi nhận** mối liên hệ khi nó tồn tại: một đánh giá có
        // lead là bằng chứng người viết từng thật sự liên hệ, còn thiếu nó thì chưa
        // kết luận được gì. Admin lọc theo dấu hiệu này qua `GET /admin/reviews`.
        var leadId = await db.Leads
            .Where(l => l.KtvId == ktvId && l.CustomerUserId == authorUserId)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => (Guid?)l.Id)
            .FirstOrDefaultAsync(ct);

        var review = new Review
        {
            KtvId = ktvId,
            AuthorUserId = authorUserId,
            LeadId = leadId,
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

    /// <summary>
    /// Đánh giá do chính người đang đăng nhập viết.
    ///
    /// Trả về **mọi** trạng thái, khác <see cref="ListPublishedAsync"/>: người viết
    /// phải thấy được đánh giá của mình đang bị gỡ và vì sao, nếu không nó chỉ đơn
    /// giản biến mất khỏi trang hồ sơ và họ sẽ viết lại — rồi nhận 409 vì ràng buộc
    /// một-tài-khoản-một-KTV.
    ///
    /// Lọc theo <paramref name="authorUserId"/> lấy từ token chứ không nhận id từ
    /// ngoài: đây là dữ liệu riêng, và một tham số id trên query string là đường để
    /// đọc đánh giá của người khác.
    /// </summary>
    public async Task<IReadOnlyList<MyReviewDto>> ListMineAsync(
        Guid authorUserId, CancellationToken ct = default) =>
        await db.Reviews
            .Where(r => r.AuthorUserId == authorUserId)
            .Join(db.KtvProfiles, r => r.KtvId, k => k.Id, (r, k) => new { Review = r, Ktv = k })
            .OrderByDescending(x => x.Review.CreatedAt)
            .Select(x => new MyReviewDto(
                x.Review.Id,
                x.Review.KtvId,
                x.Ktv.FullName,
                x.Ktv.Slug,
                x.Review.Rating,
                x.Review.Comment,
                x.Review.Status,
                x.Review.RejectionReason,
                x.Review.CreatedAt))
            .ToListAsync(ct);

    /// <summary>
    /// Hàng đợi rà soát đánh giá cho admin, đáng ngờ nhất lên trước.
    ///
    /// Thứ tự: chưa gắn được lead → tài khoản viết càng mới càng lên trước → mới nhất.
    /// Tài khoản lập xong đánh giá ngay chính là hình dạng của việc bơm sao, và xếp
    /// thuần theo thời gian thì mười đánh giá của mười tài khoản vừa lập nằm lẫn giữa
    /// những dòng bình thường.
    ///
    /// <paramref name="unverifiedOnly"/> chỉ **thu hẹp chỗ cần nhìn**, không phải bộ
    /// lọc gian lận: xem ghi chú ở <see cref="ReviewForModerationDto.HasLead"/>.
    /// </summary>
    public async Task<PagedResult<ReviewForModerationDto>> ListForModerationAsync(
        bool unverifiedOnly, int page, int limit, CancellationToken ct = default)
    {
        var query =
            from r in db.Reviews
            join k in db.KtvProfiles on r.KtvId equals k.Id
            join u in db.Users on r.AuthorUserId equals u.Id
            where !unverifiedOnly || r.LeadId == null
            select new { Review = r, Ktv = k, Author = u };

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderBy(x => x.Review.LeadId != null)
            .ThenBy(x => x.Review.CreatedAt - x.Author.CreatedAt)
            .ThenByDescending(x => x.Review.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);

        var items = rows
            .Select(x => new ReviewForModerationDto(
                x.Review.Id,
                x.Review.KtvId,
                x.Ktv.FullName,
                x.Ktv.Slug,
                x.Review.AuthorUserId,
                x.Review.Rating,
                x.Review.Comment,
                x.Review.Status,
                x.Review.LeadId != null,
                // Âm là không thể xảy ra (tài khoản phải có trước đánh giá), nhưng
                // kẹp về 0 để một hàng dữ liệu lệch không thành con số vô nghĩa.
                Math.Max(0, (x.Review.CreatedAt - x.Author.CreatedAt).TotalHours),
                x.Review.CreatedAt))
            .ToList();

        return new PagedResult<ReviewForModerationDto>(items, total, page, limit);
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
