namespace Massage.Api.Common.Notifications;

/// <summary>
/// Ai nhận thông báo vận hành, và gửi qua nhà cung cấp nào.
/// </summary>
public class NotificationOptions
{
    public const string Section = "Notifications";

    /// <summary>
    /// Danh sách email ban quản trị, phân cách bằng dấu phẩy. Để trống thì không gửi gì
    /// (và <c>EmailSenderSetup</c> ghi log cảnh báo lúc khởi động).
    /// </summary>
    /// <remarks>
    /// Cố ý là **cấu hình** chứ không phải một cột trong bảng <c>users</c>: tài khoản
    /// đăng nhập bằng số điện thoại và bảng đó không có cột email nào. Thêm một cột chỉ
    /// để nuôi danh sách người nhận là trả giá một migration cho thứ đổi bằng cách sửa
    /// biến môi trường — và danh sách này thay đổi theo **người vận hành**, không theo
    /// tài khoản đăng nhập.
    /// </remarks>
    public string AdminEmails { get; set; } = "";

    /// <summary>
    /// Địa chỉ người gửi. Phải thuộc domain đã verify ở nhà cung cấp, nếu không mọi lượt
    /// gửi bị từ chối — và Resend trả lỗi đó ở **body** chứ không ở status code.
    /// </summary>
    public string FromEmail { get; set; } = "";

    /// <summary>Tên hiển thị của người gửi.</summary>
    public string FromName { get; set; } = "MasGo";

    /// <summary>
    /// Gốc URL của trang quản trị, để email dựng link đi thẳng tới hàng đợi duyệt.
    /// Không có link thì email chỉ báo tin mà bắt người đọc tự đi tìm chỗ hành động —
    /// và thứ họ cần luôn nằm ở một trong hai trang cụ thể.
    /// </summary>
    public string AdminBaseUrl { get; set; } = "https://masgo.vn";

    /// <summary>
    /// Ghi email ra log thay vì gửi thật. Thắng mọi credential khác — cùng lý do với
    /// <c>Otp:StubEnabled</c>: một máy dev có credential thật trong <c>.env</c> mà không
    /// có luật này sẽ gửi email thật, im lặng, vì lượt gửi vẫn thành công.
    /// </summary>
    public bool StubEnabled { get; set; }

    /// <summary>
    /// Danh sách người nhận đã tách và chuẩn hoá. Rỗng nghĩa là không có ai để gửi.
    /// </summary>
    public IReadOnlyList<string> AdminEmailList =>
        AdminEmails.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

/// <summary>Cấu hình Resend. Adapter được chọn theo sự có mặt của <see cref="ApiKey"/>.</summary>
public class ResendOptions
{
    public const string Section = "Resend";

    /// <summary>API key dạng <c>re_...</c>, lấy ở bảng điều khiển Resend.</summary>
    public string ApiKey { get; set; } = "";

    public string ApiBaseUrl { get; set; } = "https://api.resend.com";

    public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);
}
