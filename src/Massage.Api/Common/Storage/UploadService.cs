using Microsoft.Extensions.Options;

namespace Massage.Api.Common.Storage;

/// <summary>
/// Kiểm tra file người dùng gửi lên rồi ghi qua <see cref="IObjectStorage"/>.
/// Trả về **key**, không phải URL — nơi file nằm là chuyện của adapter, còn DB chỉ
/// giữ thứ bất biến (xem doc của <see cref="IObjectStorage"/>).
/// </summary>
public class UploadService(IObjectStorage storage, IOptions<UploadOptions> options)
{
    private readonly UploadOptions _options = options.Value;

    /// <summary>
    /// Cặp phần mở rộng ↔ MIME. Kiểm **cả hai và phải khớp nhau**, không chỉ một
    /// trong hai: cả tên file lẫn Content-Type đều do client gửi, nên một file
    /// <c>.png</c> khai <c>application/pdf</c> qua được nếu chỉ xét riêng từng vế.
    /// </summary>
    private static readonly Dictionary<string, string> ImageTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png",
            [".webp"] = "image/webp",
        };

    private static readonly Dictionary<string, string> CertificationTypes =
        new(ImageTypes, StringComparer.OrdinalIgnoreCase) { [".pdf"] = "application/pdf" };

    /// <summary>Chứng chỉ hành nghề — file riêng tư, chỉ admin đọc được qua URL ký.</summary>
    public Task<string> SaveCertificationAsync(IFormFile file, CancellationToken ct = default) =>
        SaveAsync(file, "certifications", CertificationTypes, _options.MaxSizeMb, ct);

    /// <summary>
    /// Ảnh CCCD — file riêng tư, cùng luật với chứng chỉ nhưng **chỉ nhận ảnh**, không
    /// nhận PDF: mặt thẻ là thứ chụp bằng điện thoại, còn một "CCCD" dạng PDF gần như
    /// chắc chắn là bản scan đã qua chỉnh sửa hoặc một giấy tờ khác gửi nhầm chỗ.
    /// </summary>
    public Task<string> SaveIdentityDocumentAsync(IFormFile file, CancellationToken ct = default) =>
        SaveAsync(file, "identity", ImageTypes, _options.MaxImageSizeMb, ct);

    /// <summary>Ảnh đại diện KTV — công khai, nằm trên card tìm kiếm và trang hồ sơ.</summary>
    public Task<string> SaveAvatarAsync(IFormFile file, CancellationToken ct = default) =>
        SaveAsync(file, "avatars", ImageTypes, _options.MaxImageSizeMb, ct);

    /// <summary>Ảnh gallery hồ sơ — công khai, hiện sau khi admin duyệt.</summary>
    public Task<string> SavePhotoAsync(IFormFile file, CancellationToken ct = default) =>
        SaveAsync(file, "photos", ImageTypes, _options.MaxImageSizeMb, ct);

    private async Task<string> SaveAsync(
        IFormFile file,
        string prefix,
        Dictionary<string, string> allowed,
        int maxSizeMb,
        CancellationToken ct)
    {
        if (file.Length == 0)
            throw new BadRequestException("File rỗng");

        if (file.Length > maxSizeMb * 1024L * 1024L)
            throw new BadRequestException($"File vượt quá {maxSizeMb}MB");

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

        if (!allowed.TryGetValue(ext, out var expectedMime)
            || !string.Equals(expectedMime, file.ContentType, StringComparison.OrdinalIgnoreCase))
        {
            var list = string.Join(", ", allowed.Keys.Select(e => e.TrimStart('.').ToUpperInvariant()).Distinct());
            throw new BadRequestException($"Chỉ chấp nhận file {list}");
        }

        // Không bao giờ dùng tên file do client gửi lên làm tên lưu trữ: nó có thể
        // chứa ../ để ghi ra ngoài thư mục đích. Chia theo tháng để một prefix không
        // phình tới mức không liệt kê nổi khi cần dọn tay.
        var now = DateTimeOffset.UtcNow;
        var key = $"{prefix}/{now:yyyy/MM}/{Guid.NewGuid()}{ext}";

        await using var stream = file.OpenReadStream();
        return await storage.PutAsync(key, stream, expectedMime, ct);
    }
}
