using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Options;

namespace Massage.Api.Common.Storage;

/// <summary>
/// Cloudflare R2 qua S3-compatible API.
///
/// Bucket để **private**: file công khai (avatar, ảnh hồ sơ) ra ngoài bằng custom
/// domain / r2.dev trỏ vào bucket, còn chứng chỉ hành nghề chỉ mở được bằng URL ký
/// hạn ngắn. Đặt cả bucket thành public thì chứng chỉ — vốn là ảnh chụp giấy tờ tuỳ
/// thân — ai có key cũng tải được, và key nằm trong DTO của trang admin.
/// </summary>
public class R2ObjectStorage(IAmazonS3 s3, IOptions<R2Options> options) : IObjectStorage
{
    private readonly R2Options _options = options.Value;

    public async Task<string> PutAsync(
        string key, Stream content, string contentType, CancellationToken ct = default)
    {
        // Đưa nội dung vào stream **seek được** trước khi gửi.
        //
        // Stream của IFormFile không seek được, nên SDK không băm trước được nội dung
        // và rơi sang chế độ ký theo luồng (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD`) —
        // thứ R2 trả thẳng "not implemented". Stream seek được thì SDK băm trước và
        // ký như một request thường.
        //
        // Nạp cả file vào bộ nhớ chấp nhận được vì `UploadService` đã chặn kích thước
        // trước khi tới đây (3MB ảnh, 5MB chứng chỉ). Nếu về sau có luồng cho file
        // lớn thì phải ghi ra file tạm chứ không nới chỗ này.
        Stream payload = content;
        MemoryStream? buffer = null;

        if (!content.CanSeek)
        {
            buffer = new MemoryStream();
            await content.CopyToAsync(buffer, ct);
            buffer.Position = 0;
            payload = buffer;
        }

        try
        {
            await s3.PutObjectAsync(new PutObjectRequest
            {
                BucketName = _options.Bucket,
                Key = key,
                InputStream = payload,
                ContentType = contentType,

                // Tắt chunk encoding: đây là thứ khiến SDK ký theo luồng
                // (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD`), mà R2 trả "not implemented".
                UseChunkEncoding = false,

                // R2 không hỗ trợ checksum trailer mà AWS SDK từ 3.7.402 bật mặc định
                // (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER`) — không tắt thì mọi
                // lượt ghi hỏng. Chỉ tắt checksum, **không** dùng `DisablePayloadSigning`:
                // cờ đó đổi chữ ký sang UNSIGNED-PAYLOAD và R2 trả "Access Denied".
                DisableDefaultChecksumValidation = true,

                // R2 không tính phí theo request như S3 nhưng vẫn phục vụ qua CDN của
                // Cloudflare; header này quyết định trình duyệt và edge giữ ảnh bao lâu.
                // Key chứa GUID nên nội dung sau một key không bao giờ đổi — immutable
                // là đúng, và nó bỏ hẳn lượt revalidate cho ảnh trên trang SEO.
                Headers = { CacheControl = "public, max-age=31536000, immutable" },
            }, ct);
        }
        finally
        {
            if (buffer is not null) await buffer.DisposeAsync();
        }

        return key;
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        try
        {
            await s3.DeleteObjectAsync(_options.Bucket, key, ct);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // Đã không còn thì coi như xong. Ném lỗi ở đây sẽ chặn việc xoá hàng trong
            // DB và để lại bản ghi trỏ tới file không tồn tại — tệ hơn hẳn.
        }
    }

    public string PublicUrl(string key) => $"{_options.PublicBaseUrl.TrimEnd('/')}/{key}";

    public string SignedUrl(string key, TimeSpan lifetime) =>
        s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _options.Bucket,
            Key = key,
            Expires = DateTime.UtcNow.Add(lifetime),
            Verb = HttpVerb.GET,
        });

    /// <summary>
    /// R2 ký được URL nên đường này chỉ là phần cài đặt đầy đủ của cổng, không nằm
    /// trên luồng nào đang chạy — cho nội dung file đi qua API khi đã ký được là bắt
    /// server gánh băng thông mà CDN vốn gánh hộ.
    /// </summary>
    public async Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var res = await s3.GetObjectAsync(_options.Bucket, key, ct);
            return res.ResponseStream;
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            return null;
        }
    }
}
