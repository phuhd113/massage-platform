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

/// <summary>
/// Kết quả xử lý IPN.
///
/// <c>RspCode</c> là thứ cổng thực sự đọc để quyết định có gọi lại hay không —
/// HTTP status chỉ nói request tới được server. Mã phải phản ánh đúng chuyện đã
/// xảy ra: báo "00" cho một giao dịch bị từ chối vì lệch số tiền sẽ khiến cổng
/// ghi nhận là đã đối soát xong, và khoản lệch đó biến mất khỏi báo cáo của cả
/// hai bên đúng lúc cần nó nhất.
/// </summary>
public sealed record ConfirmTopUpResult(bool Credited, string Reason, string RspCode);

/// <summary>Mã trả về cho IPN theo đặc tả VNPay.</summary>
public static class IpnCodes
{
    public const string Success = "00";
    public const string OrderNotFound = "01";
    public const string AlreadyConfirmed = "02";
    public const string InvalidAmount = "04";
    public const string InvalidSignature = "97";
    public const string UnknownError = "99";
}

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
            return new ConfirmTopUpResult(
                false, "Không tìm thấy phiên nạp tiền", IpnCodes.OrderNotFound);
        }

        if (intent.Amount != callback.Amount)
        {
            // Số tiền cổng báo khác số tiền đã mở phiên: hoặc bị sửa, hoặc cấu hình
            // sai đơn vị. Không cộng gì và để lại dấu vết để đối soát.
            logger.LogError(
                "IPN {Provider} lệch số tiền cho {Ref}: phiên {Expected}, cổng báo {Actual}",
                provider, callback.ProviderRef, intent.Amount, callback.Amount);
            return new ConfirmTopUpResult(
                false, "Số tiền không khớp với phiên đã mở", IpnCodes.InvalidAmount);
        }

        intent.RawCallback = rawPayload;
        intent.ProviderTxnId = callback.ProviderTxnId;
        intent.CompletedAt = clock.UtcNow;

        if (!callback.Succeeded)
        {
            intent.Status = PaymentIntentStatuses.Failed;
            await db.SaveChangesAsync(ct);
            // "00" ở đây không mâu thuẫn với việc giao dịch thất bại: mã này nói về
            // việc *ta đã ghi nhận đúng* thông báo, không phải về kết quả thanh toán.
            // Trả mã lỗi cho một lượt huỷ hợp lệ sẽ khiến cổng gọi lại mãi một tin
            // vốn không có gì để sửa.
            return new ConfirmTopUpResult(
                false, "Cổng thanh toán báo giao dịch thất bại", IpnCodes.Success);
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
            ? new ConfirmTopUpResult(true, "Đã cộng tiền vào ví", IpnCodes.Success)
            // Trùng là kết quả bình thường của retry, không phải lỗi. Cổng nhận mã
            // riêng "đã xác nhận trước đó" thay vì "00": cả hai đều làm nó ngừng gọi
            // lại, nhưng chỉ mã này nói đúng rằng lần gọi ấy không cộng thêm đồng nào.
            : new ConfirmTopUpResult(
                false, "Giao dịch đã được ghi nhận trước đó", IpnCodes.AlreadyConfirmed);
    }
}
