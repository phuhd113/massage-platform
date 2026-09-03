namespace Massage.Api.Modules.KtvProfiles.Entities;

public static class AreaLevels
{
    public const string Province = "PROVINCE";
    public const string District = "DISTRICT";
    public const string Ward = "WARD";
}

public class AdministrativeArea
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string Level { get; set; } = null!;
    public Guid? ParentId { get; set; }

    /// <summary>
    /// Mã đơn vị hành chính của Tổng cục Thống kê — khoá ổn định để seed lại được
    /// mà không nhân bản dữ liệu và không đổi ID (mọi thứ tham chiếu tới ID: coverage,
    /// campaign, slot_allocations, leads).
    ///
    /// Lưu dạng text chứ không phải số: mã có số 0 đứng đầu ("01" khác "1") và không
    /// bao giờ dùng để tính toán. Nullable vì khu vực do test tạo ra không có mã.
    ///
    /// Chỉ duy nhất **trong cùng một cấp** — mã quận và mã phường đụng nhau ở 226 chỗ
    /// trong dữ liệu thật, nên ràng buộc là <c>(level, code)</c> chứ không phải riêng
    /// <c>code</c>. Dùng riêng code sẽ gộp nhầm một quận với một phường.
    /// </summary>
    public string? Code { get; set; }

    /// <summary>
    /// Nội dung biên tập riêng cho khu vực này. Trang khu vực chỉ được index khi vừa
    /// đủ KTV vừa **có** nội dung riêng — xem <c>AreaService.MinKtvForIndex</c>.
    ///
    /// Mở toàn quốc sinh ra ~760 trang từ đúng một mẫu chỉ thay tên quận; đó là định
    /// nghĩa của doorway page và Google phạt cả tên miền chứ không riêng trang đó.
    /// Ngưỡng số KTV lo phần "có dữ liệu thật", cột này lo phần "có nội dung riêng".
    /// </summary>
    public string? EditorialNote { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public AdministrativeArea? Parent { get; set; }
}

public class CoverageArea
{
    public Guid KtvId { get; set; }
    public Guid AreaId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
