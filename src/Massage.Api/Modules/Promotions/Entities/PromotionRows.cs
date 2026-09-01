namespace Massage.Api.Modules.Promotions.Entities;

/// <summary>Model lưu trữ của catalog gói. Xem ghi chú hậu tố <c>Row</c> ở WalletRows.</summary>
public class PromotionPackageRow
{
    public Guid Id { get; set; }
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public string Type { get; set; } = null!;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public int DurationDays { get; set; }
    public int MaxSlotsPerArea { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
}

public class CampaignRow
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }
    public Guid PackageId { get; set; }
    public Guid AreaId { get; set; }

    /// <summary>
    /// Sao chép từ gói tại thời điểm mua, không join lại lúc đọc.
    ///
    /// Đổi giá hay đổi điểm boost của gói trong catalog không được làm thay đổi
    /// campaign đã bán — KTV mua theo điều kiện tại thời điểm đó.
    /// </summary>
    public string PackageType { get; set; } = null!;

    public int BoostPoints { get; set; }
    public decimal PricePaid { get; set; }

    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public string Status { get; set; } = null!;
    public DateTimeOffset? CancelledAt { get; set; }
    public decimal RefundedAmount { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>
/// Một suất quảng cáo đã chiếm, cho đúng một khung thời gian.
///
/// Campaign N ngày sinh N dòng ở đây. <c>UNIQUE (area_id, package_type,
/// window_start, slot_index)</c> là trọng tài cuối cùng chống bán trùng — Redis
/// lock ở Phase 3 chỉ là đường nhanh, nó có thể hết hạn giữa chừng khi transaction
/// chạy lâu hơn dự kiến.
/// </summary>
public class SlotAllocationRow
{
    public Guid Id { get; set; }
    public Guid CampaignId { get; set; }
    public Guid AreaId { get; set; }
    public string PackageType { get; set; } = null!;
    public DateTimeOffset WindowStart { get; set; }
    public int SlotIndex { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
