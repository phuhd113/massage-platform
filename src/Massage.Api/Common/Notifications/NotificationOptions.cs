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

/// <summary>
/// Cấu hình SMTP (hiện dùng Email Server của P.A Việt Nam). Adapter chọn theo sự có mặt
/// của <see cref="Host"/> + <see cref="Username"/>.
/// </summary>
/// <remarks>
/// <para>
/// Ưu điểm so với Resend cho trường hợp này: người gửi là một hộp thư <c>@masgo.vn</c> có
/// thật, nên gửi được tới **bất kỳ ai** mà không cần verify domain riêng ở một nhà cung
/// cấp thứ hai — P.A đã quản DNS mail của domain.
/// </para>
/// <para>
/// <b>Rủi ro phải nhớ:</b> nhiều nhà cung cấp VPS chặn port outbound 25/465/587 để chống
/// spam, và việc đó hỏng <b>im lặng</b> — kết nối treo tới timeout, đọc như lỗi cấu hình
/// chứ không như lỗi mạng. Đã kiểm trên máy dev (cả 465 và 587 đều mở); <b>VPS production
/// là môi trường khác và phải kiểm riêng trước khi deploy</b>. Resend giữ nguyên làm
/// phương án dự phòng chính vì lý do đó — nó đi qua HTTPS 443 nên không bao giờ bị chặn.
/// </para>
/// </remarks>
public class SmtpOptions
{
    public const string Section = "Smtp";

    /// <summary>Máy chủ SMTP, ví dụ <c>mail92231.maychuemail.com</c>.</summary>
    public string Host { get; set; } = "";

    /// <summary>
    /// 465 = SSL implicit (khuyến nghị), 587 = STARTTLS. Cổng 25 không mã hoá và bị chặn
    /// ở hầu hết nhà cung cấp — đừng dùng.
    /// </summary>
    public int Port { get; set; } = 465;

    /// <summary>Tên đăng nhập, thường là chính địa chỉ email đầy đủ.</summary>
    public string Username { get; set; } = "";

    public string Password { get; set; } = "";

    /// <summary>
    /// Số giây chờ trước khi bỏ cuộc. Ngắn có chủ ý: lượt gửi nằm trên đường request đồng
    /// bộ của KTV đang nộp hồ sơ, và ca hỏng điển hình (port bị chặn) là **treo** chứ
    /// không phải từ chối — để mặc định 2 phút nghĩa là KTV nhìn spinner suốt quãng đó.
    /// </summary>
    public int TimeoutSeconds { get; set; } = 15;

    public bool Enabled => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(Username);
}
