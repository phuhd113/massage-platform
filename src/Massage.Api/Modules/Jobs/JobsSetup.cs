using Hangfire;
using Hangfire.PostgreSql;

namespace Massage.Api.Modules.Jobs;

/// <summary>
/// Cấu hình Hangfire: storage Postgres (không thêm datastore thứ ba), lịch cho từng job,
/// và dashboard có bảo vệ.
/// </summary>
public static class JobsSetup
{
    /// <summary>
    /// Múi giờ của mọi lịch cron. Việt Nam không có DST nên UTC+7 là hằng số, nhưng khai
    /// tường minh vẫn cần: mặc định của Hangfire là **UTC**, nên "3 giờ sáng" viết trần sẽ
    /// chạy lúc 10 giờ sáng giờ Việt Nam — giữa giờ cao điểm thay vì lúc sàn vắng.
    ///
    /// <b>Phải là id có thật trong tzdata, không được dùng <c>CreateCustomTimeZone</c>.</b>
    /// Hangfire chỉ lưu *id* xuống DB rồi tra ngược bằng <c>FindSystemTimeZoneById</c> mỗi
    /// lần tính lượt kế tiếp — một múi giờ tự chế tạo ra object hợp lệ trong tiến trình
    /// nhưng làm app chết ngay lúc khởi động ở container Linux ("The time zone ID 'ICT'
    /// was not found"). Windows và Linux gọi tên khác nhau nên thử lần lượt cả hai.
    /// </summary>
    private static readonly TimeZoneInfo VietnamTime = ResolveVietnamTimeZone();

    private static TimeZoneInfo ResolveVietnamTimeZone()
    {
        // IANA trước (Linux, container production), rồi tên Windows cho máy dev.
        foreach (var id in new[] { "Asia/Ho_Chi_Minh", "SE Asia Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
                // Thử tên tiếp theo.
            }
        }

        // Không tìm được thì chạy theo UTC còn hơn không khởi động được: lịch lệch 7 giờ
        // là chuyện phải sửa, còn app không lên thì cả sàn ngừng bán.
        return TimeZoneInfo.Utc;
    }

    public static IServiceCollection AddJobs(this IServiceCollection services, IConfiguration config)
    {
        var connection = config.GetConnectionString("Default");

        services.AddHangfire(cfg => cfg
            .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
            .UseSimpleAssemblyNameTypeSerializer()
            .UseRecommendedSerializerSettings()
            .UsePostgreSqlStorage(opt => opt.UseNpgsqlConnection(connection), new PostgreSqlStorageOptions
            {
                // Hangfire tự tạo schema "hangfire" riêng, không đụng bảng nghiệp vụ và
                // không nằm trong migration của EF — hai hệ thống quản lý schema chồng lên
                // nhau là nguồn xung đột không cần thiết.
                SchemaName = "hangfire",
                PrepareSchemaIfNecessary = true,

                // Mặc định 15 giây. Với ba job thưa (1 phút là dày nhất) thì hỏi liên tục
                // chỉ tạo tải rỗng lên Postgres; 30 giây vẫn đủ nhanh so với mọi lịch ở đây.
                QueuePollInterval = TimeSpan.FromSeconds(30),

                // Job coi như mồ côi sau 10 phút không gia hạn. Ngắn hơn thì một job dài
                // (đối soát toàn bộ ví) bị coi là chết rồi chạy lại chồng lên chính nó.
                InvisibilityTimeout = TimeSpan.FromMinutes(10),
            }));

        services.AddHangfireServer(opt =>
        {
            opt.ServerName = $"massage-api:{Environment.MachineName}";
            // Ba job định kỳ, không job nào chạy lâu. Mặc định là 20 worker theo số CPU —
            // thừa xa nhu cầu, và mỗi worker giữ một kết nối Postgres từ chung một pool
            // với đường phục vụ request.
            opt.WorkerCount = 2;
        });

        services.AddScoped<MaintenanceJobs>();
        return services;
    }

    /// <summary>
    /// Gắn lịch. Dùng <c>AddOrUpdate</c> với id cố định nên chạy lại lúc khởi động là an
    /// toàn và **đổi lịch trong code sẽ ghi đè lịch cũ** — không để lại job mồ côi chạy
    /// theo lịch đã xoá, thứ chỉ phát hiện được khi thấy nó vẫn nổ.
    /// </summary>
    public static void ScheduleRecurringJobs(this IServiceProvider services)
    {
        var jobs = services.GetRequiredService<IRecurringJobManager>();

        if (VietnamTime == TimeZoneInfo.Utc)
        {
            // Rơi vào fallback: app vẫn chạy nhưng job đối soát sẽ nổ lúc 10 giờ sáng giờ
            // Việt Nam thay vì 3 giờ. Nói to ra, vì đây là loại sai lệch không có triệu
            // chứng nào ngoài "sao job chạy sai giờ".
            services.GetRequiredService<ILoggerFactory>()
                .CreateLogger("Jobs")
                .LogWarning(
                    "Không tìm thấy múi giờ Việt Nam trong tzdata — lịch job đang chạy theo UTC, "
                    + "tức lệch 7 tiếng. Cài gói tzdata vào image để sửa.");
        }

        // 5 phút: hold hết hạn sau 5 phút, nên đây là độ trễ tối đa một khoản tiền bị
        // giữ oan sau khi đã hết hiệu lực.
        jobs.AddOrUpdate<MaintenanceJobs>(
            MaintenanceJobs.HoldCleanup,
            j => j.ReleaseExpiredHoldsAsync(CancellationToken.None),
            "*/5 * * * *",
            new RecurringJobOptions { TimeZone = VietnamTime });

        // 1 phút: là lưới an toàn nên chạy dày, và nó rẻ — một câu SELECT có index,
        // hầu hết các lần trả về rỗng.
        jobs.AddOrUpdate<MaintenanceJobs>(
            MaintenanceJobs.PromotionExpireSweep,
            j => j.ExpireCampaignsAsync(CancellationToken.None),
            "* * * * *",
            new RecurringJobOptions { TimeZone = VietnamTime });

        // 3 giờ sáng giờ Việt Nam: lúc sàn vắng nhất, và đủ sớm để người trực thấy kết quả
        // ngay đầu giờ làm việc thay vì phát hiện lệch sổ vào cuối ngày.
        jobs.AddOrUpdate<MaintenanceJobs>(
            MaintenanceJobs.WalletReconcile,
            j => j.ReconcileWalletsAsync(CancellationToken.None),
            "0 3 * * *",
            new RecurringJobOptions { TimeZone = VietnamTime });

        // 2 giờ sáng, tức **trước** job đối soát một tiếng và trước khi ngày mới có lượng
        // ghi đáng kể. Hằng ngày dù việc chỉ có nghĩa mỗi tháng một lần: lỡ một job tháng
        // là hỏng nguyên tháng, còn ở đây có 30 cơ hội để đúng.
        jobs.AddOrUpdate<MaintenanceJobs>(
            MaintenanceJobs.AnalyticsPartitions,
            j => j.MaintainAnalyticsPartitionsAsync(CancellationToken.None),
            "0 2 * * *",
            new RecurringJobOptions { TimeZone = VietnamTime });

        // 2 giờ 30 sáng: sau khi ngày đã khép lại, và **trước** job đối soát ví lúc 3 giờ
        // để bảng phiên nạp tiền đã sạch khi có người đọc kết quả đối soát. Ngưỡng bỏ dở
        // là 24 giờ nên chạy dày hơn hằng ngày không đổi được gì.
        jobs.AddOrUpdate<MaintenanceJobs>(
            MaintenanceJobs.TopUpIntentSweep,
            j => j.AbandonStaleTopUpIntentsAsync(CancellationToken.None),
            "30 2 * * *",
            new RecurringJobOptions { TimeZone = VietnamTime });
    }
}
