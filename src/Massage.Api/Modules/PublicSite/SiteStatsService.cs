using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.PublicSite;

/// <summary>
/// Ba con số ở đầu trang chủ.
///
/// Mọi trường nullable trừ <paramref name="VerifiedKtvCount"/>: sàn mới mở chưa có
/// đánh giá nào và chưa ai khai giá là trạng thái bình thường. Trang chủ phải đọc
/// được khi cả hai đều rỗng — xem <c>buildHomeStats</c> ở frontend.
/// </summary>
public record SiteStatsDto(int VerifiedKtvCount, decimal? RatingAvg, int RatingCount);

public class SiteStatsService(AppDbContext db)
{
    /// <summary>
    /// Số liệu toàn sàn, chỉ tính hồ sơ **đã duyệt**.
    ///
    /// Cùng định nghĩa "đã duyệt" với <c>AreaService</c> và <c>SearchService</c>: đây là
    /// con số khách đối chiếu với những gì họ đếm được trên trang khu vực, nên một
    /// định nghĩa lệch ở đây sẽ hiện ra thành hai con số mâu thuẫn trên cùng một site.
    /// </summary>
    public async Task<SiteStatsDto> GetAsync(CancellationToken ct = default)
    {
        var verified = db.KtvProfiles.Where(k => k.VerificationStatus == VerificationStatuses.Verified);

        var count = await verified.CountAsync(ct);

        // Trung bình có trọng số theo số đánh giá, giống hệt số liệu khu vực — và cộng
        // qua double vì `rating_avg` là NUMERIC(3,2): giữ nguyên scale đó thì tích
        // `4.60 * 500` tràn cột. Xem ghi chú dài hơn ở AreaService.GetStatsAsync.
        var rating = await verified
            .Where(k => k.RatingCount > 0)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Weighted = (double?)g.Sum(k => (double)k.RatingAvg * k.RatingCount),
                Count = g.Sum(k => k.RatingCount),
            })
            .FirstOrDefaultAsync(ct);

        var ratingCount = rating?.Count ?? 0;

        return new SiteStatsDto(
            count,
            ratingCount > 0 && rating?.Weighted is { } w
                ? Math.Round((decimal)(w / ratingCount), 1)
                : null,
            ratingCount);
    }
}
