namespace Massage.Api.Modules.Auth.Sms;

/// <summary>
/// Cấu hình Zalo ZNS. Adapter được chọn theo **credential** chứ không theo một cờ
/// bật/tắt riêng — cùng lý do với <c>StorageSetup</c>: một cờ <c>UseZns=true</c> sẽ
/// có lúc bật mà thiếu key, và lúc đó app khởi động bình thường rồi mới hỏng ở lượt
/// đăng nhập đầu tiên, tức hỏng trên tay khách thật chứ không phải lúc deploy.
/// </summary>
public class ZaloZnsOptions
{
    public const string Section = "Zalo:Zns";

    /// <summary>App ID của Zalo Mini App / ứng dụng đã liên kết với OA.</summary>
    public string AppId { get; set; } = "";

    /// <summary>Secret key của ứng dụng, dùng để đổi refresh token lấy access token.</summary>
    public string SecretKey { get; set; } = "";

    /// <summary>
    /// Refresh token lấy từ luồng OAuth của Zalo. **Xoay mỗi lần đổi token**: Zalo cấp
    /// refresh token mới ở mỗi lượt refresh và vô hiệu hoá bản cũ, nên nó không thể
    /// chỉ nằm trong file cấu hình — xem <c>IZaloTokenStore</c>.
    /// </summary>
    public string RefreshToken { get; set; } = "";

    /// <summary>ID template ZNS đã được Zalo duyệt cho mục đích OTP.</summary>
    public string TemplateId { get; set; } = "";

    /// <summary>
    /// Tên tham số chứa mã OTP trong template. Zalo cho người tạo template tự đặt tên,
    /// nên không hằng hoá được: khai sai thì ZNS trả lỗi tham số chứ không gửi tin.
    /// </summary>
    public string CodeParamName { get; set; } = "otp";

    /// <summary>
    /// Số phút hiệu lực hiển thị trong tin nhắn, nếu template có tham số đó.
    /// Để trống thì không gửi tham số này.
    /// </summary>
    public string? ExpiryParamName { get; set; }

    public string ApiBaseUrl { get; set; } = "https://business.openapi.zalo.me";
    public string OauthBaseUrl { get; set; } = "https://oauth.zaloapp.com";

    /// <summary>
    /// Gửi ở chế độ phát triển: Zalo chỉ nhận số đã đăng ký trong danh sách test của OA,
    /// và không trừ quota. Bật khi template chưa được duyệt cho production.
    /// </summary>
    public bool DevMode { get; set; }

    public bool Enabled => !string.IsNullOrWhiteSpace(AppId)
        && !string.IsNullOrWhiteSpace(SecretKey)
        && !string.IsNullOrWhiteSpace(TemplateId);
}
