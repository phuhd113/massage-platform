using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.ServiceCatalog.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.ServiceCatalog;

/// <summary>Danh mục dịch vụ và bảng giá theo từng KTV.</summary>
[ApiController]
[Tags("Service Catalog")]
public class ServiceCatalogController(
    ServiceCatalogService catalog,
    KtvProfileService profiles) : ControllerBase
{
    /// <summary>Danh mục dịch vụ đang cung cấp.</summary>
    [HttpGet("services")]
    [AllowAnonymous]
    public async Task<IActionResult> List(CancellationToken ct) =>
        Ok((await catalog.ListAsync(ct)).Select(ToDto));

    /// <summary>Chi tiết một dịch vụ theo slug — nguồn dữ liệu cho trang /dich-vu/{slug}.</summary>
    [HttpGet("services/{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct) =>
        Ok(ToDto(await catalog.GetBySlugAsync(slug, ct)));

    /// <summary>Bảng giá dịch vụ của chính mình.</summary>
    [HttpGet("ktv/profile/services")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> MyServices(CancellationToken ct)
    {
        var profile = await profiles.GetByUserIdAsync(User.GetUserId(), ct);
        return Ok((await catalog.ListForKtvAsync(profile.Id, ct)).Select(ToDto));
    }

    /// <summary>Thay toàn bộ bảng giá dịch vụ của chính mình.</summary>
    [HttpPut("ktv/profile/services")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> ReplaceMyServices(ReplaceKtvServicesDto dto, CancellationToken ct)
    {
        var profile = await profiles.GetByUserIdAsync(User.GetUserId(), ct);
        return Ok((await catalog.ReplaceForKtvAsync(profile.Id, dto, ct)).Select(ToDto));
    }

    internal static object ToDto(Service s) => new
    {
        s.Id,
        s.Name,
        s.Slug,
        s.Description,
        s.SortOrder,
    };

    internal static object ToDto(KtvService ks) => new
    {
        ks.ServiceId,
        Name = ks.Service?.Name,
        Slug = ks.Service?.Slug,
        ks.PriceFrom,
        ks.DurationMin,
    };
}
