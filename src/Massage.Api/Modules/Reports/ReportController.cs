using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Reports.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Massage.Api.Modules.Reports;

/// <summary>Báo cáo hồ sơ KTV có nội dung vi phạm.</summary>
[ApiController]
[Route("reports")]
[Tags("Reports")]
public class ReportController(ReportService service) : ControllerBase
{
    /// <summary>
    /// Gửi báo cáo vi phạm cho một hồ sơ. Không cần đăng nhập.
    /// </summary>
    /// <remarks>
    /// Gọi **thẳng** từ trình duyệt như <c>POST /leads</c> chứ không qua proxy Next,
    /// vì cùng một lý do: cơ chế gộp dựa trên IP và user agent của khách. Qua proxy
    /// thì mọi người báo cáo mang chung IP của server, và cửa sổ gộp 24 giờ sẽ nuốt
    /// mất báo cáo của tất cả những người còn lại sau người đầu tiên.
    /// </remarks>
    [HttpPost]
    [AllowAnonymous]
    [EnableCors(CorsSetup.PublicSite)]
    [EnableRateLimiting(RateLimitPolicies.Reports)]
    public async Task<IActionResult> Create(CreateReportDto dto, CancellationToken ct)
    {
        var result = await service.CreateAsync(
            dto,
            User.TryGetUserId(),
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null,
            ct);

        return Ok(result);
    }
}

/// <summary>Hàng đợi xử lý báo cáo vi phạm, dành cho admin.</summary>
[ApiController]
[Route("admin/reports")]
[Tags("Admin")]
[Authorize(Roles = UserRoles.Admin)]
public class AdminReportController(ReportService service) : ControllerBase
{
    /// <summary>
    /// Danh sách báo cáo theo trạng thái, hồ sơ bị báo cáo nhiều lần xếp lên trước.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        CancellationToken ct,
        [FromQuery] string status = ProfileReportStatuses.Pending,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        if (!ProfileReportStatuses.All.Contains(status))
            throw new BadRequestException(
                $"Trạng thái phải là một trong: {string.Join(", ", ProfileReportStatuses.All)}");

        if (page < 1 || limit is < 1 or > 100)
            throw new BadRequestException("page ≥ 1 và limit trong khoảng 1 – 100");

        return Ok(await service.ListAsync(status, page, limit, ct));
    }

    /// <summary>
    /// Chốt một báo cáo: đã xử lý hoặc bỏ qua.
    ///
    /// Việc gỡ hồ sơ xuống là một hành động riêng qua <c>PATCH /admin/ktv/{id}/verify</c>
    /// — endpoint này chỉ đóng dòng trong hàng đợi.
    /// </summary>
    [HttpPatch("{id:guid}/resolve")]
    public async Task<IActionResult> Resolve(
        Guid id, ResolveReportDto dto, CancellationToken ct) =>
        Ok(await service.ResolveAsync(id, User.GetUserId(), dto, ct));
}
