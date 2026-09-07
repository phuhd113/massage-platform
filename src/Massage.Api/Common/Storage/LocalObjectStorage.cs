using Microsoft.Extensions.Options;

namespace Massage.Api.Common.Storage;

/// <summary>
/// Đĩa local — dùng khi chưa cấu hình R2 (dev, test, và bất kỳ máy nào chạy thử mà
/// không có credential). Giữ lại thay vì bắt mọi môi trường phải có R2: test HTTP
/// upload chạy trong container không có mạng ra ngoài, và ghi file test lên bucket
/// thật là rác không ai dọn.
/// </summary>
public class LocalObjectStorage(IOptions<UploadOptions> options, IWebHostEnvironment env)
    : IObjectStorage
{
    private readonly string _root = Path.Combine(env.ContentRootPath, options.Value.Dir);

    public async Task<string> PutAsync(
        string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var path = ResolvePath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);

        return key;
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        // File.Delete tự bỏ qua file không tồn tại; thư mục cha thì để nguyên, dọn
        // thư mục rỗng không đáng đổi lấy một race với lượt upload đang chạy song song.
        File.Delete(ResolvePath(key));
        return Task.CompletedTask;
    }

    /// <summary>
    /// Phục vụ qua <c>UseStaticFiles</c> ở <c>/uploads/{avatars,photos}</c> (xem
    /// Program.cs). Chỉ hai tiền tố đó được mở — key riêng tư dựng ra URL này sẽ 404,
    /// và đó là hành vi đúng.
    /// </summary>
    public string PublicUrl(string key) => $"/uploads/{key}";

    /// <summary>
    /// Đĩa local không ký được, nên trỏ về endpoint có <c>[Authorize]</c> thay vì một
    /// đường dẫn tĩnh.
    ///
    /// Đây **không** phải chi tiết chỉ ảnh hưởng dev: nếu trả về URL tĩnh công khai
    /// thì mọi môi trường chạy đĩa local đều để lộ chứng chỉ cho ai đoán được key, và
    /// bản vá "đã sửa ở R2" sẽ tạo cảm giác an toàn sai. Quyền kiểm ở controller —
    /// <paramref name="lifetime"/> không dùng tới vì phiên đăng nhập đã là hạn của nó.
    /// </summary>
    /// Đường dẫn ghi đủ cả tiền tố <c>/api/v1</c>: frontend chỉ ghép origin của API
    /// vào đường tương đối và không biết gì về quy ước route của backend.
    ///
    /// <b>Endpoint chọn theo tiền tố của key</b>, vì mỗi loại file riêng tư có đường
    /// kiểm quyền riêng: đường chứng chỉ tra bảng <c>certifications</c>, đường CCCD tra
    /// <c>ktv_identity_documents</c>. Trả cùng một endpoint cho mọi key thì ảnh CCCD sẽ
    /// nhận URL trỏ vào chỗ tra nhầm bảng và luôn 404 — hỏng im lặng, vì URL trông vẫn
    /// đúng dạng. Thêm loại file riêng tư mới thì thêm nhánh ở đây.
    public string SignedUrl(string key, TimeSpan lifetime) =>
        key.StartsWith("identity/", StringComparison.Ordinal)
            ? $"/api/v1/ktv/profile/identity/file?key={Uri.EscapeDataString(key)}"
            : $"/api/v1/ktv/certifications/file?key={Uri.EscapeDataString(key)}";

    public Task<Stream?> OpenReadAsync(string key, CancellationToken ct = default)
    {
        var path = ResolvePath(key);
        return Task.FromResult<Stream?>(File.Exists(path) ? File.OpenRead(path) : null);
    }

    /// <summary>
    /// Ghép key vào thư mục gốc rồi **kiểm lại kết quả có còn nằm trong đó không**.
    /// Key do server sinh nên hiện không thể chứa <c>../</c>, nhưng đây là hàm biến
    /// chuỗi thành đường ghi file: chỗ duy nhất chặn được path traversal nếu sau này
    /// có ai cho key đi từ input người dùng.
    /// </summary>
    private string ResolvePath(string key)
    {
        var full = Path.GetFullPath(Path.Combine(_root, key));
        var root = Path.GetFullPath(_root) + Path.DirectorySeparatorChar;

        if (!full.StartsWith(root, StringComparison.Ordinal))
            throw new BadRequestException("Đường dẫn file không hợp lệ");

        return full;
    }
}
