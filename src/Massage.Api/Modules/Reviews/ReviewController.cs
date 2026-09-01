using Massage.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Massage.Api.Modules.Reviews;

/// <summary>Đánh giá của khách dành cho KTV.</summary>
[ApiController]
[Route("ktv/{ktvId:guid}/reviews")]
[Tags("Reviews")]
public class ReviewController(ReviewService service) : ControllerBase
{
    /// <summary>Danh sách đánh giá đã đăng của một KTV.</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> List(
        Guid ktvId,
        CancellationToken ct,
        [FromQuery] int page = 1,
        [FromQuery] int size = 10)
    {
        if (page < 1 || size is < 1 or > 50)
            throw new BadRequestException("page ≥ 1 và size trong khoảng 1 – 50");

        return Ok(await service.ListPublishedAsync(ktvId, page, size, ct));
    }

    /// <summary>Gửi đánh giá cho một KTV. Mỗi tài khoản chỉ đánh giá một KTV một lần.</summary>
    [HttpPost]
    [Authorize]
    [EnableRateLimiting(RateLimitPolicies.Reviews)]
    public async Task<IActionResult> Create(Guid ktvId, CreateReviewDto dto, CancellationToken ct) =>
        Ok(await service.CreateAsync(ktvId, User.GetUserId(), dto, ct));
}
