namespace Massage.Promotion.Domain;

/// <summary>
/// Ba hạng gói và số điểm boost tương ứng.
///
/// <c>FinalScore = BoostPoints + BaseScore</c>, trong đó BaseScore nằm trong
/// khoảng 0–100. Ý đồ thiết kế là khoảng cách giữa các hạng lớn hơn toàn bộ dải
/// BaseScore, để KTV trả phí luôn đứng trên KTV không trả phí.
///
/// <b>Lưu ý quan trọng:</b> ý đồ đó đúng với VIP Pin và Instant Boost nhưng
/// <b>không</b> đúng với Featured Badge. Badge chỉ +50, nhỏ hơn dải BaseScore
/// (tối đa 100), nên một KTV miễn phí điểm nền cao vẫn có thể đứng trên một KTV
/// đang mua Badge. Đây là mâu thuẫn có sẵn giữa hai câu trong tài liệu, không
/// phải lỗi cài đặt — con số giữ đúng như tài liệu đã ghi vì đổi nó là đổi thứ
/// khách hàng đã trả tiền để mua. Xem <c>PackageTypes.GuaranteesTopPlacement</c>.
/// </summary>
public static class PackageTypes
{
    public const string VipPin = "VIP_PIN";
    public const string FeaturedBadge = "FEATURED_BADGE";
    public const string InstantBoost = "INSTANT_BOOST";

    public static readonly string[] All = [VipPin, FeaturedBadge, InstantBoost];

    /// <summary>Dải BaseScore tối đa. Mốc để đối chiếu khoảng cách giữa các hạng.</summary>
    public const int MaxBaseScore = 100;

    public static int BoostPointsFor(string packageType) => packageType switch
    {
        VipPin => 500,
        InstantBoost => 300,
        FeaturedBadge => 50,
        _ => throw new UnknownPackageTypeException(packageType),
    };

    /// <summary>
    /// Hạng này có đảm bảo đứng trên mọi KTV không trả phí hay không.
    ///
    /// Đúng khi điểm boost lớn hơn BaseScore tối đa mà một KTV miễn phí đạt được.
    /// Dùng trong test và trong mô tả gói bán cho KTV, để lời hứa thương mại khớp
    /// với hành vi thật của hệ thống.
    /// </summary>
    public static bool GuaranteesTopPlacement(string packageType) =>
        BoostPointsFor(packageType) > MaxBaseScore;

    public static bool IsKnown(string packageType) => All.Contains(packageType);
}

public sealed class UnknownPackageTypeException(string packageType)
    : PromotionDomainException($"Loại gói không hợp lệ: {packageType}");
