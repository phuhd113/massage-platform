namespace Massage.Api.Modules.KtvProfiles.Entities;

/// <summary>
/// Ảnh trong gallery hồ sơ KTV.
///
/// Có <see cref="VerifyStatus"/> riêng chứ không đi theo trạng thái hồ sơ: đây là
/// ngành nhạy cảm về nội dung, mà hồ sơ đã duyệt vẫn thêm được ảnh mới bất cứ lúc
/// nào. Nếu ảnh mới hiện ngay khi hồ sơ đang VERIFIED thì cả kênh acquisition chính
/// — Google — phụ thuộc vào việc không ai lợi dụng khe đó, vì tên miền bị phân loại
/// nội dung người lớn là mất hạng trên toàn site chứ không riêng một hồ sơ.
/// </summary>
public class KtvPhoto
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }

    /// <summary>Key trong object storage, không phải URL — xem <c>IObjectStorage</c>.</summary>
    public string StorageKey { get; set; } = null!;

    /// <summary>Mô tả ngắn, đi vào thuộc tính <c>alt</c>. Rỗng thì dựng từ tên KTV.</summary>
    public string? Caption { get; set; }

    /// <summary>Thứ tự hiển thị do KTV sắp xếp. Nhỏ hơn lên trước.</summary>
    public short SortOrder { get; set; }

    public string VerifyStatus { get; set; } = VerificationStatuses.Pending;
    public string? RejectionReason { get; set; }
    public Guid? VerifiedBy { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public KtvProfile? Ktv { get; set; }
}
