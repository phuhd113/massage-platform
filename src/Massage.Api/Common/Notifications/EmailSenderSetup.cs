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
        services.Configure<SmtpOptions>(config.GetSection(SmtpOptions.Section));

        services.AddScoped<AdminNotifier>();

        var notifications = config.GetSection(NotificationOptions.Section)
            .Get<NotificationOptions>() ?? new NotificationOptions();
        var resend = config.GetSection(ResendOptions.Section)
            .Get<ResendOptions>() ?? new ResendOptions();
        var smtp = config.GetSection(SmtpOptions.Section)
            .Get<SmtpOptions>() ?? new SmtpOptions();

        // Stub thắng mọi credential — cùng lý do với `Otp:StubEnabled`: máy dev có
        // credential thật trong `.env` mà không có luật này sẽ gửi email thật, im lặng,
        // vì lượt gửi vẫn thành công.
        if (notifications.StubEnabled || (!resend.Enabled && !smtp.Enabled))
        {
            services.AddSingleton<IEmailSender, LogEmailSender>();
            return services;
        }

        // FromEmail bắt buộc cho cả hai đường: Resend từ chối người gửi ngoài domain đã
        // verify, còn SMTP thì `MailboxAddress` ném lỗi khi địa chỉ rỗng — ném lúc khởi
        // động tốt hơn ném ở hồ sơ KTV thật đầu tiên.
        if (string.IsNullOrWhiteSpace(notifications.FromEmail))
            throw new InvalidOperationException(
                "Notifications:FromEmail bắt buộc khi đã cấu hình nhà cung cấp email "
                + "(Resend:ApiKey hoặc Smtp:Host).");

        // SMTP thắng Resend khi cả hai cùng có. Lý do: SMTP gửi từ một hộp thư @masgo.vn
        // có thật nên gửi được tới bất kỳ ai, còn Resend khi chưa verify domain chỉ gửi
        // được tới chính email chủ tài khoản — tổ hợp "có cả hai" gần như luôn nghĩa là
        // Resend đang là bản dự phòng. Đổi thứ tự này là âm thầm thu hẹp danh sách người
        // nhận xuống còn một người.
        if (smtp.Enabled)
        {
            if (string.IsNullOrWhiteSpace(smtp.Password))
                throw new InvalidOperationException(
                    "Smtp:Password bắt buộc khi đã có Smtp:Host — máy chủ từ chối lượt gửi "
                    + "không xác thực, và lỗi đó đọc như lỗi kết nối.");

            services.AddSingleton<IEmailSender, SmtpEmailSender>();
            return services;
        }

        // Timeout ngắn: lượt gửi này nằm trên đường request đồng bộ của KTV đang nộp hồ sơ.
        // Để mặc định 100 giây nghĩa là Resend treo thì KTV nhìn spinner 100 giây cho một
        // việc không liên quan gì tới họ. Lỗi timeout vẫn bị `AdminNotifier` nuốt.
        services.AddHttpClient(ResendEmailSender.HttpClientName,
            c => c.Timeout = TimeSpan.FromSeconds(10));

        services.AddSingleton<IEmailSender, ResendEmailSender>();
        return services;
    }
}
