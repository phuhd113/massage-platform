namespace Massage.Promotion.Domain.Ports;

/// <summary>
/// Khoá fast-path khi tranh slot quảng cáo.
///
/// <b>Đây không phải cơ chế đảm bảo tính đúng đắn.</b> Trọng tài cuối cùng chống
/// bán trùng vẫn là ràng buộc <c>UNIQUE (area_id, package_type, window_start,
/// slot_index)</c> ở tầng DB, và luồng mua gói phải chạy <i>đúng</i> ngay cả khi
/// mọi lời gọi ở đây đều thất bại.
///
/// Vậy khoá này để làm gì: khi 20 KTV cùng bấm mua slot cuối, không có khoá thì cả
/// 20 transaction cùng vào, cùng chọn một <c>slot_index</c>, rồi 19 cái xếp hàng
/// chờ khoá của unique index và lần lượt nhận 23505 — mỗi lần retry là một vòng
/// savepoint và một câu INSERT nữa. Khoá cắt phần lớn đám đông đó ở ngoài DB, nên
/// đây là tối ưu tải và thời gian phản hồi, không phải điều kiện đúng sai.
///
/// Vì sao khoá có thể "hết hạn giữa chừng": TTL bảo vệ chống việc process chết mà
/// không nhả khoá. Nếu transaction chạy lâu hơn TTL thì khoá tự rơi và một request
/// khác lấy được nó — lúc đó hai request cùng tin mình đang giữ khoá. Đó là lý do
/// ràng buộc DB không bao giờ được bỏ đi vì "đã có khoá rồi".
/// </summary>
public interface ISlotLock
{
    /// <summary>
    /// Thử chiếm khoá cho một (khu vực, loại gói, khung) trong <paramref name="ttl"/>.
    /// </summary>
    /// <returns>
    /// Handle để nhả khoá, hoặc <c>null</c> khi không lấy được — kể cả khi không lấy
    /// được, <b>người gọi vẫn phải đi tiếp</b>: từ chối lệnh mua chỉ vì không giành
    /// được khoá sẽ biến một tối ưu thành một lỗi nghiệp vụ, và khi Redis chết thì
    /// không ai mua được gì.
    /// </returns>
    Task<ISlotLockHandle?> TryAcquireAsync(
        Guid areaId,
        string packageType,
        DateTimeOffset window,
        TimeSpan ttl,
        CancellationToken ct = default);
}

/// <summary>
/// Quyền sở hữu một khoá đã chiếm được. Nhả bằng <c>DisposeAsync</c>.
///
/// Hiện thực <b>chỉ được</b> xoá khoá khi giá trị trong Redis còn đúng là token của
/// chính mình: khoá có thể đã hết hạn và được request khác chiếm, xoá mù sẽ mở khoá
/// đang thuộc về người khác và làm hỏng đúng thứ khoá sinh ra để bảo vệ.
/// </summary>
public interface ISlotLockHandle : IAsyncDisposable
{
}
