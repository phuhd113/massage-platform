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
/// <param name="DurationHours">
/// Chỉ dùng cho gói bán theo khung giờ (Instant Boost). Null với gói bán theo ngày.
///
/// Tách khỏi <paramref name="DurationDays"/> chứ không tái dụng cột đó với một quy
/// ước ngầm kiểu "nếu là Instant Boost thì đọc số này là giờ": quy ước ngầm sống
/// được đúng tới lúc người tiếp theo đọc code mà không biết nó tồn tại, và ở đây
/// đọc sai đơn vị nghĩa là bán 3 ngày với giá 3 giờ.
/// </param>
public sealed record PromotionPackage(
    Guid Id,
    string Code,
    string Name,
    string Type,
    decimal Price,
    int DurationDays,
    int MaxSlotsPerArea,
    bool IsActive,
    int? DurationHours = null)
{
    public int BoostPoints => PackageTypes.BoostPointsFor(Type);

    /// <summary>Xem <see cref="PackageTypes.GuaranteesTopPlacement"/> — không phải hạng nào cũng đảm bảo.</summary>
    public bool GuaranteesTopPlacement => PackageTypes.GuaranteesTopPlacement(Type);

    /// <summary>Độ mịn khung slot mà loại gói này dùng.</summary>
    public SlotGranularity Granularity => SlotGranularities.For(Type);

    /// <summary>
    /// Số khung mà gói chiếm — đơn vị đi theo <see cref="Granularity"/>.
    /// </summary>
    /// <exception cref="PromotionArgumentException">
    /// Gói theo giờ nhưng thiếu <see cref="DurationHours"/>. Ném thay vì lặng lẽ lấy
    /// <see cref="DurationDays"/>: nhầm đơn vị ở đây là bán 24 lần thứ đã thu tiền.
    /// </exception>
    public int Duration => Granularity switch
    {
        SlotGranularity.Hour => DurationHours
            ?? throw new PromotionArgumentException(
                $"Gói {Code} bán theo khung giờ nhưng thiếu duration_hours"),
        _ => DurationDays,
    };

    /// <summary>
    /// Thời điểm bắt đầu, cắt về đúng biên khung mà campaign sẽ chiếm slot.
    /// </summary>
    public DateTimeOffset StartAtFrom(DateTimeOffset now) =>
        SlotWindow.StartFor(Granularity, now);

    /// <summary>
    /// Thời điểm kết thúc, cắt theo đúng biên khung mà campaign chiếm slot.
    ///
    /// Không dùng <c>startAt.AddDays(n)</c>: mua lúc 18h thì campaign sẽ chạy tới
    /// 18h ngày thứ n+1, trong khi slot cuối cùng đã hết từ nửa đêm — quãng giữa
    /// đó KTV vẫn được đẩy hạng mà không giữ chỗ nào, và khu vực bán dư một suất.
    /// </summary>
    public DateTimeOffset EndAtFrom(DateTimeOffset startAt) =>
        SlotWindow.EndFor(Granularity, startAt, Duration);

    /// <summary>Các khung mà campaign mua lúc <paramref name="now"/> sẽ chiếm.</summary>
    public IReadOnlyList<DateTimeOffset> WindowsFrom(DateTimeOffset now) =>
        SlotWindow.WindowsFor(Granularity, now, Duration);
}
