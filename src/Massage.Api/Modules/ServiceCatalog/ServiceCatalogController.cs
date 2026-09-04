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
    /// <remarks>
    /// Kèm <c>priceFrom</c> — giá thấp nhất đang có trên sàn cho dịch vụ đó — vì thẻ
    /// dịch vụ ở trang chủ hiển thị nó. Lấy một lượt cho cả danh mục thay vì để
    /// frontend gọi thêm mỗi thẻ một lần.
    /// </remarks>
    [HttpGet("services")]
    [AllowAnonymous]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var floors = await catalog.GetPriceFloorsAsync(ct);
        return Ok((await catalog.ListAsync(ct))
            .Select(s => ToDto(s, floors.TryGetValue(s.Id, out var p) ? p : null)));
    }

    /// <summary>Chi tiết một dịch vụ theo slug — nguồn dữ liệu cho trang /dich-vu/{slug}.</summary>
    [HttpGet("services/{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBySlug(string slug, CancellationToken ct)
    {
        // Cũng kèm priceFrom như endpoint danh sách. Trả về cùng một hình dạng ở cả
        // hai chỗ, dù trang /dich-vu/{slug} hiện chưa hiển thị giá: một trường luôn
        // null ở đúng một endpoint là cái bẫy đọc như "dịch vụ này chưa ai khai giá".
        var service = await catalog.GetBySlugAsync(slug, ct);
        return Ok(ToDto(service, await catalog.GetPriceFloorAsync(service.Id, ct)));
    }

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

    /// <param name="priceFrom">
    /// Giá thấp nhất đang có trên sàn. Cố ý <c>null</c> chứ không phải 0 khi chưa KTV
    /// nào khai giá — "từ 0 ₫" đọc như dịch vụ miễn phí.
    /// </param>
    internal static object ToDto(Service s, decimal? priceFrom = null) => new
    {
        s.Id,
        s.Name,
        s.Slug,
        s.Description,
        s.SortOrder,
        PriceFrom = priceFrom,
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
