namespace Massage.Api.Modules.KtvProfiles;

/// <summary>
/// Bản cam kết KTV phải chấp nhận trước khi hồ sơ được duyệt.
///
/// <b>Nội dung nằm ở backend, không ở frontend.</b> Đây là tài liệu pháp lý: khi có
/// tranh chấp, thứ cần chứng minh là "người này đã đồng ý với đúng những dòng này vào
/// đúng lúc đó". Nếu danh sách nằm trong JSX thì bản đã ký không tái dựng được — code
/// frontend đã đổi nhiều lần kể từ đó, và không có gì gắn phiên bản với nội dung.
/// Frontend đọc danh sách này qua <c>GET /ktv/commitments</c> và chỉ render.
///
/// <b>Sửa nội dung thì phải tăng <see cref="CurrentVersion"/>.</b> Sửa chữ mà giữ
/// nguyên số phiên bản là làm hỏng chính bằng chứng: hồ sơ cũ sẽ trông như đã đồng ý
/// với những điều họ chưa từng đọc. Tăng phiên bản khiến mọi hồ sơ phải xác nhận lại
/// (xem <c>KtvProfile.CommitmentVersion</c>), nên chỉ tăng khi nghĩa vụ thật sự đổi —
/// sửa lỗi chính tả thì không.
/// </summary>
public static class KtvCommitments
{
    /// <summary>
    /// Phiên bản đang có hiệu lực. Tăng khi <see cref="Items"/> đổi về mặt nghĩa vụ.
    /// </summary>
    public const int CurrentVersion = 1;

    /// <summary>
    /// Các dòng KTV phải tick. Thứ tự cố định — nó là thứ tự đã hiển thị lúc người
    /// dùng đồng ý, và bản in ra để đối chiếu phải khớp.
    ///
    /// Hai dòng về mại dâm và về phạm vi dịch vụ hợp pháp là lý do chính khối này tồn
    /// tại: nền tảng này bị Google phân loại nhầm là nội dung người lớn thì mất hạng
    /// trên **toàn bộ** tên miền, và đó là kênh acquisition chính.
    /// </summary>
    public static readonly IReadOnlyList<string> Items =
    [
        "Tôi cam kết các thông tin cung cấp là chính xác.",
        "Tôi chịu trách nhiệm về tính hợp pháp của hoạt động cung cấp dịch vụ.",
        "Tôi chỉ cung cấp dịch vụ massage/xoa bóp, thư giãn, chăm sóc cơ thể trong phạm vi pháp luật cho phép.",
        "Tôi không đăng tải hoặc cung cấp dịch vụ mại dâm, kích dục, môi giới mại dâm hoặc các dịch vụ tình dục dưới bất kỳ hình thức nào.",
        "Tôi không sử dụng hình ảnh của người khác hoặc thông tin sai sự thật.",
        "Tôi đồng ý để nền tảng xác minh thông tin, tạm khóa hoặc xóa tài khoản khi phát hiện dấu hiệu vi phạm.",
        "Tôi đồng ý với Quy chế hoạt động, Điều khoản sử dụng và Chính sách bảo vệ dữ liệu cá nhân.",
    ];
}
