namespace Massage.Api.Common;

public class JwtOptions
{
    public const string Section = "Jwt";
    public string Secret { get; set; } = "";
    public string Issuer { get; set; } = "massage-platform";
    public string Audience { get; set; } = "massage-platform";
    public int ExpiresDays { get; set; } = 7;
}

public class OtpOptions
{
    public const string Section = "Otp";

    /// <summary>
    /// Khi bật, mã OTP được ghi log và trả trong response thay vì gửi SMS thật.
    /// Phải tắt ở production — lúc đó OtpService sẽ báo lỗi rõ ràng nếu chưa cắm
    /// adapter SMS, thay vì âm thầm không gửi gì.
    /// </summary>
    public bool StubEnabled { get; set; } = true;

    public int TtlSeconds { get; set; } = 300;
    public int MaxAttempts { get; set; } = 5;
}

public class UploadOptions
{
    public const string Section = "Upload";

    /// <summary>Thư mục đĩa local cho <c>LocalObjectStorage</c>. Không dùng khi chạy R2.</summary>
    public string Dir { get; set; } = "uploads";

    /// <summary>Giới hạn cho file chứng chỉ (ảnh hoặc PDF).</summary>
    public int MaxSizeMb { get; set; } = 5;

    /// <summary>
    /// Giới hạn cho ảnh hồ sơ (avatar, gallery). Nhỏ hơn chứng chỉ có chủ ý: chứng chỉ
    /// là PDF scan xem một lần trong trang duyệt, còn ảnh hồ sơ nằm trên đường đọc SEO
    /// và mỗi MB thừa là LCP chậm thêm cho khách trên 3G.
    /// </summary>
    public int MaxImageSizeMb { get; set; } = 3;

    /// <summary>Số ảnh gallery tối đa một KTV được giữ.</summary>
    public int MaxPhotosPerKtv { get; set; } = 10;

    /// <summary>
    /// Hạn của URL ký cho file chứng chỉ. Ngắn có chủ ý: URL ký là "ai cầm cũng mở
    /// được", và trang duyệt hồ sơ chỉ cần đủ để admin mở file ngay lúc đang xem.
    /// </summary>
    public int SignedUrlMinutes { get; set; } = 15;
}

/// <summary>
/// Cloudflare R2 qua S3-compatible API. Để <see cref="AccessKeyId"/> trống thì app
/// dùng <c>LocalObjectStorage</c> — dev và test chạy được ngay mà không cần credential,
/// và không ai vô tình ghi file test lên bucket thật.
/// </summary>
public class R2Options
{
    public const string Section = "R2";

    /// <summary>Account ID của Cloudflare, dựng thành endpoint <c>https://{id}.r2.cloudflarestorage.com</c>.</summary>
    public string AccountId { get; set; } = "";

    public string AccessKeyId { get; set; } = "";
    public string SecretAccessKey { get; set; } = "";
    public string Bucket { get; set; } = "massage-platform";

    /// <summary>
    /// Origin phục vụ file công khai — custom domain (<c>https://cdn.example.com</c>)
    /// hoặc r2.dev. Bắt buộc khi bật R2: endpoint S3 ở trên **không** phục vụ file cho
    /// trình duyệt, nó chỉ nhận request đã ký. Dựng URL công khai từ nó sẽ ra link 401
    /// mà không có gì báo lỗi cho tới khi ảnh không hiện.
    /// </summary>
    public string PublicBaseUrl { get; set; } = "";

    public bool Enabled => !string.IsNullOrWhiteSpace(AccessKeyId)
                           && !string.IsNullOrWhiteSpace(AccountId);
}
