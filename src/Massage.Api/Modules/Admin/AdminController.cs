using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Admin;

[ApiController]
[Route("admin")]
[Authorize(Roles = UserRoles.Admin)]
public class AdminController(AdminService service) : ControllerBase
{
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

    [HttpPatch("ktv/{id:guid}/verify")]
    public async Task<IActionResult> VerifyProfile(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var p = await service.DecideProfileAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { p.Id, p.VerificationStatus, p.RejectionReason, p.VerifiedBy, p.VerifiedAt });
    }

    [HttpPatch("certifications/{id:guid}/verify")]
    public async Task<IActionResult> VerifyCertification(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var c = await service.DecideCertificationAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { c.Id, c.VerifyStatus, c.RejectionReason, c.VerifiedBy, c.VerifiedAt });
    }
}
