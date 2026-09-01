using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Promotion.Domain;
using Massage.Promotion.Domain.Ports;
using Massage.Wallet.Domain.Ports;
using Microsoft.EntityFrameworkCore;
using DomainCampaign = Massage.Promotion.Domain.Campaign;

namespace Massage.Api.Modules.Promotions.UseCases;

public sealed record BuyPromotionResult(
    Guid CampaignId,
    int SlotIndex,
    decimal PricePaid,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    decimal BalanceAfter,
    bool AlreadyProcessed);

/// <summary>
/// Mua một gói đẩy tin.
///
/// Thứ tự thao tác là thứ quan trọng nhất trong file này:
/// <code>
///   Hold(tiền)  →  chiếm slot TRONG cùng transaction  →  Capture
/// </code>
/// Không có đường nào trừ tiền trước khi slot được xác nhận. Nếu đảo lại, KTV
/// thua cuộc tranh slot sẽ thấy tiền biến mất rồi mới được hoàn — và nếu process
/// chết đúng khoảnh khắc đó thì tiền mất thật.
///
/// Mọi nhánh thất bại đều nhả hold, không phải nhờ khối <c>catch</c> mà nhờ hold
/// nằm trong chính transaction bị rollback. Đó cũng là lý do không được đưa bất
/// kỳ thao tác nào ra ngoài transaction này.
/// </summary>
public class BuyPromotionUseCase(
    AppDbContext db,
    IWalletRepository wallets,
    IWalletUnitOfWork uow,
    IPromotionCatalog catalog,
    ICampaignRepository campaigns,
    ISlotAllocator slots,
    IClock clock)
{
    /// <summary>Hold sống đủ lâu cho một transaction, không lâu hơn.</summary>
    private static readonly TimeSpan HoldTtl = TimeSpan.FromMinutes(5);

    public async Task<BuyPromotionResult> ExecuteAsync(
        Guid userId, Guid packageId, Guid areaId, string idempotencyKey, CancellationToken ct = default)
    {
        var package = await catalog.FindAsync(packageId, ct)
            ?? throw new NotFoundException("Không tìm thấy gói đang bán");

        if (!await db.AdministrativeAreas.AnyAsync(a => a.Id == areaId, ct))
            throw new BadRequestException("Khu vực không tồn tại");

        var ktv = await db.KtvProfiles
            .Where(k => k.UserId == userId && k.VerificationStatus == VerificationStatuses.Verified)
            .Select(k => new { k.Id })
            .FirstOrDefaultAsync(ct)
            ?? throw new BadRequestException("Chỉ hồ sơ đã được duyệt mới mua được gói đẩy tin");

        // Request lặp lại (client bấm hai lần, hoặc retry mạng): trả về đúng kết quả
        // cũ thay vì tạo campaign thứ hai. Đây là đường nhanh; ràng buộc UNIQUE trên
        // idempotency_key vẫn là chốt chặn thật ở bước ghi bút toán bên dưới.
        var existing = await wallets.FindCampaignByIdempotencyKeyAsync(idempotencyKey, ct);
        if (existing is { } existingId)
        {
            var prior = await campaigns.FindAsync(existingId, ct);
            if (prior is not null)
            {
                var w = await wallets.FindAsync(userId, ct);
                return new BuyPromotionResult(
                    prior.Id, -1, prior.PricePaid, prior.StartAt, prior.EndAt,
                    w?.Balance.Amount ?? 0m, AlreadyProcessed: true);
            }
        }

        var now = clock.UtcNow;

        await using var tx = await uow.BeginAsync(ct);

        // Khoá dòng ví tới hết transaction. Đọc thường ở đây là chỗ hai request
        // song song cùng thấy đủ tiền rồi cùng tiêu.
        var wallet = await wallets.GetForUpdateAsync(userId, ct);

        var price = Massage.Wallet.Domain.Money.Of(package.Price);
        var hold = wallet.Hold(Guid.NewGuid(), price, now, HoldTtl);
        await wallets.AddHoldAsync(hold, ct);
        await wallets.PersistAmountsAsync(wallet, ct);

        var campaign = DomainCampaign.Start(Guid.NewGuid(), ktv.Id, areaId, package, now);
        await campaigns.AddAsync(campaign, ct);

        // Ném SlotExhaustedException nếu hết chỗ. Không bắt ở đây: transaction bị
        // rollback sẽ nhả hold và xoá campaign vừa tạo, còn tầng API dịch nó thành 409.
        var slotIndex = await slots.AllocateAsync(
            campaign.Id, areaId, package.Type,
            SlotWindow.DayWindows(campaign.StartAt, package.DurationDays),
            package.MaxSlotsPerArea, ct);

        // Slot đã chắc chắn thuộc về campaign này — giờ mới được trừ tiền.
        var entry = wallet.Capture(hold, now, idempotencyKey, campaign.Id);
        var appended = await wallets.TryAppendAsync(wallet, entry, ct);
        await wallets.UpdateHoldAsync(hold, ct);

        if (!appended)
        {
            // Khoá chống lặp đã tồn tại: một request song song với cùng khoá đã mua
            // xong. Bỏ toàn bộ việc vừa làm và trả về kết quả của request kia.
            await tx.RollbackAsync(ct);

            var priorId = await wallets.FindCampaignByIdempotencyKeyAsync(idempotencyKey, ct);
            var prior = priorId is null ? null : await campaigns.FindAsync(priorId.Value, ct);
            var w = await wallets.FindAsync(userId, ct);

            return prior is null
                ? throw new ConflictException("Yêu cầu trùng đang được xử lý, vui lòng thử lại")
                : new BuyPromotionResult(
                    prior.Id, -1, prior.PricePaid, prior.StartAt, prior.EndAt,
                    w?.Balance.Amount ?? 0m, AlreadyProcessed: true);
        }

        await tx.CommitAsync(ct);

        return new BuyPromotionResult(
            campaign.Id, slotIndex, campaign.PricePaid, campaign.StartAt, campaign.EndAt,
            wallet.Balance.Amount, AlreadyProcessed: false);
    }
}
