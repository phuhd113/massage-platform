using FluentValidation;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Promotions.UseCases;
using Massage.Promotion.Domain;
using Massage.Promotion.Domain.Ports;
using Massage.Wallet.Domain.Ports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Promotions;

public record BuyPromotionDto(Guid PackageId, Guid AreaId);

public class BuyPromotionDtoValidator : AbstractValidator<BuyPromotionDto>
{
    public BuyPromotionDtoValidator()
    {
        RuleFor(x => x.PackageId).NotEmpty();
        RuleFor(x => x.AreaId).NotEmpty();
    }
}

/// <summary>Catalog gói đẩy tin và campaign của KTV.</summary>
[ApiController]
[Tags("Promotions")]
public class PromotionController(
    AppDbContext db,
    IPromotionCatalog catalog,
    ICampaignRepository campaigns,
    ISlotAllocator slots,
    IClock clock,
    BuyPromotionUseCase buy,
    CancelCampaignUseCase cancel) : ControllerBase
{
    /// <summary>
    /// Danh sách gói. Truyền <c>areaId</c> để biết khu vực đó còn bao nhiêu chỗ
    /// trong khung ngày gần nhất — KTV cần con số này trước khi quyết định mua.
    /// </summary>
    [HttpGet("promotions/packages")]
    [AllowAnonymous]
    public async Task<IActionResult> Packages([FromQuery] Guid? areaId, CancellationToken ct)
    {
        var packages = await catalog.ListActiveAsync(ct);
        var now = clock.UtcNow;

        var items = new List<object>(packages.Count);
        foreach (var p in packages)
        {
            // Đếm tồn kho ở đúng khung mà chính gói này sẽ chiếm khi mua ngay bây
            // giờ. Trước đây mọi gói đều đếm theo khung ngày, nên Instant Boost —
            // gói bán theo giờ — sẽ báo còn chỗ trong khi lệnh mua báo hết, hoặc
            // ngược lại. Lấy khung đầu tiên vì đó là khung khan hiếm nhất: các khung
            // sau chưa ai đặt trước thì luôn rộng hơn.
            var window = p.WindowsFrom(now)[0];

            int? free = areaId is null
                ? null
                : await slots.CountFreeAsync(areaId.Value, p.Type, window, p.MaxSlotsPerArea, ct);

            items.Add(new
            {
                p.Id,
                p.Code,
                p.Name,
                p.Type,
                p.Price,
                p.DurationDays,
                // Thời lượng theo đơn vị thật của gói, để giao diện không phải đoán.
                p.DurationHours,
                p.MaxSlotsPerArea,
                p.BoostPoints,
                // Nói thẳng gói nào thật sự đảm bảo đứng trên KTV miễn phí — bán kèm
                // một lời hứa sai là thứ KTV sẽ phát hiện ra và mất niềm tin.
                p.GuaranteesTopPlacement,
                freeSlots = free,
                // Khung mà lần mua ngay bây giờ sẽ bắt đầu chiếm. Với gói theo giờ,
                // đây là thông tin KTV cần thấy trước khi trả tiền: mua lúc 20h05
                // thì boost chạy từ 21h, không phải ngay lập tức.
                startsAt = window,
            });
        }

        return Ok(items);
    }

    /// <summary>
    /// Mua một gói cho một khu vực.
    ///
    /// Bắt buộc gửi header <c>Idempotency-Key</c>: đây là thứ chặn double-click và
    /// retry mạng biến thành hai lần trừ tiền. Khoá do client sinh vì chỉ client
    /// biết hai request có phải cùng một ý định hay không.
    /// </summary>
    [HttpPost("campaigns")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Buy(BuyPromotionDto dto, CancellationToken ct)
    {
        var key = Request.Headers["Idempotency-Key"].ToString();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 100)
            throw new BadRequestException("Cần header Idempotency-Key (tối đa 100 ký tự)");

        var result = await buy.ExecuteAsync(User.GetUserId(), dto.PackageId, dto.AreaId, key, ct);
        return Ok(result);
    }

    /// <summary>Huỷ campaign đang chạy, hoàn tiền phần ngày chưa dùng về ví.</summary>
    [HttpDelete("campaigns/{id:guid}")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct) =>
        Ok(await cancel.ExecuteAsync(User.GetUserId(), id, ct));

    /// <summary>Campaign của chính mình.</summary>
    [HttpGet("ktv/campaigns")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> MyCampaigns(CancellationToken ct)
    {
        var userId = User.GetUserId();
        var ktvId = await db.KtvProfiles.Where(k => k.UserId == userId).Select(k => k.Id)
            .FirstOrDefaultAsync(ct);

        // Tài khoản chưa có hồ sơ thì danh sách chiến dịch là rỗng, không phải
        // "không tìm thấy": tài nguyên ở đây là danh sách của chính người gọi, và
        // nó luôn tồn tại. Trả 404 khiến mọi client phải phân biệt hai loại 404
        // khác nhau, và dashboard của KTV mới đăng ký thì hỏng cả trang.
        if (ktvId == Guid.Empty) return Ok(Array.Empty<object>());

        var now = clock.UtcNow;
        var items = (await campaigns.ListForKtvAsync(ktvId, ct)).Select(c => new
        {
            c.Id,
            c.AreaId,
            c.PackageType,
            c.BoostPoints,
            c.PricePaid,
            c.StartAt,
            c.EndAt,
            c.Status,
            c.RefundedAmount,
            isRunning = c.IsRunning(now),
        });

        return Ok(items);
    }
}
