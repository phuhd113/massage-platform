using Massage.Api.Modules.Areas;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.ServiceCatalog;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.PublicSite;

public record SitemapAreaEntry(string Path, string Province, string? District, int KtvCount);

public record SitemapKtvEntry(string Path, DateTimeOffset LastModified);

public record SitemapServiceEntry(string Path);

public record SitemapDto(
    IReadOnlyList<SitemapKtvEntry> Ktv,
    IReadOnlyList<SitemapAreaEntry> Areas,
    IReadOnlyList<SitemapServiceEntry> Services,
    int MinKtvForIndex);

/// <summary>Dữ liệu cho frontend sinh sitemap.xml.</summary>
[ApiController]
[Route("public")]
[Tags("Public Site")]
[AllowAnonymous]
public class SitemapController(
    KtvProfileService profiles,
    AreaService areas,
    ServiceCatalogService catalog) : ControllerBase
{
    /// <summary>
    /// Tiền tố URL trang khu vực, phải khớp <c>AREA_PATH_PREFIX</c> ở
    /// <c>apps/web/src/lib/site.ts</c>.
    ///
    /// Sitemap là lời khai với Google về URL chính tắc, nên nó **không được** liệt kê
    /// đường dẫn đang bị 301: làm vậy là tự bảo Google đi vào một hop rồi mới tới đích,
    /// và canonical trên trang sẽ không khớp với thứ vừa khai. Đổi slug thì phải đổi cả
    /// hai chỗ trong cùng một lần.
    /// </summary>
    private const string AreaPathPrefix = "/massage-tan-noi";

    /// <summary>
    /// Toàn bộ URL được phép index, chia theo loại trang.
    ///
    /// Lọc ngay tại đây thay vì để frontend tự lọc: sitemap là lời khai với Google
    /// rằng "những trang này đáng index". Đưa vào đó một trang khu vực chưa đủ KTV
    /// là tự khai báo thin content — tệ hơn nhiều so với không khai báo gì.
    /// </summary>
    [HttpGet("sitemap")]
    public async Task<ActionResult<SitemapDto>> Sitemap(CancellationToken ct)
    {
        var tree = await areas.GetTreeAsync(ct);
        var areaEntries = new List<SitemapAreaEntry>();

        foreach (var province in tree)
        {
            if (province.Indexable)
                areaEntries.Add(new SitemapAreaEntry(
                    $"{AreaPathPrefix}/{province.Slug}", province.Slug, null, province.KtvCount));

            areaEntries.AddRange(province.Children
                .Where(d => d.Indexable)
                .Select(d => new SitemapAreaEntry(
                    $"{AreaPathPrefix}/{province.Slug}/{d.Slug}", province.Slug, d.Slug, d.KtvCount)));
        }

        var ktv = (await profiles.GetSitemapEntriesAsync(ct))
            .Select(e => new SitemapKtvEntry($"/ktv/{e.Slug}-{e.Id}", e.LastModified))
            .ToList();

        var services = (await catalog.ListAsync(ct))
            .Select(s => new SitemapServiceEntry($"/dich-vu/{s.Slug}"))
            .ToList();

        return new SitemapDto(ktv, areaEntries, services, AreaService.MinKtvForIndex);
    }
}
