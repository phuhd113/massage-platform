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

/// <summary>Dữ liệu của chính tài khoản đang đăng nhập.</summary>
/// <remarks>
/// Controller riêng vì route không nằm dưới <c>ktv/{ktvId}</c>: đây là dữ liệu theo
/// **người dùng**, không theo KTV.
/// </remarks>
[ApiController]
[Route("me")]
[Tags("Reviews")]
[Authorize]
public class MyReviewController(ReviewService service) : ControllerBase
{
    /// <summary>
    /// Đánh giá tôi đã viết, mới nhất trước.
    /// </summary>
    /// <remarks>
    /// Không phân trang: ràng buộc <c>UNIQUE (ktv_id, author_user_id)</c> giới hạn
    /// mỗi tài khoản một đánh giá cho mỗi KTV, nên danh sách này tăng theo số KTV
    /// khách từng dùng — vài chục dòng là nhiều. Thêm phân trang bây giờ là thêm
    /// tham số phải giữ mãi cho một vấn đề chưa tồn tại.
    /// </remarks>
    [HttpGet("reviews")]
    public async Task<IActionResult> Mine(CancellationToken ct) =>
        Ok(await service.ListMineAsync(User.GetUserId(), ct));
}
