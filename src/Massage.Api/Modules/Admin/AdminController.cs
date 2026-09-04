using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Reviews;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Admin;

/// <summary>Duyệt hồ sơ KTV và chứng chỉ. Chỉ tài khoản ADMIN truy cập được.</summary>
[ApiController]
[Route("admin")]
[Tags("Admin")]
[Authorize(Roles = UserRoles.Admin)]
public class AdminController(AdminService service) : ControllerBase
{
    /// <summary>Danh sách hồ sơ KTV theo trạng thái duyệt.</summary>
    /// <param name="status">PENDING (mặc định), VERIFIED hoặc REJECTED.</param>
    /// <param name="page">Trang, bắt đầu từ 1.</param>
    /// <param name="limit">Số bản ghi mỗi trang, tối đa 100.</param>
    [HttpGet("ktv")]
    public async Task<IActionResult> ListProfiles(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var result = await service.ListProfilesAsync(status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = result.Items.Select(p => new
            {
                p.Id,
                p.FullName,
                p.Slug,
                p.Bio,
                p.BaseAddress,
                p.ServiceRadiusKm,
                p.VerificationStatus,
                p.RejectionReason,
                p.CreatedAt,
                Certifications = p.Certifications.Select(c => new { c.Id, c.Name, c.FileUrl, c.VerifyStatus }),
            }),
            total = result.Total,
            page = result.Page,
            limit = result.Limit,
        });
    }

    /// <summary>Duyệt hoặc từ chối một hồ sơ KTV.</summary>
    [HttpPatch("ktv/{id:guid}/verify")]
    public async Task<IActionResult> VerifyProfile(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var p = await service.DecideProfileAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { p.Id, p.VerificationStatus, p.RejectionReason, p.VerifiedBy, p.VerifiedAt });
    }

    /// <summary>Duyệt hoặc từ chối một chứng chỉ hành nghề.</summary>
    [HttpPatch("certifications/{id:guid}/verify")]
    public async Task<IActionResult> VerifyCertification(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var c = await service.DecideCertificationAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { c.Id, c.VerifyStatus, c.RejectionReason, c.VerifiedBy, c.VerifiedAt });
    }

    /// <summary>
    /// Danh sách đánh giá để rà soát, đáng ngờ nhất lên trước.
    /// </summary>
    /// <remarks>
    /// Bổ sung cho <c>PATCH reviews/{id}/moderate</c>: trước đây admin gỡ được một
    /// đánh giá nhưng không có đường nào **tìm ra** đánh giá đáng gỡ, nên cơ chế kiểm
    /// duyệt chỉ chạy khi có người báo cáo.
    ///
    /// <paramref name="unverifiedOnly"/> lọc những đánh giá không gắn được với một
    /// lượt liên hệ nào. Đó là **dấu hiệu**, không phải bằng chứng: khách bấm gọi lúc
    /// chưa đăng nhập thì lead ẩn danh và không bao giờ khớp, nên phần lớn đánh giá
    /// thật cũng rơi vào nhóm này. Nó chỉ thu hẹp chỗ cần nhìn.
    /// </remarks>
    [HttpGet("reviews")]
    public async Task<IActionResult> ListReviews(
        [FromServices] ReviewService reviews,
        CancellationToken ct,
        [FromQuery] bool unverifiedOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        if (page < 1 || limit is < 1 or > 200)
            throw new BadRequestException("page ≥ 1 và limit trong khoảng 1 – 200");

        return Ok(await reviews.ListForModerationAsync(unverifiedOnly, page, limit, ct));
    }

    /// <summary>
    /// Gỡ hoặc khôi phục một đánh giá. Đánh giá được đăng ngay khi gửi, nên đây là
    /// đường duy nhất để xử lý nội dung vi phạm — và nó tính lại rating của KTV.
    /// </summary>
    [HttpPatch("reviews/{id:guid}/moderate")]
    public async Task<IActionResult> ModerateReview(
        Guid id,
        ModerateReviewDto dto,
        [FromServices] ReviewService reviews,
        CancellationToken ct) =>
        Ok(await reviews.ModerateAsync(id, User.GetUserId(), dto, ct));

    /// <summary>
    /// Doanh thu theo ngày, khu vực và loại gói.
    ///
    /// Tính từ sổ cái ví (bút toán CAPTURE và REFUND) chứ không từ bảng campaign:
    /// sổ cái là nơi tiền thật sự đổi chủ, còn campaign chỉ mô tả thứ đã bán. Nếu
    /// hai nguồn lệch nhau thì con số đúng là con số ở sổ.
    /// </summary>
    [HttpGet("revenue")]
    public async Task<IActionResult> Revenue(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null)
    {
        var start = from ?? DateTimeOffset.UtcNow.AddDays(-30);
        var end = to ?? DateTimeOffset.UtcNow;
        if (end <= start) throw new BadRequestException("Khoảng thời gian không hợp lệ");

        var rows = await db.WalletTransactions.AsNoTracking()
            .Where(t => t.CreatedAt >= start && t.CreatedAt < end && t.CampaignId != null)
            .Join(db.Campaigns, t => t.CampaignId, c => c.Id, (t, c) => new { t.Amount, c.AreaId, c.PackageType })
            .GroupBy(x => new { x.AreaId, x.PackageType })
            .Select(g => new
            {
                g.Key.AreaId,
                g.Key.PackageType,
                // Bút toán CAPTURE mang dấu âm, REFUND dấu dương — đảo dấu tổng để
                // ra doanh thu ròng đã trừ hoàn tiền.
                NetRevenue = -g.Sum(x => x.Amount),
                Transactions = g.Count(),
            })
            .OrderByDescending(x => x.NetRevenue)
            .ToListAsync(ct);

        return Ok(new { from = start, to = end, total = rows.Sum(r => r.NetRevenue), items = rows });
    }
}
