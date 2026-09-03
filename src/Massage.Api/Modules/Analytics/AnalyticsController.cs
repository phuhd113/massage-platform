using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Massage.Api.Modules.Analytics;

/// <summary>Số liệu hiển thị của KTV.</summary>
[ApiController]
[Tags("Analytics")]
public class AnalyticsController(
    AnalyticsService analytics,
    KtvProfileService profiles) : ControllerBase
{
    /// <summary>
    /// Ghi nhận một lượt xem hồ sơ công khai.
    ///
    /// Endpoint riêng do trình duyệt gọi, **không** gộp vào <c>GET /ktv/by-slug/{slug}</c>:
    /// trang hồ sơ được Next.js cache 600 giây, nên nếu đếm ở đường đọc thì mọi lượt
    /// xem trong 10 phút chỉ thành một dòng — con số sẽ không phản ánh traffic thật
    /// mà lại trông hoàn toàn hợp lý, tức là sai một cách khó phát hiện nhất.
    /// </summary>
    [HttpPost("ktv/{id:guid}/views")]
    [AllowAnonymous]
    [EnableCors(CorsSetup.PublicSite)]
    [EnableRateLimiting(RateLimitPolicies.ProfileViews)]
    public async Task<IActionResult> RecordView(Guid id, CancellationToken ct)
    {
        await analytics.RecordViewAsync(
            id,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString() is { Length: > 0 } ua ? ua : null,
            ct);

        // Luôn 204 kể cả khi lượt xem bị gộp hoặc KTV không tồn tại: đây là beacon
        // gọi từ trang công khai, client không có việc gì làm với kết quả, và trả về
        // "đã gộp hay chưa" chỉ tạo thêm một kênh dò dữ liệu mà không ai cần.
        return NoContent();
    }

    /// <summary>Số liệu 7 ngày của chính mình, cho dashboard.</summary>
    [HttpGet("ktv/profile/stats")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<ActionResult<KtvStatsDto>> MyStats(CancellationToken ct)
    {
        var profile = await profiles.GetByUserIdAsync(User.GetUserId(), ct);
        return await analytics.GetKtvStatsAsync(profile.Id, ct);
    }
}
