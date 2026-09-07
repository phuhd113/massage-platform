using Massage.Api.Data;
using Massage.Api.Modules.Wallets.Entities;
using Massage.Promotion.Domain.Ports;
using Massage.Wallet.Domain.Ports;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Wallets;

public sealed record MaintenanceReport(
    int HoldsReleased, int CampaignsExpired, int WalletsDrifting, int IntentsAbandoned);

/// <summary>
/// Tác vụ định kỳ của vùng chạm tiền.
///
/// Phase 2 chạy bằng tay hoặc bằng cron ngoài (<c>dotnet Massage.Api.dll maintenance</c>).
/// Phase 3 sẽ gắn vào Hangfire với lịch riêng cho từng việc — nhưng logic đã nằm
/// sẵn ở đây để lúc đó chỉ phải gắn lịch, không phải viết lại nghiệp vụ.
/// </summary>
public class WalletMaintenance(
    AppDbContext db,
    IWalletRepository wallets,
    IWalletUnitOfWork uow,
    ICampaignRepository campaigns,
    ISlotAllocator slots,
    IClock clock,
    ILogger<WalletMaintenance> logger)
{
    private const int BatchSize = 500;

    /// <summary>
    /// Sau bao lâu thì một phiên nạp tiền còn PENDING được coi là đã bỏ dở. Rộng hơn
    /// hẳn hạn 15 phút của chính phiên VNPay: cổng vẫn có thể gửi IPN muộn sau khi
    /// người dùng đã đóng tab, và đánh dấu bỏ dở một phiên mà tiền đang trên đường về
    /// là tự tay tạo ra tranh chấp "đã trả mà không thấy vào ví".
    /// </summary>
    private static readonly TimeSpan AbandonAfter = TimeSpan.FromHours(24);

    public async Task<MaintenanceReport> RunAsync(CancellationToken ct = default)
    {
        var released = await ReleaseExpiredHoldsAsync(ct);
        var expired = await ExpireCampaignsAsync(ct);
        var abandoned = await AbandonStaleIntentsAsync(ct);
        var drifting = await ReconcileAsync(ct);

        return new MaintenanceReport(released, expired, drifting, abandoned);
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
    /// Đánh dấu những phiên nạp tiền chưa bao giờ được cổng gọi về.
    ///
    /// Đây **không** phải là dọn rác cho gọn bảng: một phiên PENDING vĩnh viễn là một
    /// dòng "đang chờ thanh toán" mà KTV nhìn thấy mãi mãi, và là thứ làm nhiễu đúng
    /// câu hỏi cần trả lời khi có tranh chấp — *phiên nào thật sự còn đang treo?*
    ///
    /// Ba ràng buộc, cả ba đều cần thiết:
    /// <list type="bullet">
    /// <item>Chỉ đụng vào hàng còn PENDING. SUCCEEDED/FAILED là kết luận đã có.</item>
    /// <item>Chỉ đụng vào hàng <b>chưa có callback nào</b> (<c>raw_callback IS NULL</c>).
    /// Có callback nghĩa là cổng đã nói chuyện với ta; trạng thái phải do đường IPN
    /// quyết định, không phải do một job đoán.</item>
    /// <item>Trạng thái mới là ABANDONED chứ không phải FAILED: "hết hạn mà không ai
    /// trả tiền" khác hẳn "ngân hàng từ chối", và gộp hai thứ lại là mất đúng phần
    /// thông tin cần đến khi đối soát với sao kê của cổng.</item>
    /// </list>
    ///
    /// Không bao giờ đụng tới ví: phiên bỏ dở chưa từng sinh bút toán nào, nên ở đây
    /// không có đồng nào để hoàn.
    /// </summary>
    public async Task<int> AbandonStaleIntentsAsync(CancellationToken ct = default)
    {
        var cutoff = clock.UtcNow - AbandonAfter;

        // ExecuteUpdate: một câu lệnh cho cả lô, và không đọc hàng nào vào change
        // tracker — job này có thể gặp hàng nghìn hàng cũ ở lần chạy đầu tiên.
        var count = await db.PaymentIntents
            .Where(i => i.Status == PaymentIntentStatuses.Pending
                        && i.RawCallback == null
                        && i.CreatedAt < cutoff)
            .ExecuteUpdateAsync(
                s => s.SetProperty(i => i.Status, PaymentIntentStatuses.Abandoned), ct);

        if (count > 0)
        {
            logger.LogInformation(
                "Đã đánh dấu {Count} phiên nạp tiền bỏ dở (quá {Hours} giờ, cổng chưa từng gọi về)",
                count, AbandonAfter.TotalHours);
        }

        return count;
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
