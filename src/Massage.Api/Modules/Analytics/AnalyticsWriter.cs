using System.Threading.Channels;
using Massage.Api.Data;
using Massage.Api.Modules.Analytics.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Modules.Analytics;

/// <summary>
/// Hàng đợi trong tiến trình cho sự kiện analytics, đọc ra bởi
/// <see cref="AnalyticsWriter"/> và ghi xuống DB theo lô.
///
/// Tách khỏi đường request vì phép nhân: một lượt <c>/search</c> trả 20 KTV là 20 dòng
/// impression. Ghi thẳng trong request sẽ biến một truy vấn 29ms thành 21 lần đi DB, tức
/// là làm chậm chính đường đọc mà cả sàn sống nhờ — để đo được hiệu quả quảng cáo mà làm
/// hỏng thứ đang được quảng cáo thì đổi chác sai.
/// </summary>
public interface IAnalyticsQueue
{
    /// <summary>
    /// Xếp một sự kiện vào hàng đợi. <b>Không bao giờ chặn và không bao giờ ném lỗi</b> —
    /// hàng đầy thì bỏ sự kiện chứ không làm chậm người dùng.
    /// </summary>
    void Enqueue(AnalyticsEvent e);
}

/// <summary>
/// Ghi sự kiện analytics theo lô bằng COPY nhị phân.
///
/// Ba đánh đổi đã cân nhắc, cần biết rõ trước khi sửa:
///
/// 1. <b>Hàng đợi nằm trong bộ nhớ, nên process chết đột ngột sẽ mất phần chưa ghi.</b>
///    Chấp nhận được vì đây là dữ liệu đo đếm gần đúng theo bản chất — mất vài trăm
///    impression không đổi kết luận nào, trong khi một hàng đợi bền (outbox trong DB)
///    chính là thứ ghi vào DB mà ta đang tránh. Tiền và slot thì không bao giờ đi đường
///    này: chúng đi qua transaction ở <c>Modules/Wallets</c>.
///
/// 2. <b>Hàng đầy thì bỏ sự kiện, không chặn.</b> Chặn để giữ lại một dòng thống kê là
///    biến sự cố ghi analytics thành sự cố ngừng phục vụ khách.
///
/// 3. <b>COPY chứ không INSERT từng dòng.</b> Lô 500 dòng bằng COPY là một vòng đi DB;
///    500 INSERT là 500 vòng, và ở đúng bảng ghi nhiều nhất hệ thống.
/// </summary>
public class AnalyticsWriter(
    IServiceScopeFactory scopes,
    ILogger<AnalyticsWriter> logger) : BackgroundService, IAnalyticsQueue
{
    /// <summary>
    /// Sức chứa hàng đợi. Đủ để nuốt một đợt tăng đột biến (500 lượt search đồng thời),
    /// đủ nhỏ để không giữ hàng trăm MB khi DB chậm.
    /// </summary>
    private const int Capacity = 10_000;

    /// <summary>Số dòng tối đa mỗi lần COPY.</summary>
    private const int BatchSize = 500;

    /// <summary>
    /// Chờ tối đa bấy nhiêu để gom thêm dòng trước khi ghi lô còn dở.
    ///
    /// Đây là độ trễ tối đa từ lúc sự kiện xảy ra tới lúc nó lên dashboard. Hai giây là
    /// vô hình với người đọc báo cáo 7 ngày, mà đủ để gom lô ra tấm ra món.
    /// </summary>
    private static readonly TimeSpan FlushInterval = TimeSpan.FromSeconds(2);

    private readonly Channel<AnalyticsEvent> channel =
        Channel.CreateBounded<AnalyticsEvent>(new BoundedChannelOptions(Capacity)
        {
            // Hàng đầy thì bỏ dòng **mới nhất** và trả về false ngay, không chặn người gọi.
            FullMode = BoundedChannelFullMode.DropWrite,
            SingleReader = true,
        });

    private int dropped;

    public void Enqueue(AnalyticsEvent e)
    {
        if (!channel.Writer.TryWrite(e))
        {
            // Đếm rồi báo theo lô thay vì log mỗi lần rớt: hàng đầy nghĩa là đang có rất
            // nhiều sự kiện, nên log mỗi dòng rớt sẽ tự nó thành một cơn bão I/O nữa
            // chồng lên đúng lúc hệ thống đang quá tải.
            Interlocked.Increment(ref dropped);
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var buffer = new List<AnalyticsEvent>(BatchSize);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await FillBatchAsync(buffer, stoppingToken);
                if (buffer.Count > 0) await WriteBatchAsync(buffer, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Một lô hỏng không được giết vòng lặp: writer chết thì mọi sự kiện sau
                // đó im lặng rơi vào hàng đợi đầy dần, và không có gì báo cho tới khi ai
                // đó nhận ra dashboard đứng số.
                logger.LogError(ex, "Ghi analytics lỗi, bỏ lô {Count} dòng", buffer.Count);
            }
            finally
            {
                buffer.Clear();
            }

            ReportDropped();
        }

        // Cố ghi nốt phần còn trong hàng khi app dừng có trật tự (deploy, scale down) —
        // không cứu được lúc process bị kill, nhưng lúc dừng bình thường thì không có lý
        // do gì để mất số liệu.
        await DrainAsync();
    }

    /// <summary>
    /// Gom tối đa <see cref="BatchSize"/> dòng, hoặc tới khi hết
    /// <see cref="FlushInterval"/> — tuỳ điều kiện nào đến trước.
    /// </summary>
    private async Task FillBatchAsync(List<AnalyticsEvent> buffer, CancellationToken ct)
    {
        // Chờ vô hạn cho dòng đầu tiên: lúc sàn vắng thì không có gì để làm, và quay vòng
        // bận rộn ở đây chỉ đốt CPU cho một hàng đợi rỗng.
        if (!await channel.Reader.WaitToReadAsync(ct)) return;

        using var window = CancellationTokenSource.CreateLinkedTokenSource(ct);
        window.CancelAfter(FlushInterval);

        try
        {
            while (buffer.Count < BatchSize
                   && await channel.Reader.WaitToReadAsync(window.Token))
            {
                while (buffer.Count < BatchSize && channel.Reader.TryRead(out var e))
                    buffer.Add(e);
            }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            // Hết cửa sổ gom lô — đúng như thiết kế, ghi những gì đang có.
        }
    }

    private async Task WriteBatchAsync(List<AnalyticsEvent> batch, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var conn = (NpgsqlConnection)db.Database.GetDbConnection();
        if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync(ct);

        // COPY ghi thẳng vào bảng cha; Postgres tự định tuyến từng hàng về đúng partition
        // theo created_at. Không tự chọn tên partition ở tầng ứng dụng — làm vậy là chép
        // lại quy tắc phân mảnh vào code, rồi nó lệch khỏi DB vào lần đổi đầu tiên.
        await using var writer = await conn.BeginBinaryImportAsync(
            "COPY analytics_events (type, ktv_id, area_id, position, viewer_hash, created_at) "
            + "FROM STDIN (FORMAT BINARY)", ct);

        foreach (var e in batch)
        {
            await writer.StartRowAsync(ct);
            await writer.WriteAsync(e.Type, NpgsqlDbType.Varchar, ct);
            await writer.WriteAsync(e.KtvId, NpgsqlDbType.Uuid, ct);

            if (e.AreaId is { } areaId) await writer.WriteAsync(areaId, NpgsqlDbType.Uuid, ct);
            else await writer.WriteNullAsync(ct);

            if (e.Position is { } position) await writer.WriteAsync(position, NpgsqlDbType.Integer, ct);
            else await writer.WriteNullAsync(ct);

            if (e.ViewerHash is { } hash) await writer.WriteAsync(hash, NpgsqlDbType.Varchar, ct);
            else await writer.WriteNullAsync(ct);

            await writer.WriteAsync(e.CreatedAt, NpgsqlDbType.TimestampTz, ct);
        }

        await writer.CompleteAsync(ct);
    }

    private void ReportDropped()
    {
        var count = Interlocked.Exchange(ref dropped, 0);
        if (count > 0)
        {
            logger.LogWarning(
                "Hàng đợi analytics đầy, đã bỏ {Count} sự kiện. Dashboard sẽ báo thiếu — "
                + "kiểm tra DB có đang chậm bất thường không.", count);
        }
    }

    private async Task DrainAsync()
    {
        channel.Writer.TryComplete();

        var buffer = new List<AnalyticsEvent>(BatchSize);
        while (channel.Reader.TryRead(out var e))
        {
            buffer.Add(e);
            if (buffer.Count < BatchSize) continue;

            await WriteRemainingAsync(buffer);
            buffer.Clear();
        }

        if (buffer.Count > 0) await WriteRemainingAsync(buffer);
        ReportDropped();
    }

    private async Task WriteRemainingAsync(List<AnalyticsEvent> buffer)
    {
        try
        {
            // CancellationToken.None: token dừng đã bị huỷ ở đây, dùng nó thì lô cuối
            // không bao giờ ghi được — đúng thứ hàm này sinh ra để cứu.
            await WriteBatchAsync(buffer, CancellationToken.None);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Không ghi được {Count} sự kiện analytics lúc dừng app", buffer.Count);
        }
    }
}
