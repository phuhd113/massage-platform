using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Search;

/// <summary>Tìm KTV theo vị trí GPS hoặc theo khu vực hành chính.</summary>
[ApiController]
[Route("search")]
[Tags("Search")]
[AllowAnonymous]
public class SearchController(SearchService service) : ControllerBase
{
    /// <summary>
    /// Tìm KTV đã duyệt. Truyền <c>lat</c>/<c>lon</c> để tìm quanh vị trí khách,
    /// hoặc <c>areaSlug</c> cho trang landing khu vực render ở server.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] SearchQueryDto query, CancellationToken ct) =>
        Ok(await service.SearchAsync(query, ct));
}
