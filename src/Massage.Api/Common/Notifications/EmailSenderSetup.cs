namespace Massage.Api.Common.Notifications;

public static class EmailSenderSetup
{
    public static IServiceCollection AddAdminNotifications(
        this IServiceCollection services, IConfiguration config)
    {
        // Bind vào DI **trước** mọi thứ khác. Bản đọc cục bộ bên dưới chỉ để *chọn*
        // adapter, không thay được việc đăng ký — đúng cái bẫy đã cắn ở `StorageSetup`
        // (quên `Configure<R2Options>` nên bucket thành tên mặc định và R2 trả
        // "Access Denied", đọc như lỗi quyền Cloudflare).
        services.Configure<NotificationOptions>(config.GetSection(NotificationOptions.Section));
        services.Configure<ResendOptions>(config.GetSection(ResendOptions.Section));

        services.AddScoped<AdminNotifier>();

        var notifications = config.GetSection(NotificationOptions.Section)
            .Get<NotificationOptions>() ?? new NotificationOptions();
        var resend = config.GetSection(ResendOptions.Section)
            .Get<ResendOptions>() ?? new ResendOptions();

        // Stub thắng, kể cả khi đã có API key — cùng lý do với `Otp:StubEnabled`: máy dev
        // có credential thật trong `.env` mà không có luật này sẽ gửi email thật, im lặng,
        // vì lượt gửi vẫn thành công.
        if (notifications.StubEnabled || !resend.Enabled)
        {
            services.AddSingleton<IEmailSender, LogEmailSender>();
            return services;
        }

        if (string.IsNullOrWhiteSpace(notifications.FromEmail))
            throw new InvalidOperationException(
                "Notifications:FromEmail bắt buộc khi đã có Resend:ApiKey — Resend từ chối "
                + "mọi lượt gửi không có người gửi thuộc domain đã verify.");

        // Timeout ngắn: lượt gửi này nằm trên đường request đồng bộ của KTV đang nộp hồ sơ.
        // Để mặc định 100 giây nghĩa là Resend treo thì KTV nhìn spinner 100 giây cho một
        // việc không liên quan gì tới họ. Lỗi timeout vẫn bị `AdminNotifier` nuốt.
        services.AddHttpClient(ResendEmailSender.HttpClientName,
            c => c.Timeout = TimeSpan.FromSeconds(10));

        services.AddSingleton<IEmailSender, ResendEmailSender>();
        return services;
    }
}
