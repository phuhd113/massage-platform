using Microsoft.Extensions.Options;

namespace Massage.Api.Common.Storage;

/// <summary>
/// Đường **duy nhất** biến key thành URL cho response.
///
/// Có một chỗ duy nhất vì hai loại file có hai luật khác hẳn nhau và trộn nhầm là
/// lỗi im lặng theo cả hai chiều: ký hạn cho avatar sẽ tạo URL hết hạn nằm trong
/// trang ISR cache 600 giây (ảnh chết sau 15 phút, HTML vẫn còn), còn trả URL công
/// khai cho chứng chỉ là mở giấy tờ tuỳ thân cho bất kỳ ai đoán được key.
/// </summary>
public class MediaUrls(IObjectStorage storage, IOptions<UploadOptions> options)
{
    private readonly TimeSpan _signedLifetime = TimeSpan.FromMinutes(options.Value.SignedUrlMinutes);

    /// <summary>Ảnh công khai (avatar, gallery). Null vào thì null ra.</summary>
    public string? Public(string? key) =>
        string.IsNullOrEmpty(key) ? null : storage.PublicUrl(key);

    /// <summary>
    /// File riêng tư (chứng chỉ). Chỉ gọi **sau khi** đã kiểm quyền người gọi: URL
    /// trả về mở được mà không cần đăng nhập lại, đó chính là mục đích của nó.
    /// </summary>
    public string Signed(string key) => storage.SignedUrl(key, _signedLifetime);
}
