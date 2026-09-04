using NetTopologySuite.Geometries;

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

    /// <summary>
    /// Chuỗi khớp cho ô gợi ý khu vực: tên đã bỏ dấu, nối thêm tên có dấu và các alias
    /// hay gõ ("q7"). Cột vật chất chứ không tính lúc query vì <c>unaccent()</c> không
    /// immutable nên không index được, và alias thì không hàm nào suy ra được.
    ///
    /// <b>Do DB sinh, không do code ứng dụng ghi</b> — trigger <c>trg_area_name_ascii</c>
    /// dựng lại cột này ở mọi INSERT/UPDATE. Nếu để đường ghi tự điền thì lệnh
    /// <c>seed-areas</c> (upsert bằng raw SQL, không đi qua EF) sẽ bỏ trống cột và ô gợi
    /// ý chết lặng: seed báo thành công, tìm kiếm trả về rỗng.
    /// </summary>
    public string? NameAscii { get; set; }

    /// <summary>
    /// Toạ độ tâm của khu vực, để suy ngược từ vị trí GPS của khách ra quận/huyện họ
    /// đang đứng ("Tìm quanh tôi" điền sẵn ô khu vực).
    ///
    /// <b>Là centroid, không phải ranh giới.</b> Quận gần tâm nhất không phải lúc nào
    /// cũng là quận chứa điểm đó — sai ở rìa những huyện dài hoặc lõm (Cần Giờ, Củ Chi).
    /// Chấp nhận được vì cột này chỉ dùng để **hiển thị** khu vực đang đứng; kết quả tìm
    /// kiếm vẫn lọc theo bán kính quanh toạ độ thật. Đừng dùng nó để quyết định KTV nào
    /// được boost ở khu vực nào — đó là chuyện tiền bạc và cần ranh giới thật.
    ///
    /// NULL với phường/xã (không có trang khu vực nên không cần) và với hai huyện đảo
    /// Hoàng Sa/Trường Sa — nguồn dữ liệu không có hình học cho chúng, và toạ độ đoán sẽ
    /// hút nhầm mọi khách ven biển miền Trung về một huyện không có KTV nào.
    /// </summary>
    public Point? Centroid { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public AdministrativeArea? Parent { get; set; }
}

public class CoverageArea
{
    public Guid KtvId { get; set; }
    public Guid AreaId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
