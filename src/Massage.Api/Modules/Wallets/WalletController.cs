using FluentValidation;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Wallets.Infrastructure;
using Massage.Api.Modules.Wallets.UseCases;
using Massage.Wallet.Domain.Ports;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Wallets;

public record StartTopUpDto(decimal Amount);

public class StartTopUpDtoValidator : AbstractValidator<StartTopUpDto>
{
    public StartTopUpDtoValidator()
    {
        RuleFor(x => x.Amount)
            .InclusiveBetween(StartTopUpUseCase.MinAmount, StartTopUpUseCase.MaxAmount)
            .WithMessage($"Số tiền nạp phải từ {StartTopUpUseCase.MinAmount:N0}đ đến {StartTopUpUseCase.MaxAmount:N0}đ");
        RuleFor(x => x.Amount).Must(a => a == decimal.Truncate(a))
            .WithMessage("VND không có phần lẻ");
    }
}

/// <summary>Ví của KTV: số dư, sổ giao dịch và nạp tiền.</summary>
[ApiController]
[Route("wallet")]
[Tags("Wallet")]
public class WalletController(
    AppDbContext db,
    IWalletRepository wallets,
    StartTopUpUseCase startTopUp,
    ConfirmTopUpUseCase confirmTopUp,
    IPaymentGateway gateway,
    ILogger<WalletController> logger) : ControllerBase
{
    /// <summary>Số dư ví: tổng, phần đang bị giữ, và phần dùng được.</summary>
    [HttpGet("balance")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Balance(CancellationToken ct)
    {
        var wallet = await wallets.FindAsync(User.GetUserId(), ct);

        return Ok(new
        {
            balance = wallet?.Balance.Amount ?? 0m,
            held = wallet?.Held.Amount ?? 0m,
            available = wallet?.Available.Amount ?? 0m,
        });
    }

    /// <summary>
    /// Sổ giao dịch để KTV tự đối chiếu. <c>balanceAfter</c> có mặt ở từng dòng nên
    /// khi thấy lệch, truy được về đúng giao dịch gây ra thay vì chỉ biết tổng sai.
    /// </summary>
    [HttpGet("transactions")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Transactions(
        CancellationToken ct, [FromQuery] int page = 1, [FromQuery] int size = 20)
    {
        if (page < 1 || size is < 1 or > 100)
            throw new BadRequestException("page ≥ 1 và size trong khoảng 1 – 100");

        var userId = User.GetUserId();
        var query = db.WalletTransactions.AsNoTracking()
            .Where(t => db.Wallets.Any(w => w.Id == t.WalletId && w.UserId == userId));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(t => t.CreatedAt)
            .Skip((page - 1) * size).Take(size)
            .Select(t => new { t.Id, t.Type, t.Amount, t.BalanceAfter, t.CampaignId, t.CreatedAt })
            .ToListAsync(ct);

        return Ok(new { items, page, size, total });
    }

    /// <summary>Mở phiên nạp tiền, trả về URL của cổng thanh toán.</summary>
    [HttpPost("topup")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> TopUp(StartTopUpDto dto, CancellationToken ct)
    {
        var result = await startTopUp.ExecuteAsync(
            User.GetUserId(),
            dto.Amount,
            HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1",
            ct);

        return Ok(result);
    }

    /// <summary>
    /// Cổng thanh toán gọi về (IPN).
    ///
    /// **Luôn trả HTTP 200**, kể cả khi chữ ký sai hoặc lệch số tiền. VNPay đọc
    /// <c>RspCode</c> trong body để quyết định có gọi lại hay không và coi mọi mã
    /// HTTP khác 200 là "chưa tới nơi" — trả 4xx cho một request giả sẽ biến nó
    /// thành một vòng retry không bao giờ dứt, còn trả 4xx cho một giao dịch đã
    /// cộng tiền thành công thì tệ hơn nữa.
    ///
    /// Tách bạch hai chiều: HTTP status nói *request có tới server không*,
    /// <c>RspCode</c> nói *chuyện gì đã xảy ra với giao dịch*.
    /// </summary>
    [HttpPost("topup/callback")]
    [HttpGet("topup/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> TopUpCallback(CancellationToken ct)
    {
        var query = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString());

        var callback = gateway.VerifyCallback(query);
        if (callback is null)
        {
            // Endpoint này công khai nên ai cũng gọi được. Chữ ký sai là request giả
            // hoặc cấu hình sai secret — không xử lý gì và không tiết lộ lý do.
            logger.LogWarning("IPN {Provider} có chữ ký không hợp lệ", gateway.Provider);
            return Ok(new { RspCode = IpnCodes.InvalidSignature, Message = "Invalid signature" });
        }

        var raw = string.Join('&', query.Select(kv => $"{kv.Key}={kv.Value}"));

        try
        {
            var result = await confirmTopUp.ExecuteAsync(gateway.Provider, callback, raw, ct);
            return Ok(new { RspCode = result.RspCode, Message = result.Reason });
        }
        catch (Exception ex)
        {
            // Lỗi hạ tầng (mất kết nối DB giữa chừng) là đúng trường hợp cần cổng gọi
            // lại: mã 99 giữ giao dịch trong hàng đợi retry của VNPay thay vì để nó
            // bị đánh dấu đã đối soát trong khi ví chưa được cộng. Vẫn 200 — để lộ
            // exception ra thành 500 thì cổng cũng retry, nhưng ta mất câu trả lời.
            logger.LogError(ex, "IPN {Provider} lỗi khi xử lý {Ref}",
                gateway.Provider, callback.ProviderRef);
            return Ok(new { RspCode = IpnCodes.UnknownError, Message = "Unknown error" });
        }
    }
}
