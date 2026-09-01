namespace Massage.Promotion.Domain.Ports;

public interface IPromotionCatalog
{
    Task<PromotionPackage?> FindAsync(Guid packageId, CancellationToken ct = default);
    Task<IReadOnlyList<PromotionPackage>> ListActiveAsync(CancellationToken ct = default);
}

/// <summary>
/// Chiếm slot quảng cáo.
///
/// Hiện thực phải <b>dựa vào</b> ràng buộc UNIQUE của DB để phát hiện trùng, không
/// được thay bằng "đếm trước rồi ghi sau": giữa hai bước đó luôn có khe cho một
/// request khác chen vào, và ở Phase 3 khe đó còn rộng hơn vì có thêm Redis lock
/// có thể hết hạn giữa chừng.
/// </summary>
public interface ISlotAllocator
{
    /// <summary>
    /// Thử chiếm một chỉ số slot còn trống cho <b>toàn bộ</b> các khung của campaign.
    ///
    /// Hoặc chiếm được cùng một <c>slot_index</c> ở mọi khung, hoặc không chiếm gì —
    /// một campaign đứng hạng khác nhau giữa các ngày là thứ không bán được cho ai.
    /// </summary>
    /// <returns>Chỉ số slot đã chiếm.</returns>
    /// <exception cref="SlotExhaustedException">Không còn chỉ số nào trống ở mọi khung.</exception>
    Task<int> AllocateAsync(
        Guid campaignId,
        Guid areaId,
        string packageType,
        IReadOnlyList<DateTimeOffset> windows,
        int maxSlotsPerArea,
        CancellationToken ct = default);

    Task ReleaseAsync(Guid campaignId, CancellationToken ct = default);

    /// <summary>Số slot còn trống ở khung sớm nhất — dùng để hiển thị catalog.</summary>
    Task<int> CountFreeAsync(
        Guid areaId, string packageType, DateTimeOffset window, int maxSlotsPerArea,
        CancellationToken ct = default);
}

public interface ICampaignRepository
{
    Task AddAsync(Campaign campaign, CancellationToken ct = default);
    Task UpdateAsync(Campaign campaign, CancellationToken ct = default);
    Task<Campaign?> FindAsync(Guid campaignId, CancellationToken ct = default);
    Task<IReadOnlyList<Campaign>> ListForKtvAsync(Guid ktvId, CancellationToken ct = default);

    /// <summary>Campaign đã quá hạn nhưng còn ACTIVE — đầu vào của tác vụ dọn dẹp.</summary>
    Task<IReadOnlyList<Campaign>> ListDueForExpiryAsync(
        DateTimeOffset now, int limit, CancellationToken ct = default);
}
