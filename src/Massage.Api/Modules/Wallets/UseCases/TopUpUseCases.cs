using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Wallets.Entities;
using Massage.Api.Modules.Wallets.Infrastructure;
using Massage.Wallet.Domain;
using Massage.Wallet.Domain.Ports;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Wallets.UseCases;

public sealed record StartTopUpResult(Guid IntentId, string ProviderRef, string RedirectUrl);

/// <summary>Mở một phiên nạp tiền với cổng thanh toán.</summary>
public class StartTopUpUseCase(AppDbContext db, IPaymentGateway gateway, IClock clock)
{
    public const decimal MinAmount = 10_000m;
    public const decimal MaxAmount = 50_000_000m;

    public async Task<StartTopUpResult> ExecuteAsync(
        Guid userId, decimal amount, string clientIp, CancellationToken ct = default)
    {
        var money = Money.Positive(amount);
        if (money.Amount < MinAmount || money.Amount > MaxAmount)
            throw new BadRequestException($"Số tiền nạp phải từ {MinAmount:N0}đ đến {MaxAmount:N0}đ");

        // Mã tham chiếu ngắn, không đoán được, và không lộ id nội bộ ra cổng.
        var providerRef = $"{clock.UtcNow:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..24];

        var intent = new PaymentIntentRow
        {
            UserId = userId,
            Amount = money.Amount,
            Provider = gateway.Provider,
            ProviderRef = providerRef,
            Status = PaymentIntentStatuses.Pending,
        };

        db.PaymentIntents.Add(intent);
        await db.SaveChangesAsync(ct);

        var session = gateway.CreateSession(providerRef, money.Amount, clientIp);
        return new StartTopUpResult(intent.Id, providerRef, session.RedirectUrl);
    }
}

public sealed record ConfirmTopUpResult(bool Credited, string Reason);

/// <summary>
/// Ghi nhận kết quả nạp tiền do cổng gọi về (IPN).
///
/// Chỉ IPN server-to-server mới được cộng tiền. Kết quả cổng trả về trình duyệt
/// qua <c>returnUrl</c> chỉ để hiển thị: nó đi qua máy của người dùng nên sửa được.
/// </summary>
public class ConfirmTopUpUseCase(
    AppDbContext db,
    IWalletRepository wallets,
    IWalletUnitOfWork uow,
    IClock clock,
    ILogger<ConfirmTopUpUseCase> logger)
{
    public async Task<ConfirmTopUpResult> ExecuteAsync(
        string provider, PaymentCallback callback, string rawPayload, CancellationToken ct = default)
    {
        var intent = await db.PaymentIntents
            .FirstOrDefaultAsync(i => i.Provider == provider && i.ProviderRef == callback.ProviderRef, ct);

        if (intent is null)
        {
            logger.LogWarning("IPN {Provider} tham chiếu phiên không tồn tại: {Ref}",
                provider, callback.ProviderRef);
            return new ConfirmTopUpResult(false, "Không tìm thấy phiên nạp tiền");
        }

        if (intent.Amount != callback.Amount)
        {
            // Số tiền cổng báo khác số tiền đã mở phiên: hoặc bị sửa, hoặc cấu hình
            // sai đơn vị. Không cộng gì và để lại dấu vết để đối soát.
            logger.LogError(
                "IPN {Provider} lệch số tiền cho {Ref}: phiên {Expected}, cổng báo {Actual}",
                provider, callback.ProviderRef, intent.Amount, callback.Amount);
            return new ConfirmTopUpResult(false, "Số tiền không khớp với phiên đã mở");
        }

        intent.RawCallback = rawPayload;
        intent.ProviderTxnId = callback.ProviderTxnId;
        intent.CompletedAt = clock.UtcNow;

        if (!callback.Succeeded)
        {
            intent.Status = PaymentIntentStatuses.Failed;
            await db.SaveChangesAsync(ct);
            return new ConfirmTopUpResult(false, "Cổng thanh toán báo giao dịch thất bại");
        }

        await using var tx = await uow.BeginAsync(ct);

        var wallet = await wallets.GetForUpdateAsync(intent.UserId, ct);

        // Khoá chống lặp là mã giao dịch của cổng, truyền từ ngoài vào chứ không tự
        // sinh: cổng sẽ gọi lại đúng payload này khi nó không nhận được 200 kịp thời.
        var entry = wallet.TopUp(Money.Of(intent.Amount), $"{provider}:{callback.ProviderTxnId}");
        var credited = await wallets.TryAppendAsync(wallet, entry, ct);

        intent.Status = PaymentIntentStatuses.Succeeded;
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return credited
            ? new ConfirmTopUpResult(true, "Đã cộng tiền vào ví")
            // Trùng là kết quả bình thường của retry, không phải lỗi. Người gọi vẫn
            // trả 200 để cổng ngừng gọi lại.
            : new ConfirmTopUpResult(false, "Giao dịch đã được ghi nhận trước đó");
    }
}
