using Massage.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Analytics;

public sealed record PartitionReport(int Created, int Dropped, long InDefaultPartition);

/// <summary>
/// Duy trì các partition theo tháng của <c>analytics_events</c>: tạo trước cho tháng
/// tới, dọn tháng quá hạn.
///
/// <b>Việc tạo trước là bắt buộc, không phải dọn dẹp cho gọn.</b> Thiếu partition cho
/// tháng hiện tại thì mọi INSERT rơi vào partition mặc định — và một hàng nằm ở đó sẽ
/// **chặn** việc tạo partition cho chính tháng nó thuộc về, nên lỗi tự khoá lại càng lâu
/// càng khó gỡ. Chạy hằng ngày chứ không hằng tháng: một job tháng lỡ mất là hỏng cả
/// tháng, còn job ngày thì có 30 cơ hội để đúng.
/// </summary>
public class AnalyticsPartitionMaintenance(AppDbContext db, ILogger<AnalyticsPartitionMaintenance> logger)
{
    /// <summary>Số tháng tạo trước, tính cả tháng hiện tại.</summary>
    private const int MonthsAhead = 3;

    /// <summary>
    /// Giữ 6 tháng. Đủ để so cùng kỳ vài tháng và thấy xu hướng mùa vụ, mà không giữ mãi
    /// một bảng chỉ có ý nghĩa trong vài tuần.
    /// </summary>
    private const int RetentionMonths = 6;

    public async Task<PartitionReport> RunAsync(CancellationToken ct = default)
    {
        var created = await CreateUpcomingAsync(ct);
        var dropped = await DropExpiredAsync(ct);
        var stranded = await CountDefaultPartitionAsync(ct);

        if (stranded > 0)
        {
            // Hàng ở partition mặc định nghĩa là đã có lúc thiếu partition cho tháng đó.
            // Chúng không được partition pruning, và sự tồn tại của chúng chặn việc tạo
            // partition cho tháng tương ứng — nên đây là việc cần người xử lý, không phải
            // thứ để job tự dọn (dọn tức là xoá số liệu thật).
            logger.LogError(
                "analytics_events_default có {Count} dòng — đã có lúc thiếu partition. "
                + "Cần chuyển chúng về đúng tháng rồi mới tạo được partition cho tháng đó.",
                stranded);
        }

        return new PartitionReport(created, dropped, stranded);
    }

    /// <summary>
    /// Tạo partition cho tháng hiện tại và <see cref="MonthsAhead"/> tháng tới.
    /// <c>IF NOT EXISTS</c> nên chạy lại hằng ngày là vô hại.
    /// </summary>
    public async Task<int> CreateUpcomingAsync(CancellationToken ct = default)
    {
        var before = await CountPartitionsAsync(ct);

        // Ranh giới tháng cắt theo giờ Việt Nam, cùng quy ước với campaign: đặt theo UTC
        // thì số liệu bảy giờ đầu mỗi tháng rơi vào partition của tháng trước — không sai
        // dữ liệu, nhưng làm mọi câu "tháng này" lệch đi mà không có gì báo.
        await db.Database.ExecuteSqlRawAsync(
            """
            DO $$
            DECLARE
                m DATE := date_trunc('month', now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
                i INT;
            BEGIN
                FOR i IN 0..{0} LOOP
                    EXECUTE format(
                        'CREATE TABLE IF NOT EXISTS analytics_events_%s '
                        || 'PARTITION OF analytics_events FOR VALUES FROM (%L) TO (%L)',
                        to_char(m + (i || ' month')::interval, 'YYYY_MM'),
                        (m + (i || ' month')::interval)::date,
                        (m + ((i + 1) || ' month')::interval)::date);
                END LOOP;
            END $$;
            """.Replace("{0}", MonthsAhead.ToString()),
            ct);

        var created = await CountPartitionsAsync(ct) - before;
        if (created > 0) logger.LogInformation("Đã tạo {Count} partition analytics", created);

        return created;
    }

    /// <summary>
    /// Bỏ partition cũ hơn <see cref="RetentionMonths"/> tháng.
    ///
    /// <c>DETACH</c> rồi <c>DROP</c> thay vì drop thẳng: drop thẳng cần khoá ACCESS
    /// EXCLUSIVE trên **bảng cha**, tức là chặn mọi lượt ghi analytics trong lúc đó.
    /// Detach concurrently chỉ chạm partition đang gỡ.
    /// </summary>
    public async Task<int> DropExpiredAsync(CancellationToken ct = default)
    {
        var cutoff = DateTime.UtcNow.AddMonths(-RetentionMonths);
        var expired = await ListPartitionsAsync(ct);

        var dropped = 0;
        foreach (var name in expired)
        {
            // Tên dạng analytics_events_YYYY_MM. Bỏ qua partition mặc định và mọi tên
            // không khớp — job này không được phép xoá thứ nó không hiểu.
            var suffix = name["analytics_events_".Length..];
            if (!DateTime.TryParseExact(
                    suffix, "yyyy_MM", null,
                    System.Globalization.DateTimeStyles.None, out var month))
            {
                continue;
            }

            if (month >= new DateTime(cutoff.Year, cutoff.Month, 1)) continue;

            // EF1002: SQL không tham số hoá được **tên bảng**, nên phải ghép chuỗi. An
            // toàn ở đây không đến từ tham số hoá mà từ nguồn gốc của `name`: nó do chính
            // Postgres liệt kê ra (pg_inherits), đã lọc theo bảng cha, và vừa qua
            // TryParseExact ở trên — một tên không đúng dạng analytics_events_YYYY_MM thì
            // đã `continue` mất rồi. Không có đường nào để chuỗi từ bên ngoài tới đây.
#pragma warning disable EF1002
            await db.Database.ExecuteSqlRawAsync(
                $"ALTER TABLE analytics_events DETACH PARTITION {name} CONCURRENTLY", ct);
            await db.Database.ExecuteSqlRawAsync($"DROP TABLE {name}", ct);
#pragma warning restore EF1002

            dropped++;
            logger.LogInformation("Đã bỏ partition analytics quá hạn {Partition}", name);
        }

        return dropped;
    }

    private async Task<List<string>> ListPartitionsAsync(CancellationToken ct) =>
        await db.Database
            .SqlQueryRaw<string>(
                """
                SELECT c.relname AS "Value"
                  FROM pg_inherits i
                  JOIN pg_class c ON c.oid = i.inhrelid
                  JOIN pg_class p ON p.oid = i.inhparent
                 WHERE p.relname = 'analytics_events'
                   AND c.relname <> 'analytics_events_default'
                """)
            .ToListAsync(ct);

    private async Task<int> CountPartitionsAsync(CancellationToken ct) =>
        (await ListPartitionsAsync(ct)).Count;

    private async Task<long> CountDefaultPartitionAsync(CancellationToken ct) =>
        await db.Database
            .SqlQueryRaw<long>("SELECT count(*) AS \"Value\" FROM analytics_events_default")
            .SingleAsync(ct);
}
