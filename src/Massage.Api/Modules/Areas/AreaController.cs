using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Areas;

/// <summary>
/// Danh mục tỉnh/quận cho trang landing theo khu vực.
///
/// Đường dẫn phân cấp tỉnh → quận cố ý khớp 1:1 với URL công khai
/// <c>/massage-tai-nha/{tinh}/{quan}</c>: slug chỉ unique theo (slug, level) nên
/// tra cứu chỉ bằng slug sẽ nhập nhằng khi một tỉnh và một quận trùng tên.
/// </summary>
[ApiController]
[Route("areas")]
[Tags("Areas")]
[AllowAnonymous]
public class AreaController(AreaService service) : ControllerBase
{
    /// <summary>Cây tỉnh/thành kèm quận trực thuộc và số KTV đã duyệt.</summary>
    [HttpGet]
    public async Task<IActionResult> Tree(CancellationToken ct) =>
        Ok(await service.GetTreeAsync(ct));

    /// <summary>Một tỉnh/thành kèm danh sách quận trực thuộc.</summary>
    [HttpGet("{provinceSlug}")]
    public async Task<IActionResult> Province(string provinceSlug, CancellationToken ct) =>
        Ok(await service.GetProvinceAsync(provinceSlug, ct));

    /// <summary>Một quận/huyện kèm khu vực lân cận để liên kết chéo.</summary>
    [HttpGet("{provinceSlug}/{districtSlug}")]
    public async Task<IActionResult> District(
        string provinceSlug, string districtSlug, CancellationToken ct) =>
        Ok(await service.GetDistrictAsync(provinceSlug, districtSlug, ct));
}
