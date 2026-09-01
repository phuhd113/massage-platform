namespace Massage.Promotion.Domain;

public abstract class PromotionDomainException(string message) : Exception(message);

/// <summary>
/// Không còn slot trống cho khu vực + hạng gói + khung giờ này.
///
/// Luồng gọi phải nhả hold khi gặp lỗi này. Ở tầng API nó thành 409, không phải
/// 500: hết chỗ là kết quả bình thường của việc bán hàng có giới hạn.
/// </summary>
public sealed class SlotExhaustedException(Guid areaId, string packageType)
    : PromotionDomainException($"Khu vực {areaId} đã hết slot {packageType} cho khung giờ này")
{
    public Guid AreaId { get; } = areaId;
    public string PackageType { get; } = packageType;
}

public sealed class InvalidCampaignTransitionException(string from, string to)
    : PromotionDomainException($"Không thể chuyển campaign từ {from} sang {to}");
