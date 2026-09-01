using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Reviews;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
}
