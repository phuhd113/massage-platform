using Massage.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Massage.Api.Modules.Leads;

/// <summary>Ghi nhận lượt khách bấm liên hệ với KTV.</summary>
[ApiController]
[Route("leads")]
[Tags("Leads")]
public class LeadController(LeadService service) : ControllerBase
{
    /// <summary>
    /// Ghi nhận một lượt bấm gọi / mở Zalo. Không cần đăng nhập — phần lớn khách
    /// liên hệ trước khi tạo tài khoản.
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [EnableCors(CorsSetup.PublicSite)]
    [EnableRateLimiting(RateLimitPolicies.Leads)]
    public async Task<IActionResult> Create(CreateLeadDto dto, CancellationToken ct)
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
