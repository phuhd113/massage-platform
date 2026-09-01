namespace Massage.Api.Modules.ServiceCatalog.Entities;

/// <summary>
/// Loại dịch vụ trong danh mục dùng chung (bấm huyệt, massage Thái...).
/// Danh mục là tập đóng do admin quản lý, không phải text tự do của KTV — nếu để
/// KTV tự nhập, cùng một dịch vụ sẽ tồn tại dưới hàng chục cách viết và bộ lọc
/// tìm kiếm theo dịch vụ mất tác dụng.
/// </summary>
public class Service
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;

    /// <summary>Đi vào URL công khai (/dich-vu/{slug}) nên phải ổn định.</summary>
    public string Slug { get; set; } = null!;

    public string? Description { get; set; }
    public short SortOrder { get; set; }

    /// <summary>Ngừng bán thì tắt cờ này thay vì xoá — hồ sơ KTV cũ vẫn tham chiếu tới nó.</summary>
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Dịch vụ một KTV cung cấp, kèm giá khởi điểm và thời lượng.</summary>
public class KtvService
{
    public Guid KtvId { get; set; }
    public Guid ServiceId { get; set; }

    /// <summary>VND, không có phần lẻ. NUMERIC chứ không phải float.</summary>
    public decimal PriceFrom { get; set; }

    public short DurationMin { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public Service? Service { get; set; }
}
