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
}
