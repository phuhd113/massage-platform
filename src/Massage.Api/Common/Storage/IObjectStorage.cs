namespace Massage.Api.Common.Storage;

/// <summary>
/// Nơi file thật sự nằm. Hai adapter: <see cref="R2ObjectStorage"/> (production,
/// Cloudflare R2 qua S3 API) và <see cref="LocalObjectStorage"/> (dev/test, đĩa local).
///
/// Tầng gọi chỉ giữ **key** — đường dẫn tương đối trong bucket, ví dụ
/// <c>certifications/2026/09/{guid}.pdf</c> — chứ không giữ URL đầy đủ. Đây là điểm
/// khác quan trọng nhất so với code cũ: lưu URL xuống DB thì đổi bucket, đổi custom
/// domain hay chuyển nhà cung cấp đều thành migration backfill toàn bảng, và những
/// hàng cũ trỏ tới host đã chết vẫn nằm đó. Key thì bất biến, URL dựng lúc đọc.
/// </summary>
public interface IObjectStorage
{
    /// <summary>Ghi file và trả về key đã lưu.</summary>
    Task<string> PutAsync(
        string key, Stream content, string contentType, CancellationToken ct = default);

    /// <summary>
    /// Xoá file. **Nuốt lỗi "không tồn tại"** — xoá một thứ đã biến mất là đúng kết
    /// quả mong muốn, và ném lỗi ở đó sẽ chặn việc xoá hàng trong DB, để lại bản ghi
    /// trỏ tới file không có thật.
    /// </summary>
    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>
    /// URL đọc trực tiếp, dùng cho file công khai (avatar, ảnh hồ sơ). Không ký hạn,
    /// cache được ở CDN — đó chính là lý do chúng để public.
    /// </summary>
    string PublicUrl(string key);

    /// <summary>
    /// URL ký hạn ngắn cho file riêng tư (chứng chỉ hành nghề chứa giấy tờ tuỳ thân).
    /// Chỉ sinh sau khi tầng gọi đã kiểm quyền — bản thân URL này là "ai cầm cũng mở
    /// được", nên thời hạn phải ngắn và không bao giờ được đưa vào trang cache.
    /// </summary>
    string SignedUrl(string key, TimeSpan lifetime);

    /// <summary>
    /// Đọc file về, hoặc null khi không tồn tại.
    ///
    /// Chỉ dùng cho đường phục vụ file riêng tư của <c>LocalObjectStorage</c> (xem
    /// <c>GET /ktv/certifications/{id}/file</c>): R2 ký được URL nên không cần cho
    /// nội dung đi qua API, còn đĩa local thì không, mà file chứng chỉ không được
    /// nằm sau một đường dẫn tĩnh công khai.
    /// </summary>
    Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default);
}
