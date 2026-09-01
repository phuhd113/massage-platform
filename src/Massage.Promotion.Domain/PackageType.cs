namespace Massage.Promotion.Domain;

/// <summary>
/// Ba hạng gói và số điểm boost tương ứng.
///
/// <c>FinalScore = BoostPoints + BaseScore</c>, trong đó BaseScore nằm trong
/// khoảng 0–100. Ràng buộc thiết kế: <b>mọi khoảng cách giữa hai hạng liền kề
/// phải lớn hơn 100</b> — kể cả khoảng cách từ hạng thấp nhất xuống KTV không
/// trả phí. Chỉ khi đó thứ tự giữa các hạng mới không bao giờ bị BaseScore đảo
/// ngược, và đó chính là thứ KTV trả tiền để mua.
///
/// <code>
///   organic(0) →150→ Badge(150) →150→ Instant(300) →200→ VIP(500)
/// </code>
///
/// Badge từng là +50 — nhỏ hơn dải BaseScore, nên một KTV miễn phí điểm nền cao
/// vẫn vượt được. Nâng lên 150 là quyết định kinh doanh ngày 2026-09-01. Không
/// chọn 200 vì khi đó khoảng cách Badge→Instant tụt xuống đúng 100, tức bằng chứ
/// không lớn hơn dải BaseScore, và một Badge điểm nền tối đa sẽ hoà với một
/// Instant điểm nền 0.
///
/// Khi đổi bất kỳ con số nào ở đây, kiểm lại toàn bộ chuỗi khoảng cách chứ không
/// chỉ hạng vừa đổi — xem <see cref="TierGapsAreValid"/>.
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
        FeaturedBadge => 150,
        _ => throw new UnknownPackageTypeException(packageType),
    };

    /// <summary>
    /// Hạng này có đảm bảo đứng trên mọi KTV không trả phí hay không.
    ///
    /// Sau khi nâng Badge lên 150 thì cả ba hạng đều đảm bảo. Vẫn giữ hàm này chứ
    /// không hard-code <c>true</c>: nó là chỗ mô tả gói và test cùng đọc, nên nếu
    /// ai đó hạ một hạng xuống dưới 100 thì lời hứa bán hàng tự động sai theo và
    /// test bắt được ngay.
    /// </summary>
    public static bool GuaranteesTopPlacement(string packageType) =>
        BoostPointsFor(packageType) > MaxBaseScore;

    /// <summary>
    /// Kiểm chuỗi khoảng cách giữa các hạng, tính cả bậc từ hạng thấp nhất xuống
    /// KTV không trả phí (điểm boost 0).
    ///
    /// Đây là bất biến thật sự của mô hình doanh thu: thiếu nó thì một KTV mua gói
    /// đắt hơn vẫn có thể đứng dưới người mua gói rẻ hơn, và không ai giải thích
    /// nổi cho khách vì sao.
    /// </summary>
    public static bool TierGapsAreValid()
    {
        var tiers = All.Select(BoostPointsFor).Append(0).OrderBy(x => x).ToArray();

        return tiers.Zip(tiers.Skip(1), (lower, upper) => upper - lower)
            .All(gap => gap > MaxBaseScore);
    }

    public static bool IsKnown(string packageType) => All.Contains(packageType);
}

public sealed class UnknownPackageTypeException(string packageType)
    : PromotionDomainException($"Loại gói không hợp lệ: {packageType}");
