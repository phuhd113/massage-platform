namespace Massage.Promotion.Domain;

/// <summary>
/// Độ mịn của khung chiếm slot.
///
/// Vì sao cần khái niệm này thay vì chỉ có khung ngày như trước: Instant Boost bán
/// theo <b>khung giờ vàng</b>, còn VIP Pin và Featured Badge bán theo ngày. Cùng
/// một bảng <c>slot_allocations</c> và cùng một ràng buộc
/// <c>UNIQUE (area_id, package_type, window_start, slot_index)</c> phục vụ được cả
/// hai, vì <c>package_type</c> nằm trong khoá — hai loại gói không bao giờ tranh
/// nhau cùng một dòng, nên khung giờ của Instant Boost không đụng khung ngày của
/// VIP Pin dù cả hai cùng ghi vào một bảng.
///
/// Đây là lý do không tách bảng riêng cho slot theo giờ: tách ra thì mỗi loại slot
/// có một trọng tài chống trùng riêng, và phải nhớ giữ cho chúng khớp nhau mãi mãi.
/// </summary>
public enum SlotGranularity
{
    /// <summary>Một khung = một ngày, cắt theo giờ Việt Nam.</summary>
    Day,

    /// <summary>Một khung = một giờ tròn.</summary>
    Hour,
}

/// <summary>
/// Suy độ mịn khung từ loại gói.
///
/// Đặt ở đây, cạnh <see cref="PackageTypes"/>, chứ không để mỗi nơi tự đoán: nếu
/// tầng mua và tầng hiển thị tồn kho suy ra khác nhau thì catalog sẽ báo còn chỗ
/// trong khi lệnh mua báo hết — hoặc tệ hơn, ngược lại.
/// </summary>
public static class SlotGranularities
{
    public static SlotGranularity For(string packageType) => packageType switch
    {
        PackageTypes.InstantBoost => SlotGranularity.Hour,
        PackageTypes.VipPin or PackageTypes.FeaturedBadge => SlotGranularity.Day,
        _ => throw new UnknownPackageTypeException(packageType),
    };
}
