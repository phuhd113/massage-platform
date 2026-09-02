namespace Massage.Promotion.Domain;

/// <summary>
/// Chia thời gian chạy của một campaign thành các "khung" rời rạc để chiếm slot.
///
/// Ràng buộc <c>UNIQUE (area_id, package_type, window_start, slot_index)</c> chỉ
/// chặn được trùng khi mỗi khung là một giá trị rời rạc — nó không diễn đạt được
/// "hai khoảng thời gian giao nhau". Vì vậy một campaign 7 ngày chiếm <b>7 dòng</b>
/// slot, mỗi ngày một dòng, ghi trong cùng một transaction. Đổi lại, câu hỏi "khu
/// vực này ngày mai còn chỗ không" trở thành một câu SELECT thường.
/// </summary>
public static class SlotWindow
{
    /// <summary>
    /// Khung ngày cắt theo giờ Việt Nam, không theo UTC.
    ///
    /// Gói bán theo ngày là ngày của người mua và người dùng. Cắt theo UTC thì
    /// một "ngày" chạy từ 7 giờ sáng hôm nay tới 7 giờ sáng hôm sau — KTV mua
    /// gói buổi tối sẽ thấy nó hết hạn giữa buổi sáng làm việc.
    /// </summary>
    public static readonly TimeSpan VietnamOffset = TimeSpan.FromHours(7);

    /// <summary>
    /// Đầu ngày (giờ Việt Nam) chứa thời điểm này.
    ///
    /// Trả về dưới dạng UTC dù ngày được cắt theo giờ Việt Nam: cột
    /// <c>timestamptz</c> chỉ nhận offset 0, và một <c>DateTimeOffset</c> mang
    /// offset +07:00 đi lang thang trong hệ thống sẽ nổ ở đúng chỗ nó chạm DB —
    /// tức là muộn, và chỉ khi có dữ liệu thật.
    /// </summary>
    public static DateTimeOffset DayBucket(DateTimeOffset instant)
    {
        var local = instant.ToOffset(VietnamOffset);
        return new DateTimeOffset(local.Year, local.Month, local.Day, 0, 0, 0, VietnamOffset)
            .ToUniversalTime();
    }

    /// <summary>
    /// Thời điểm campaign kết thúc: đúng <paramref name="durationDays"/> khung ngày
    /// trọn vẹn tính từ khung chứa <paramref name="startAt"/>.
    ///
    /// Mua lúc 22h vẫn tính trọn ngày hôm đó là ngày thứ nhất. Cách khác là kéo dài
    /// tới đúng 22h ngày thứ N+1, nhưng khi đó campaign đè lên N+1 khung và làm hụt
    /// một suất tồn kho mà không ai trả tiền cho nó.
    /// </summary>
    public static DateTimeOffset EndOfDays(DateTimeOffset startAt, int durationDays) =>
        DayBucket(startAt).AddDays(durationDays);

    /// <summary>Danh sách khung mà campaign chiếm chỗ.</summary>
    public static IReadOnlyList<DateTimeOffset> DayWindows(DateTimeOffset startAt, int durationDays)
    {
        if (durationDays <= 0)
            throw new PromotionArgumentException("Số ngày của gói phải lớn hơn 0");

        var first = DayBucket(startAt);
        return Enumerable.Range(0, durationDays).Select(i => first.AddDays(i)).ToList();
    }

    /// <summary>
    /// Đầu giờ tròn chứa thời điểm này.
    ///
    /// Cắt theo giờ nên không phụ thuộc múi giờ như khung ngày: offset của Việt Nam
    /// là số giờ tròn (+07:00), nên đầu giờ tính theo UTC và tính theo giờ Việt Nam
    /// rơi vào đúng cùng một thời điểm. Vẫn quy về UTC vì cột là <c>timestamptz</c>.
    /// </summary>
    public static DateTimeOffset HourBucket(DateTimeOffset instant)
    {
        var utc = instant.ToUniversalTime();
        return new DateTimeOffset(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, TimeSpan.Zero);
    }

    /// <summary>
    /// Các khung giờ mà một campaign Instant Boost chiếm chỗ.
    ///
    /// Bắt đầu từ <b>giờ kế tiếp</b> chứ không phải giờ hiện tại khi mua giữa giờ:
    /// giờ đang chạy đã trôi qua một phần, bán trọn giá cho phần còn lại là bán
    /// thiếu thứ đã hứa. Mua đúng đầu giờ thì vẫn tính giờ đó.
    /// </summary>
    public static IReadOnlyList<DateTimeOffset> HourWindows(DateTimeOffset startAt, int durationHours)
    {
        if (durationHours <= 0)
            throw new PromotionArgumentException("Số giờ của gói phải lớn hơn 0");

        var first = StartOfBillableHour(startAt);
        return Enumerable.Range(0, durationHours).Select(i => first.AddHours(i)).ToList();
    }

    /// <summary>
    /// Giờ đầu tiên mà KTV thật sự được tính tiền: giờ hiện tại nếu mua đúng đầu
    /// giờ, ngược lại là giờ kế tiếp.
    /// </summary>
    public static DateTimeOffset StartOfBillableHour(DateTimeOffset instant)
    {
        var bucket = HourBucket(instant);
        return bucket == instant.ToUniversalTime() ? bucket : bucket.AddHours(1);
    }

    /// <summary>Thời điểm kết thúc của campaign tính theo khung giờ.</summary>
    public static DateTimeOffset EndOfHours(DateTimeOffset startAt, int durationHours) =>
        StartOfBillableHour(startAt).AddHours(durationHours);

    /// <summary>
    /// Khung mà campaign chiếm, chọn theo độ mịn của loại gói.
    ///
    /// Một chỗ duy nhất quyết định điều này, để tầng mua và tầng đếm tồn kho không
    /// thể suy ra khác nhau.
    /// </summary>
    public static IReadOnlyList<DateTimeOffset> WindowsFor(
        SlotGranularity granularity, DateTimeOffset startAt, int duration) =>
        granularity switch
        {
            SlotGranularity.Hour => HourWindows(startAt, duration),
            SlotGranularity.Day => DayWindows(startAt, duration),
            _ => throw new PromotionArgumentException($"Độ mịn khung không hợp lệ: {granularity}"),
        };

    /// <summary>Mốc bắt đầu của campaign theo độ mịn khung.</summary>
    public static DateTimeOffset StartFor(SlotGranularity granularity, DateTimeOffset now) =>
        granularity switch
        {
            SlotGranularity.Hour => StartOfBillableHour(now),
            SlotGranularity.Day => DayBucket(now),
            _ => throw new PromotionArgumentException($"Độ mịn khung không hợp lệ: {granularity}"),
        };

    /// <summary>Mốc kết thúc của campaign theo độ mịn khung.</summary>
    public static DateTimeOffset EndFor(
        SlotGranularity granularity, DateTimeOffset startAt, int duration) =>
        granularity switch
        {
            SlotGranularity.Hour => EndOfHours(startAt, duration),
            SlotGranularity.Day => EndOfDays(startAt, duration),
            _ => throw new PromotionArgumentException($"Độ mịn khung không hợp lệ: {granularity}"),
        };
}
