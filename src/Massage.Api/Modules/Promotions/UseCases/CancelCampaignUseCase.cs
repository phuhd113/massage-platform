using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Promotion.Domain.Ports;
using Massage.Wallet.Domain;
using Massage.Wallet.Domain.Ports;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Promotions.UseCases;

public sealed record CancelCampaignResult(Guid CampaignId, decimal RefundedAmount, decimal BalanceAfter);

/// <summary>
/// Huỷ gói đang chạy và hoàn tiền phần chưa dùng.
///
/// Tiền hoàn về ví, không về cổng thanh toán: hoàn ngược qua cổng phát sinh phí
/// và độ trễ nhiều ngày, trong khi KTV gần như luôn dùng số tiền đó để mua gói
/// khác. Rút tiền khỏi ví là luồng riêng, chưa có ở Phase 2.
/// </summary>
public class CancelCampaignUseCase(
    AppDbContext db,
    IWalletRepository wallets,
    IWalletUnitOfWork uow,
    ICampaignRepository campaigns,
    ISlotAllocator slots,
    IClock clock)
{
    public async Task<CancelCampaignResult> ExecuteAsync(
        Guid userId, Guid campaignId, CancellationToken ct = default)
    {
        var campaign = await campaigns.FindAsync(campaignId, ct)
            ?? throw new NotFoundException("Không tìm thấy campaign");

        var ownsIt = await db.KtvProfiles
            .AnyAsync(k => k.Id == campaign.KtvId && k.UserId == userId, ct);
        if (!ownsIt)
            throw new NotFoundException("Không tìm thấy campaign");

        var now = clock.UtcNow;

        await using var tx = await uow.BeginAsync(ct);

        var wallet = await wallets.GetForUpdateAsync(userId, ct);

        // Domain quyết định số tiền hoàn và chặn huỷ một campaign đã huỷ.
        var refund = campaign.Cancel(now);
        await campaigns.UpdateAsync(campaign, ct);

        // Nhả slot ngay: khu vực đang bán hết mà giữ lại chỗ của campaign đã huỷ
        // là chặn doanh thu của chính mình.
        await slots.ReleaseAsync(campaign.Id, ct);

        if (refund > 0)
        {
            // Khoá suy ra từ chính campaign chứ không sinh ngẫu nhiên: gọi huỷ hai
            // lần thì lần thứ hai đụng uq_wallet_txn_idem và không hoàn tiền lần nữa.
            var entry = wallet.Refund(Money.Of(refund), $"refund:{campaign.Id}", campaign.Id);
            await wallets.TryAppendAsync(wallet, entry, ct);
        }

        await tx.CommitAsync(ct);

        return new CancelCampaignResult(campaign.Id, refund, wallet.Balance.Amount);
    }
}
