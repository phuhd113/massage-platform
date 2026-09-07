using Massage.Api.Common;
using Microsoft.AspNetCore.Hosting;
using Massage.Api.Common.Storage;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;

namespace Massage.Api.Tests;

/// <summary>
/// <see cref="MediaUrls"/> cho test dựng service trực tiếp (không qua DI của app).
///
/// Dùng <see cref="LocalObjectStorage"/> thay vì một fake: nó là adapter thật sẽ chạy
/// ở dev, và cách dựng URL của nó chính là thứ những test này quan sát. Một fake trả
/// chuỗi cố định sẽ vẫn xanh kể cả khi hàm dựng URL thật bị hỏng.
/// </summary>
public static class TestMedia
{
    public static MediaUrls Urls { get; } = CreateUrls();

    private static MediaUrls CreateUrls()
    {
        var options = Options.Create(new UploadOptions());
        return new MediaUrls(new LocalObjectStorage(options, new TestEnvironment()), options);
    }

    /// <summary>
    /// <c>LocalObjectStorage</c> chỉ đọc <c>ContentRootPath</c> để dựng đường ghi file,
    /// mà những test này không ghi file nào — chúng chỉ dựng URL từ key.
    /// </summary>
    private sealed class TestEnvironment : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "Massage.Api.Tests";
        public string ContentRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider ContentRootFileProvider { get; set; } =
            new NullFileProvider();
        public string EnvironmentName { get; set; } = "Testing";
        public string WebRootPath { get; set; } = Path.GetTempPath();
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
    }
}
