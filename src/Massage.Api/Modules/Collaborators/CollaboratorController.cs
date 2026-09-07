using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Collaborators.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Collaborators;

/// <summary>Cộng tác viên và mã giới thiệu. Quản lý chỉ dành cho ADMIN.</summary>
[ApiController]
[Route("collaborators")]
[Tags("Collaborators")]
[Authorize(Roles = UserRoles.Admin)]
public class CollaboratorController(CollaboratorService service) : ControllerBase
{
    /// <summary>Danh sách cộng tác viên kèm số hồ sơ đã giới thiệu.</summary>
    [HttpGet]
    public async Task<IActionResult> List(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        if (status is not (null or CollaboratorStatuses.Active or CollaboratorStatuses.Disabled))
            throw new BadRequestException("Status phải là ACTIVE hoặc DISABLED");

        var (items, total) = await service.ListAsync(
            status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new { items, total, page, limit });
    }

    /// <summary>Thêm cộng tác viên mới.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(UpsertCollaboratorDto dto, CancellationToken ct)
    {
        var c = await service.CreateAsync(dto, ct);
        return Created($"/collaborators/{c.Id}", ToDto(c));
    }

    /// <summary>Sửa thông tin hoặc bật/tắt một cộng tác viên. Không đổi được mã.</summary>
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(
        Guid id, UpdateCollaboratorDto dto, CancellationToken ct) =>
        Ok(ToDto(await service.UpdateAsync(id, dto, ct)));

    /// <summary>Hồ sơ KTV do một cộng tác viên giới thiệu.</summary>
    [HttpGet("{id:guid}/ktv")]
    public async Task<IActionResult> ListReferred(
        Guid id,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        var (items, total) = await service.ListReferredAsync(
            id, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new { items, total, page, limit });
    }

    private static object ToDto(Collaborator c) => new
    {
        c.Id,
        c.Code,
        c.FullName,
        c.Phone,
        c.Status,
        c.Note,
        c.CreatedAt,
    };
}
