using Massage.Api.Common;

namespace Massage.Api.Modules.Auth.Sms;

public static class OtpSenderSetup
{
    public static IServiceCollection AddOtpSender(
        this IServiceCollection services, IConfiguration config)
    {
        // Bind vào DI trước mọi thứ khác. Bản đọc cục bộ bên dưới chỉ để **chọn** adapter,
        // không thay được việc đăng ký — quên dòng này thì `ZaloZnsSender` nhận
        // `ZaloZnsOptions` mặc định, tức TemplateId rỗng, và Zalo trả lỗi tham số đọc
        // như lỗi quyền. Đúng cái bẫy đã cắn một lần ở `StorageSetup`.
        services.Configure<ZaloZnsOptions>(config.GetSection(ZaloZnsOptions.Section));

        var otp = config.GetSection(OtpOptions.Section).Get<OtpOptions>() ?? new OtpOptions();
        var zns = config.GetSection(ZaloZnsOptions.Section).Get<ZaloZnsOptions>() ?? new ZaloZnsOptions();

        // Stub thắng khi được bật, kể cả khi đã có credential ZNS. Ngược lại thì một máy
        // dev có credential thật trong .env sẽ gửi tin thật tới số thật và đốt quota —
        // im lặng, vì lượt gửi vẫn thành công.
        if (otp.StubEnabled)
        {
            services.AddSingleton<IOtpSender, StubOtpSender>();
            return services;
        }

        if (!zns.Enabled)
        {
            // Không nổ lúc khởi động: khác `Jwt:Secret` (thiếu là mọi token giả mạo được),
            // thiếu nhà cung cấp SMS chỉ làm hỏng đường đăng nhập. Chặn cả app khởi động
            // vì điều đó là biến một tính năng hỏng thành toàn bộ sàn ngừng phục vụ, kể cả
            // các trang SEO vốn không cần đăng nhập.
            services.AddSingleton<IOtpSender, UnconfiguredOtpSender>();
            return services;
        }

        if (string.IsNullOrWhiteSpace(zns.SecretKey))
            throw new InvalidOperationException("Zalo:Zns:SecretKey bắt buộc khi đã có Zalo:Zns:AppId.");

        // Timeout ngắn có chủ ý: đây nằm trên đường request đồng bộ của người dùng đang
        // chờ màn hình nhập mã. Để mặc định 100 giây nghĩa là Zalo treo thì khách nhìn
        // spinner đúng 100 giây rồi mới biết hỏng.
        services.AddHttpClient(ZaloZnsSender.HttpClientName,
            c => c.Timeout = TimeSpan.FromSeconds(10));

        services.AddSingleton<IZaloTokenStore, ZaloTokenStore>();
        services.AddSingleton<IOtpSender, ZaloZnsSender>();
        return services;
    }
}
