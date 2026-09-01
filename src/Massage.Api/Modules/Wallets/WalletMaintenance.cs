using Massage.Promotion.Domain.Ports;
using Massage.Wallet.Domain.Ports;

namespace Massage.Api.Modules.Wallets;

public sealed record MaintenanceReport(int HoldsReleased, int CampaignsExpired, int WalletsDrifting);

/// <summary>
/// Tác vụ định kỳ của vùng chạm tiền.
///
/// Phase 2 chạy bằng tay hoặc bằng cron ngoài (<c>dotnet Massage.Api.dll maintenance</c>).
/// Phase 3 sẽ gắn vào Hangfire với lịch riêng cho từng việc — nhưng logic đã nằm
/// sẵn ở đây để lúc đó chỉ phải gắn lịch, không phải viết lại nghiệp vụ.
/// </summary>
public class WalletMaintenance(
    IWalletRepository wallets,
    IWalletUnitOfWork uow,
    ICampaignRepository campaigns,
    ISlotAllocator slots,
    IClock clock,
    ILogger<WalletMaintenance> logger)
{
    private const int BatchSize = 500;

    public async Task<MaintenanceReport> RunAsync(CancellationToken ct = default)
    {
        var released = await ReleaseExpiredHoldsAsync(ct);
        var expired = await ExpireCampaignsAsync(ct);
        var drifting = await ReconcileAsync(ct);

        return new MaintenanceReport(released, expired, drifting);
    }

    /// <summary>
    /// Nhả tiền của hold quá hạn.
    ///
    /// Ở Phase 2 luồng mua nằm gọn trong một transaction nên rollback đã tự dọn;
    /// tác vụ này là lưới an toàn cho trường hợp process chết đúng lúc, và là thứ
    /// bắt buộc phải có trước khi Phase 3 kéo dài luồng ra ngoài một transaction.
    /// </summary>
    public async Task<int> ReleaseExpiredHoldsAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var expired = await wallets.ListExpiredHoldsAsync(now, BatchSize, ct);
        var count = 0;

        foreach (var hold in expired)
        {
            await using var tx = await uow.BeginAsync(ct);

            var wallet = await wallets.GetForUpdateAsync(
                await ResolveUserIdAsync(hold.WalletId, ct), ct);

            // Đọc lại trong transaction: hold có thể vừa được capture xong giữa lúc
            // liệt kê và lúc xử lý.
            var current = await wallets.FindHoldAsync(hold.Id, ct);
            if (current is null || !current.IsActive)
            {
                await tx.RollbackAsync(ct);
                continue;
            }

            wallet.Expire(current, now);
            await wallets.UpdateHoldAsync(current, ct);
            await wallets.PersistAmountsAsync(wallet, ct);
            await tx.CommitAsync(ct);

            count++;
            logger.LogWarning("Đã nhả hold quá hạn {HoldId} ({Amount})", current.Id, current.Amount);
        }

        return count;
    }

    /// <summary>Đóng campaign đã hết hạn và trả slot về kho.</summary>
    public async Task<int> ExpireCampaignsAsync(CancellationToken ct = default)
    {
        var now = clock.UtcNow;
        var due = await campaigns.ListDueForExpiryAsync(now, BatchSize, ct);

        foreach (var campaign in due)
        {
            campaign.Expire(now);
            await campaigns.UpdateAsync(campaign, ct);
            await slots.ReleaseAsync(campaign.Id, ct);
        }

        return due.Count;
    }

    /// <summary>
    /// Đối soát: tổng sổ cái phải khớp số dư đang lưu.
    ///
    /// Lệch dù chỉ một đồng cũng ghi log ở mức Error chứ không làm tròn cho qua —
    /// đây là dấu hiệu duy nhất cho thấy có đường ghi số dư nào đó không đi qua sổ.
    /// </summary>
    public async Task<int> ReconcileAsync(CancellationToken ct = default)
    {
        var drift = await wallets.FindDriftAsync(ct);

        foreach (var row in drift)
        {
            logger.LogError(
                "Ví {WalletId} lệch {Difference}đ: sổ cái {LedgerSum}, số dư {StoredBalance}",
                row.WalletId, row.Difference, row.LedgerSum, row.StoredBalance);
        }

        if (drift.Count == 0) logger.LogInformation("Đối soát ví: không có sai lệch");

        return drift.Count;
    }

    private async Task<Guid> ResolveUserIdAsync(Guid walletId, CancellationToken ct)
    {
        // Hold chỉ biết walletId, còn cổng khoá ví làm việc theo userId. Tra ngược
        // ở đây thay vì mở rộng cổng: đây là đường duy nhất cần nó.
        var wallet = await wallets.FindByIdAsync(walletId, ct);
        return wallet?.UserId ?? throw new InvalidOperationException($"Không tìm thấy ví {walletId}");
    }
}
