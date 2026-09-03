namespace Massage.Api.Modules.Analytics.Entities;

/// <summary>
/// Một lượt xem trang hồ sơ công khai của KTV.
///
/// Lưu từng dòng chứ không chỉ tăng một bộ đếm: dashboard cần so sánh "7 ngày này
/// với 7 ngày trước", mà một con số cộng dồn không trả lời được câu hỏi đó. Đây
/// cũng là bảng sẽ partition theo tháng ở Phase 3 — nó là bảng ghi nhiều nhất của
/// hệ thống, và mỗi hàng chỉ có ý nghĩa trong vài tuần.
///
/// Cố ý **không** ghi ip/user agent thô như <c>leads</c>: lượt xem không phải là
/// đơn vị giá trị đem tính tiền, nên không có lý do giữ dữ liệu định danh cho nó.
/// Chỉ giữ <see cref="ViewerHash"/> để gộp lượt xem lặp, và nó tự hết tác dụng khi
/// dòng cũ bị dọn đi.
/// </summary>
public class ProfileView
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }

    /// <summary>
    /// Hash của (ip + user agent). Chỉ để chống đếm trùng trong cửa sổ ngắn — không
    /// dùng để nhận diện người xem qua các phiên.
    /// </summary>
    public string? ViewerHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
