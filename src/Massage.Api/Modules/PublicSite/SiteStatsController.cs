using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.PublicSite;

/// <summary>Số liệu tóm tắt toàn sàn cho trang chủ.</summary>
[ApiController]
[Route("public")]
[Tags("Public Site")]
[AllowAnonymous]
public class SiteStatsController(SiteStatsService stats) : ControllerBase
{
    /// <summary>Số KTV đã duyệt và điểm trung bình toàn sàn.</summary>
    [HttpGet("stats")]
    public async Task<ActionResult<SiteStatsDto>> Get(CancellationToken ct) =>
        await stats.GetAsync(ct);
}
