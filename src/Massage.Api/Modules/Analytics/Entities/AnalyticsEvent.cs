namespace Massage.Api.Modules.Analytics.Entities;

public static class AnalyticsEventTypes
{
    /// <summary>Hồ sơ xuất hiện trong một trang kết quả tìm kiếm.</summary>
    public const string Impression = "IMPRESSION";

    /// <summary>Khách mở trang hồ sơ công khai.</summary>
    public const string View = "VIEW";

    /// <summary>Khách bấm lấy số điện thoại. Bản sao nhẹ của một dòng <c>leads</c>.</summary>
    public const string Lead = "LEAD";
}

/// <summary>
/// Một sự kiện hiển thị của KTV: hiện ra trong kết quả tìm kiếm, được mở hồ sơ, hoặc
/// được bấm liên hệ. Ba loại nằm chung một bảng vì chúng là ba bậc của cùng một cái
/// phễu — tách bảng thì mọi truy vấn dashboard phải JOIN ba nơi để dựng lại một hàng.
///
/// <b>Bảng này được partition theo tháng</b> (<c>PARTITION BY RANGE (created_at)</c>).
/// Nó là bảng ghi nhiều nhất hệ thống — mỗi lượt tìm kiếm trả 20 KTV là 20 dòng
/// impression — trong khi mỗi hàng chỉ có ý nghĩa vài tuần. Dọn bằng
/// <c>DROP TABLE</c> một partition là tức thời; <c>DELETE</c> hàng triệu dòng thì khoá
/// bảng, phình WAL và không trả lại đĩa.
///
/// <b>Không có khoá ngoại tới <c>ktv_profiles</c></b>, khác với <c>leads</c>. Hai lý do:
/// khoá ngoại trên bảng partition phải khai lại ở từng partition và job tạo partition
/// hằng tháng phải nhớ làm đúng điều đó mãi mãi; và đây là dữ liệu đo đếm, không phải
/// dữ liệu nghiệp vụ — một dòng trỏ tới KTV đã xoá là rác vô hại, sẽ tự biến mất khi
/// partition bị drop. Đổi lại phải tự lọc theo KTV còn tồn tại khi đọc.
///
/// Cố ý <b>không</b> ghi ip/user agent thô như <c>leads</c>: lượt hiển thị không phải
/// đơn vị đem tính tiền, nên không có lý do giữ dữ liệu định danh. Chỉ giữ
/// <see cref="ViewerHash"/> để gộp lượt lặp, và nó tự hết tác dụng khi dòng cũ bị dọn.
/// </summary>
public class AnalyticsEvent
{
    public Guid Id { get; set; }

    /// <summary>Một trong <see cref="AnalyticsEventTypes"/>. CHECK constraint ở DB ép giá trị.</summary>
    public string Type { get; set; } = null!;

    public Guid KtvId { get; set; }

    /// <summary>
    /// Khu vực khách đang tìm khi sự kiện xảy ra. Chỉ có ở IMPRESSION tìm theo khu vực —
    /// null khi tìm theo toạ độ, vì lúc đó chưa xác định được khu vực hành chính của khách.
    ///
    /// Đây là cột trả lời câu hỏi đắt nhất của KTV trả tiền: "gói tôi mua ở Quận 7 có
    /// làm tôi hiện ra nhiều hơn **ở Quận 7** không".
    /// </summary>
    public Guid? AreaId { get; set; }

    /// <summary>
    /// Vị trí trong trang kết quả (1 là trên cùng). Chỉ có ở IMPRESSION.
    ///
    /// Cần để đo hiệu quả gói đẩy tin theo đúng thứ nó bán: gói mua là **thứ hạng**, nên
    /// "hiện ra 300 lần" mà không biết hạng mấy thì không nói lên điều gì.
    /// </summary>
    public int? Position { get; set; }

    /// <summary>
    /// Hash của (ip + user agent). Chỉ để chống đếm trùng trong cửa sổ ngắn — không dùng
    /// để nhận diện người xem qua các phiên.
    /// </summary>
    public string? ViewerHash { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
