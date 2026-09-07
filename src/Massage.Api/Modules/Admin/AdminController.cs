using Massage.Api.Common;
using Massage.Api.Common.Storage;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles;
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
public class AdminController(AdminService service, MediaUrls urls) : ControllerBase
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
                p.BaseAddress,
                p.ServiceRadiusKm,
                p.VerificationStatus,
                p.RejectionReason,
                p.CreatedAt,
                AvatarUrl = urls.Public(p.AvatarKey),
                // URL ký hạn ngắn: file chứng chỉ là ảnh chụp giấy tờ tuỳ thân, và
                // bucket để private nên đây là đường duy nhất mở được. Hạn ngắn hơn
                // hẳn một phiên làm việc, admin mở lại trang là có URL mới.
                Certifications = p.Certifications.Select(c => new
                {
                    c.Id,
                    c.Name,
                    FileUrl = urls.Signed(c.StorageKey),
                    c.VerifyStatus,
                }),
                // Null nghĩa là KTV chưa gửi CCCD — và hồ sơ đó **không duyệt được**
                // (xem AdminService.DecideProfileAsync). Trả về ở đây để trang duyệt
                // nói được lý do trước khi admin bấm, thay vì để họ nhận lỗi 400.
                IdentityDocument = p.IdentityDocument is null ? null : new
                {
                    FrontUrl = urls.Signed(p.IdentityDocument.FrontKey),
                    BackUrl = urls.Signed(p.IdentityDocument.BackKey),
                    p.IdentityDocument.VerifyStatus,
                    p.IdentityDocument.RejectionReason,
                    p.IdentityDocument.SubmittedAt,
                },
                // Điều kiện bắt buộc thứ hai. Cùng lý do: admin phải thấy còn thiếu gì
                // trước khi bấm duyệt.
                p.CommittedAt,
                CommitmentsUpToDate = p.CommitmentVersion == KtvCommitments.CurrentVersion,
                // Ai mang hồ sơ này về. Null với hồ sơ tự đến qua SEO — đó là đa số.
                ReferredBy = p.ReferredByCollaboratorId is { } rid
                             && result.Referrers.TryGetValue(rid, out var r)
                    ? new { Code = r.Code, Name = r.FullName, p.ReferredAt }
                    : null,
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

    /// <summary>
    /// Duyệt hoặc từ chối ảnh CCCD của một hồ sơ (cả hai mặt cùng lúc).
    /// </summary>
    /// <remarks>
    /// Đường dẫn theo <c>ktvId</c> chứ không theo id của bản ghi CCCD: một hồ sơ có
    /// nhiều nhất một CCCD, nên id đó không thêm thông tin gì mà lại buộc trang duyệt
    /// phải mang theo một định danh thứ hai.
    /// </remarks>
    [HttpPatch("ktv/{id:guid}/identity/verify")]
    public async Task<IActionResult> VerifyIdentityDocument(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var d = await service.DecideIdentityDocumentAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { d.Id, d.KtvId, d.VerifyStatus, d.RejectionReason, d.VerifiedBy, d.VerifiedAt });
    }

    /// <summary>Hàng đợi CCCD chờ duyệt, gửi sớm nhất lên đầu.</summary>
    /// <remarks>
    /// Tách khỏi hàng đợi hồ sơ vì cùng lý do với hàng đợi ảnh: KTV gửi lại CCCD sau
    /// khi bị từ chối không làm đổi trạng thái hồ sơ, nên lần gửi lại đó sẽ không xuất
    /// hiện trong danh sách lọc theo trạng thái hồ sơ.
    /// </remarks>
    [HttpGet("identity-documents")]
    public async Task<IActionResult> ListIdentityDocuments(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var (items, total) = await service.ListIdentityDocumentsAsync(
            status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = items.Select(d => new
            {
                d.Id,
                d.KtvId,
                KtvName = d.Ktv!.FullName,
                KtvSlug = d.Ktv.Slug,
                KtvVerificationStatus = d.Ktv.VerificationStatus,
                FrontUrl = urls.Signed(d.FrontKey),
                BackUrl = urls.Signed(d.BackKey),
                d.VerifyStatus,
                d.RejectionReason,
                d.SubmittedAt,
            }),
            total,
            page,
            limit,
        });
    }

    /// <summary>Duyệt hoặc từ chối một chứng chỉ hành nghề.</summary>
    [HttpPatch("certifications/{id:guid}/verify")]
    public async Task<IActionResult> VerifyCertification(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var c = await service.DecideCertificationAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { c.Id, c.VerifyStatus, c.RejectionReason, c.VerifiedBy, c.VerifiedAt });
    }

    /// <summary>
    /// Hàng đợi ảnh hồ sơ chờ duyệt, cũ nhất lên đầu.
    /// </summary>
    /// <remarks>
    /// Tách khỏi hàng đợi hồ sơ vì hồ sơ đã duyệt vẫn thêm ảnh mới được: lọc theo
    /// trạng thái hồ sơ thì những ảnh đó không xuất hiện ở bất kỳ đâu, và một ảnh
    /// không ai xem trên trang công khai của ngành này là rủi ro cho toàn bộ tên miền.
    /// </remarks>
    [HttpGet("photos")]
    public async Task<IActionResult> ListPhotos(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var (items, total) = await service.ListPendingPhotosAsync(
            status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = items.Select(p => new
            {
                p.Id,
                p.KtvId,
                KtvName = p.Ktv!.FullName,
                KtvSlug = p.Ktv.Slug,
                Url = urls.Public(p.StorageKey),
                p.Caption,
                p.VerifyStatus,
                p.RejectionReason,
                p.CreatedAt,
            }),
            total,
            page = Math.Max(1, page),
            limit = Math.Clamp(limit, 1, 100),
        });
    }

    /// <summary>Duyệt hoặc từ chối một ảnh hồ sơ.</summary>
    [HttpPatch("photos/{id:guid}/verify")]
    public async Task<IActionResult> VerifyPhoto(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var p = await service.DecidePhotoAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { p.Id, p.VerifyStatus, p.RejectionReason, p.VerifiedBy, p.VerifiedAt });
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
