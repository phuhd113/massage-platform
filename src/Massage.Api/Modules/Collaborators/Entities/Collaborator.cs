namespace Massage.Api.Modules.Collaborators.Entities;

public static class CollaboratorStatuses
{
    public const string Active = "ACTIVE";

    /// <summary>
    /// Ngừng hoạt động. Mã **không** bị xoá và các hồ sơ đã giới thiệu vẫn giữ nguyên
    /// liên kết — đó là lịch sử đã xảy ra, và xoá nó là xoá cơ sở tính hoa hồng của
    /// những lượt giới thiệu hợp lệ trước đó. Chỉ chặn việc dùng mã cho hồ sơ mới.
    /// </summary>
    public const string Disabled = "DISABLED";
}

/// <summary>
/// Cộng tác viên đi mời kỹ thuật viên tham gia sàn.
///
/// <b>Là bảng riêng chứ không phải một chuỗi tự do trên hồ sơ KTV.</b> Mã này là cơ sở
/// để trả hoa hồng, nên nó phải trỏ tới một người có thật: nhập sai một chữ thì KTV báo
/// lỗi ngay lúc tạo hồ sơ, thay vì lặng lẽ lưu một chuỗi không ai sở hữu và chỉ vỡ ra
/// lúc đối soát. Nó cũng cho phép đếm "CTV này mời được bao nhiêu người, bao nhiêu đã
/// được duyệt" bằng một câu join, thay vì gộp theo chuỗi nơi "AN01" và "an01" thành hai
/// người khác nhau.
///
/// <b>Không phải một <c>User</c>.</b> CTV chưa cần đăng nhập vào hệ thống — họ chỉ cần
/// một mã để đưa cho KTV. Gắn vào bảng <c>users</c> sẽ buộc mỗi CTV phải có tài khoản
/// và một vai trò mới trong <c>UserRoles</c>, tức là mở một đường đăng nhập chưa ai
/// dùng tới. Khi nào CTV cần tự xem báo cáo của mình thì thêm <c>user_id</c> nullable
/// vào đây, không phải đổi ngược mô hình.
/// </summary>
public class Collaborator
{
    public Guid Id { get; set; }

    /// <summary>
    /// Mã KTV gõ vào lúc tạo hồ sơ. Lưu **chữ hoa, không dấu cách** và so khớp đúng
    /// dạng đó — người ta sẽ gõ "an01", "An01", " AN01 " cho cùng một mã, và để ba
    /// chuỗi đó thành ba kết quả khác nhau là biến một lỗi gõ phím thành mất hoa hồng.
    /// Chuẩn hoá ở đúng một chỗ: <c>NormalizeCode</c>.
    /// </summary>
    public string Code { get; set; } = null!;

    public string FullName { get; set; } = null!;

    /// <summary>Để liên hệ khi đối soát. Không hiện ở bất kỳ đường công khai nào.</summary>
    public string? Phone { get; set; }

    public string Status { get; set; } = CollaboratorStatuses.Active;

    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    /// <summary>
    /// Chuẩn hoá mã trước khi lưu và trước khi tra cứu.
    ///
    /// Phải là **cùng một hàm** cho cả hai đường: chuẩn hoá lúc ghi mà không chuẩn hoá
    /// lúc đọc (hoặc ngược lại) thì mã lưu được nhưng không bao giờ tra ra — hỏng im
    /// lặng, vì cả hai thao tác đều báo thành công.
    /// </summary>
    public static string NormalizeCode(string code) =>
        code.Trim().ToUpperInvariant();
}
