using Amazon.Runtime;
using Amazon.S3;

namespace Massage.Api.Common.Storage;

public static class StorageSetup
{
    /// <summary>
    /// Chọn adapter theo cấu hình: có credential R2 thì dùng R2, không thì đĩa local.
    ///
    /// Chọn theo **credential** chứ không theo tên môi trường: một cờ
    /// <c>UseR2=true</c> riêng sẽ có lúc bật mà thiếu key, và lúc đó app khởi động
    /// bình thường rồi mới hỏng ở lượt upload đầu tiên — tức là hỏng trên tay KTV
    /// thật chứ không phải lúc deploy.
    /// </summary>
    public static IServiceCollection AddObjectStorage(
        this IServiceCollection services, IConfiguration config)
    {
        // Bind vào DI **trước** mọi thứ khác: `R2ObjectStorage` và `MediaUrls` nhận
        // `IOptions<R2Options>` qua constructor, và thiếu dòng này thì chúng nhận bản
        // mặc định — `Bucket` thành "massage-platform" thay vì bucket thật.
        //
        // Đã cắn đúng lỗi này: mọi lượt ghi trả "Access Denied", mà đọc như lỗi quyền
        // của token nên tốn cả một vòng đi kiểm tra Cloudflare. Bản đọc cục bộ bên
        // dưới chỉ dùng để **chọn** adapter, không thay được việc đăng ký.
        services.Configure<R2Options>(config.GetSection(R2Options.Section));

        var r2 = config.GetSection(R2Options.Section).Get<R2Options>() ?? new R2Options();

        if (!r2.Enabled)
        {
            services.AddSingleton<IObjectStorage, LocalObjectStorage>();
            return services;
        }

        // Fail fast, cùng lý do với Jwt:Secret. Thiếu PublicBaseUrl thì mọi ảnh hồ sơ
        // sẽ mang URL trỏ vào endpoint S3, thứ chỉ trả 401 cho request không ký —
        // ảnh không hiện mà log không có lỗi nào.
        if (string.IsNullOrWhiteSpace(r2.PublicBaseUrl))
            throw new InvalidOperationException(
                "R2:PublicBaseUrl bắt buộc khi bật R2 — đặt custom domain hoặc URL r2.dev của bucket.");

        if (string.IsNullOrWhiteSpace(r2.SecretAccessKey))
            throw new InvalidOperationException("R2:SecretAccessKey bắt buộc khi đã có R2:AccessKeyId.");

        services.AddSingleton<IAmazonS3>(_ => new AmazonS3Client(
            new BasicAWSCredentials(r2.AccessKeyId, r2.SecretAccessKey),
            new AmazonS3Config
            {
                ServiceURL = $"https://{r2.AccountId}.r2.cloudflarestorage.com",
                // R2 chỉ nhận path-style; virtual-host style (bucket nằm trong hostname)
                // sẽ ra tên miền không tồn tại.
                ForcePathStyle = true,
                // R2 không có khái niệm region nhưng SDK bắt buộc phải có một giá trị
                // để tính chữ ký SigV4. "auto" là giá trị Cloudflare quy định.
                AuthenticationRegion = "auto",

                // Ba cờ dưới đây cùng tắt một thứ: chữ ký theo luồng
                // (`STREAMING-AWS4-HMAC-SHA256-PAYLOAD[-TRAILER]`), thứ R2 **không**
                // hỗ trợ và trả thẳng "not implemented" cho mọi lượt ghi.
                //
                // AWS SDK từ 3.7.402 bật cả chunk encoding lẫn checksum mặc định. Đã
                // thử tắt từng cái một: chỉ tắt checksum thì vẫn hỏng, và
                // `DisablePayloadSigning` ở tầng request thì R2 đổi sang trả
                // "Access Denied". Phải tắt ở tầng client, và tắt cả ba.
                RequestChecksumCalculation = Amazon.Runtime.RequestChecksumCalculation.WHEN_REQUIRED,
                ResponseChecksumValidation = Amazon.Runtime.ResponseChecksumValidation.WHEN_REQUIRED,
            }));

        services.AddSingleton<IObjectStorage, R2ObjectStorage>();
        return services;
    }
}
