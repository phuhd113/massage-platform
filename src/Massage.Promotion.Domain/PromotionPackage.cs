namespace Massage.Promotion.Domain;

/// <summary>
/// Một gói đang bán.
/// </summary>
/// <param name="MaxSlotsPerArea">
/// Số KTV tối đa được mua hạng này trong cùng khu vực và cùng khung giờ. Đây là
/// thứ tạo ra sự khan hiếm — cũng là thứ hai KTV sẽ tranh nhau, nên nó được ràng
/// buộc lần cuối bằng UNIQUE ở tầng DB chứ không chỉ bằng kiểm tra trong code.
/// </param>
/// <param name="Price">VND, dùng decimal chứ không bao giờ float.</param>
public sealed record PromotionPackage(
    Guid Id,
    string Code,
    string Name,
    string Type,
    decimal Price,
    int DurationDays,
    int MaxSlotsPerArea,
    bool IsActive)
{
    public int BoostPoints => PackageTypes.BoostPointsFor(Type);

    /// <summary>Xem <see cref="PackageTypes.GuaranteesTopPlacement"/> — không phải hạng nào cũng đảm bảo.</summary>
    public bool GuaranteesTopPlacement => PackageTypes.GuaranteesTopPlacement(Type);

    /// <summary>
    /// Thời điểm kết thúc, cắt theo đúng biên khung ngày mà campaign chiếm slot.
    ///
    /// Không dùng <c>startAt.AddDays(n)</c>: mua lúc 18h thì campaign sẽ chạy tới
    /// 18h ngày thứ n+1, trong khi slot cuối cùng đã hết từ nửa đêm — quãng giữa
    /// đó KTV vẫn được đẩy hạng mà không giữ chỗ nào, và khu vực bán dư một suất.
    /// </summary>
    public DateTimeOffset EndAtFrom(DateTimeOffset startAt) =>
        SlotWindow.EndOfDays(startAt, DurationDays);
}
