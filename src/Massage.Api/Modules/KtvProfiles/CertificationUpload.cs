using Massage.Api.Common;
using Microsoft.Extensions.Options;

namespace Massage.Api.Modules.KtvProfiles;

/// <summary>
/// Phase 0 lưu file lên đĩa local để không phải chờ dựng S3/R2. Khi chuyển sang
/// object storage, chỉ thay phần ghi file ở đây — controller và service không
/// phụ thuộc vào nơi file nằm.
/// </summary>
public class CertificationUpload(IOptions<UploadOptions> options, IWebHostEnvironment env)
{
    private readonly UploadOptions _options = options.Value;

    private static readonly HashSet<string> AllowedExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".jpg", ".jpeg", ".png", ".webp", ".pdf" };

    private static readonly HashSet<string> AllowedMimeTypes =
        new(StringComparer.OrdinalIgnoreCase) { "image/jpeg", "image/png", "image/webp", "application/pdf" };

    public async Task<string> SaveAsync(IFormFile file, CancellationToken ct = default)
    {
        if (file.Length == 0)
            throw new BadRequestException("File rỗng");

        if (file.Length > _options.MaxSizeMb * 1024L * 1024L)
            throw new BadRequestException($"File vượt quá {_options.MaxSizeMb}MB");

        var ext = Path.GetExtension(file.FileName);
        if (!AllowedExtensions.Contains(ext) || !AllowedMimeTypes.Contains(file.ContentType))
            throw new BadRequestException("Chỉ chấp nhận file JPG, PNG, WEBP hoặc PDF");

        // Không bao giờ dùng tên file do client gửi lên làm tên lưu trữ: nó có thể
        // chứa ../ để ghi ra ngoài thư mục uploads.
        var storedName = $"{Guid.NewGuid()}{ext.ToLowerInvariant()}";
        var dir = Path.Combine(env.ContentRootPath, _options.Dir);
        Directory.CreateDirectory(dir);

        await using var stream = File.Create(Path.Combine(dir, storedName));
        await file.CopyToAsync(stream, ct);

        return $"/uploads/{storedName}";
    }
}
