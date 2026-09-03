using FluentAssertions;
using Massage.Api.Modules.Analytics;
using Massage.Api.Modules.Analytics.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Massage.Api.Tests;

/// <summary>
/// Partition là thứ không có triệu chứng khi hỏng: bảng vẫn ghi được (rơi vào partition
/// mặc định), truy vấn vẫn chạy, chỉ chậm dần và một ngày nào đó không tạo được partition
/// mới nữa. Nên phải canh bằng test chứ không bằng mắt.
/// </summary>
[Collection(PostgresCollection.Name)]
public class AnalyticsPartitionTests(PostgresFixture fixture)
{
    private AnalyticsPartitionMaintenance Maintenance() =>
        new(fixture.CreateContext(), NullLogger<AnalyticsPartitionMaintenance>.Instance);

    [Fact]
    public async Task Hàng_được_định_tuyến_về_partition_đúng_tháng()
    {
        await using var db = fixture.CreateContext();
        var ktvId = Guid.NewGuid();

        // Hai mốc chắc chắn nằm ở hai tháng khác nhau và nằm trong dải partition đã tạo.
        var thángNày = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 15, 12, 0, 0, TimeSpan.Zero);
        var thángSau = thángNày.AddMonths(1);

        db.AnalyticsEvents.Add(new AnalyticsEvent
        {
            Type = AnalyticsEventTypes.View,
            KtvId = ktvId,
            CreatedAt = thángNày,
        });
        db.AnalyticsEvents.Add(new AnalyticsEvent
        {
            Type = AnalyticsEventTypes.View,
            KtvId = ktvId,
            CreatedAt = thángSau,
        });
        await db.SaveChangesAsync();

        var partitions = await db.Database
            .SqlQuery<string>(
                $"""
                 SELECT DISTINCT tableoid::regclass::text AS "Value"
                   FROM analytics_events WHERE ktv_id = {ktvId}
                 """)
            .ToListAsync();

        // Hai hàng ở hai tháng phải nằm ở hai partition khác nhau — nếu cùng một chỗ thì
        // hoặc phân mảnh không hoạt động, hoặc cả hai đang rơi vào partition mặc định.
        partitions.Should().HaveCount(2);
        partitions.Should().NotContain(
            "analytics_events_default",
            "rơi vào partition mặc định nghĩa là thiếu partition cho tháng đó, và hàng nằm "
            + "ở đó sẽ chặn việc tạo partition cho chính tháng nó thuộc về");
    }

    [Fact]
    public async Task Tạo_partition_chạy_lại_được_và_không_nhân_bản()
    {
        var maintenance = Maintenance();

        // Lần đầu có thể tạo hoặc không (migration đã tạo sẵn vài tháng); lần hai thì
        // chắc chắn phải là 0 — job chạy hằng ngày nên nó lặp lại 29 lần thừa mỗi tháng.
        await maintenance.CreateUpcomingAsync();
        var lầnHai = await maintenance.CreateUpcomingAsync();

        lầnHai.Should().Be(0, "CREATE TABLE IF NOT EXISTS nên chạy lại là vô hại");
    }

    [Fact]
    public async Task Không_bỏ_partition_còn_trong_thời_hạn_giữ()
    {
        await using var db = fixture.CreateContext();

        var trước = await ĐếmPartitionAsync(db);
        var bỏ = await Maintenance().DropExpiredAsync();
        var sau = await ĐếmPartitionAsync(db);

        // Mọi partition hiện có đều thuộc tháng này trở đi, nên không cái nào quá 6 tháng.
        // Test này canh chính cái bẫy đáng sợ nhất của job dọn: xoá nhầm dữ liệu còn hạn.
        bỏ.Should().Be(0);
        sau.Should().Be(trước);
    }

    [Fact]
    public async Task Báo_lỗi_khi_partition_mặc_định_có_dữ_liệu()
    {
        await using var db = fixture.CreateContext();

        // Ghi thẳng một hàng ở năm 2000 — không partition nào nhận nên nó rơi vào default.
        var ktvId = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
             INSERT INTO analytics_events (type, ktv_id, created_at)
             VALUES ('VIEW', {ktvId}, '2000-01-15'::timestamptz)
             """);

        try
        {
            var report = await Maintenance().RunAsync();

            // Không tự dọn: dọn tức là xoá số liệu thật. Việc của job là làm cho lỗi nhìn
            // thấy được, còn quyết định chuyển hàng đi đâu là của người.
            report.InDefaultPartition.Should().BeGreaterThan(0);
        }
        finally
        {
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM analytics_events WHERE ktv_id = {ktvId}");
        }
    }

    private static async Task<int> ĐếmPartitionAsync(Massage.Api.Data.AppDbContext db) =>
        (await db.Database
            .SqlQueryRaw<string>(
                """
                SELECT c.relname AS "Value"
                  FROM pg_inherits i
                  JOIN pg_class c ON c.oid = i.inhrelid
                  JOIN pg_class p ON p.oid = i.inhparent
                 WHERE p.relname = 'analytics_events'
                """)
            .ToListAsync()).Count;
}
