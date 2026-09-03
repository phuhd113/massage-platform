using System.Security.Cryptography;
using System.Text;
using Massage.Api.Data;
using Massage.Api.Modules.Analytics.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Analytics;

/// <summary>
/// Đọc số liệu cho dashboard, và ghi lượt xem hồ sơ.
///
/// Hai loại sự kiện kia **không** đi qua đây mà ghi thẳng vào <see cref="IAnalyticsQueue"/>
/// từ nơi chúng xảy ra: impression ở <c>SearchService</c> (chỗ duy nhất biết cả kết quả
/// lẫn areaId đã resolve) và lead ở <c>LeadService</c> (chỗ duy nhất biết lượt đó có bị
/// gộp hay không). Bắt chúng vòng qua service này chỉ thêm một lớp phải giữ đồng bộ.
/// </summary>
public class AnalyticsService(AppDbContext db)
{
    /// <summary>Cửa sổ báo cáo trên dashboard.</summary>
    private static readonly TimeSpan Window = TimeSpan.FromDays(7);

    /// <summary>
    /// Cùng một người tải lại trang trong khoảng này chỉ tính một lượt xem.
    ///
    /// Rộng hơn cửa sổ gộp của lead (5 phút) vì hai hành vi khác nhau: bấm gọi lại
    /// là một ý định mới có thể xảy ra thật, còn F5 hay quay lại trang trong cùng
    /// một phiên duyệt web thì không. Không gộp thì chỉ cần KTV tự mở hồ sơ mình vài
    /// lần là số liệu đã sai — và đây chính là con số họ dùng để quyết định có mua
    /// gói đẩy tin nữa hay không.
    /// </summary>
    private static readonly TimeSpan DedupeWindow = TimeSpan.FromMinutes(30);

    /// <summary>
    /// Ghi nhận một lượt xem hồ sơ. Trả về <c>false</c> khi lượt này bị gộp vào lượt
    /// trước đó của cùng người xem.
    /// </summary>
    /// <remarks>
    /// Cố ý **không** ném lỗi khi KTV không tồn tại: hàm này chạy trên đường đọc của
    /// trang hồ sơ công khai, nên một lỗi ở đây sẽ làm hỏng trang mà khách đang xem.
    /// Mất một dòng thống kê thì không ai chết; mất trang hồ sơ thì mất khách.
    ///
    /// Lượt xem đi thẳng xuống DB chứ không qua hàng đợi như impression: nó cần đọc
    /// trước để gộp lượt lặp, mà đọc thì phải thấy được thứ vừa ghi. Lượng ghi cũng
    /// nhỏ hơn hai bậc — một lượt xem là một dòng, còn một lượt search là hai mươi.
    /// </remarks>
    public async Task<bool> RecordViewAsync(
        Guid ktvId, string? ip, string? userAgent, CancellationToken ct = default)
    {
        var hash = ComputeViewerHash(ip, userAgent);
        var since = DateTimeOffset.UtcNow - DedupeWindow;

        var seen = await db.AnalyticsEvents.AnyAsync(
            v => v.KtvId == ktvId
                 && v.Type == AnalyticsEventTypes.View
                 && v.ViewerHash == hash
                 && v.CreatedAt >= since,
            ct);

        if (seen) return false;

        // Không còn khoá ngoại tới ktv_profiles (bảng partition — xem ghi chú ở
        // AnalyticsEvent), nên phải tự kiểm KTV có thật. Thiếu bước này thì id bịa cũng
        // ghi được, và dashboard của người khác không bị ảnh hưởng nhưng bảng đầy rác.
        var exists = await db.KtvProfiles.AnyAsync(k => k.Id == ktvId, ct);
        if (!exists) return false;

        db.AnalyticsEvents.Add(new AnalyticsEvent
        {
            Type = AnalyticsEventTypes.View,
            KtvId = ktvId,
            ViewerHash = hash,
            CreatedAt = DateTimeOffset.UtcNow,
        });

        try
        {
            await db.SaveChangesAsync(ct);
            return true;
        }
        catch (DbUpdateException)
        {
            // Nuốt đúng loại lỗi này chứ không bắt Exception trần — mất kết nối DB vẫn
            // phải nổi lên để thấy được.
            db.ChangeTracker.Clear();
            return false;
        }
    }

    /// <summary>Số liệu 7 ngày của một KTV, kèm so sánh với 7 ngày liền trước.</summary>
    public async Task<KtvStatsDto> GetKtvStatsAsync(Guid ktvId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var thisWeek = now - Window;
        var lastWeek = now - Window - Window;

        // Một lượt quét cho cả hai tuần và cả ba loại sự kiện thay vì sáu câu riêng: index
        // (ktv_id, type, created_at) phục vụ được, và đếm có điều kiện rẻ hơn hẳn so với
        // quét lại cùng dải hàng nhiều lần.
        var stats = await db.AnalyticsEvents
            .Where(v => v.KtvId == ktvId && v.CreatedAt >= lastWeek)
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Views = g.Count(v =>
                    v.Type == AnalyticsEventTypes.View && v.CreatedAt >= thisWeek),
                ViewsPrev = g.Count(v =>
                    v.Type == AnalyticsEventTypes.View && v.CreatedAt < thisWeek),
                Impressions = g.Count(v =>
                    v.Type == AnalyticsEventTypes.Impression && v.CreatedAt >= thisWeek),
                ImpressionsPrev = g.Count(v =>
                    v.Type == AnalyticsEventTypes.Impression && v.CreatedAt < thisWeek),
            })
            .FirstOrDefaultAsync(ct);

        // Lead đọc từ bảng nghiệp vụ chứ không từ analytics: đây là con số đem tính tiền,
        // nên nó phải lấy từ nguồn không bao giờ bị dọn và không bao giờ bị bỏ khi hàng
        // đợi đầy.
        var leads = await db.Leads
            .CountAsync(l => l.KtvId == ktvId && l.CreatedAt >= thisWeek, ct);

        var views = stats?.Views ?? 0;
        var viewsPrev = stats?.ViewsPrev ?? 0;
        var impressions = stats?.Impressions ?? 0;

        return new KtvStatsDto(
            views,
            ChangePct(views, viewsPrev),
            leads,
            views > 0 ? Math.Round((decimal)leads * 100 / views, 1) : null,
            impressions,
            ChangePct(impressions, stats?.ImpressionsPrev ?? 0),
            // Tỉ lệ bấm vào: trong số lần hiện ra ở kết quả tìm kiếm, bao nhiêu lần khách
            // mở hồ sơ. Đây là con số nói gói đẩy tin có đang mua đúng thứ đáng mua không.
            impressions > 0 ? Math.Round((decimal)views * 100 / impressions, 1) : null);
    }

    /// <summary>
    /// Phần trăm thay đổi, hoặc null khi kỳ trước bằng 0 — chia cho 0 không có nghĩa và
    /// mọi cách diễn đạt ("+∞%", "+100%") đều là con số bịa.
    /// </summary>
    private static decimal? ChangePct(int current, int previous) =>
        previous > 0 ? Math.Round((decimal)(current - previous) * 100 / previous, 0) : null;

    /// <summary>
    /// Hash người xem để gộp lượt xem lặp.
    ///
    /// Cùng công thức với <c>LeadService.ComputeDeviceHash</c> nhưng **không** trộn
    /// user id vào: lượt xem không cần phân biệt khách đã đăng nhập với khách vãng
    /// lai, và không trộn id vào thì hash này không lần ngược về một tài khoản được.
    /// </summary>
    internal static string ComputeViewerHash(string? ip, string? userAgent)
    {
        var raw = $"{ip ?? "-"}|{userAgent ?? "-"}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    }
}
