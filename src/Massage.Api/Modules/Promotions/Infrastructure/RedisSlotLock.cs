using Massage.Promotion.Domain.Ports;
using StackExchange.Redis;

namespace Massage.Api.Modules.Promotions.Infrastructure;

/// <summary>
/// Bọc kết nối Redis để DI đăng ký được trạng thái "không có Redis".
///
/// Cần lớp bọc vì container không nhận kiểu dịch vụ nullable
/// (<c>IConnectionMultiplexer?</c>) — mà "không cấu hình Redis" lại là một trạng
/// thái hợp lệ ở đây, không phải lỗi.
/// </summary>
public sealed record RedisConnection(IConnectionMultiplexer? Multiplexer);

/// <summary>
/// Khoá fast-path bằng Redis (<c>SET key token NX PX ttl</c>).
///
/// Mọi lỗi Redis đều bị nuốt và quy về "không lấy được khoá", không ném ra ngoài.
/// Đó là chủ ý: khoá này chỉ giảm tải cho DB, nên Redis chết phải làm luồng mua gói
/// <b>chậm hơn</b> chứ không được làm nó <b>hỏng</b>. Ràng buộc UNIQUE ở
/// <c>slot_allocations</c> vẫn là thứ quyết định ai thắng.
/// </summary>
public class RedisSlotLock(RedisConnection connection, ILogger<RedisSlotLock> logger) : ISlotLock
{
    private readonly IConnectionMultiplexer? redis = connection.Multiplexer;

    /// <summary>
    /// Khoá theo đúng bộ ba xác định một slot. Không khoá theo <c>slot_index</c>:
    /// chỉ số nào còn trống là thứ transaction tự chọn bên trong DB, khoá ở mức
    /// (khu vực, loại gói, khung) mới xếp được hàng những người đang tranh nhau
    /// cùng một tồn kho.
    /// </summary>
    private static string KeyFor(Guid areaId, string packageType, DateTimeOffset window) =>
        $"lock:slot:{areaId}:{packageType}:{window.UtcDateTime:yyyyMMddHHmm}";

    public async Task<ISlotLockHandle?> TryAcquireAsync(
        Guid areaId,
        string packageType,
        DateTimeOffset window,
        TimeSpan ttl,
        CancellationToken ct = default)
    {
        // Không cấu hình Redis (test đơn vị, môi trường tối giản) → chạy thẳng vào
        // DB. Trả null chứ không ném: người gọi đã phải xử lý được nhánh này rồi.
        if (redis is null || !redis.IsConnected) return null;

        var key = KeyFor(areaId, packageType, window);
        // Token nhận dạng chủ sở hữu. Thiếu nó thì lệnh nhả khoá của request này có
        // thể xoá trúng khoá mà request khác vừa chiếm sau khi khoá cũ hết hạn.
        var token = Guid.NewGuid().ToString("N");

        try
        {
            var db = redis.GetDatabase();
            var acquired = await db.StringSetAsync(key, token, ttl, When.NotExists);

            return acquired ? new Handle(db, key, token, logger) : null;
        }
        catch (Exception ex)
        {
            // Log ở mức cảnh báo chứ không im lặng: mất khoá không sai kết quả, nhưng
            // nếu Redis chết cả ngày mà không ai biết thì tải dồn hết vào Postgres.
            logger.LogWarning(ex, "Không lấy được khoá slot ở Redis, chạy thẳng vào DB");
            return null;
        }
    }

    private sealed class Handle(IDatabase db, string key, string token, ILogger logger)
        : ISlotLockHandle
    {
        /// <summary>
        /// So khớp token rồi mới xoá, trong <b>một</b> lệnh Lua để không có khe giữa
        /// bước đọc và bước xoá. Tách thành GET rồi DEL thì đúng khe đó là lúc khoá
        /// hết hạn và người khác chiếm được — và ta xoá mất khoá của họ.
        /// </summary>
        private const string ReleaseScript = """
            if redis.call('GET', KEYS[1]) == ARGV[1] then
                return redis.call('DEL', KEYS[1])
            else
                return 0
            end
            """;

        public async ValueTask DisposeAsync()
        {
            try
            {
                await db.ScriptEvaluateAsync(ReleaseScript, [key], [token]);
            }
            catch (Exception ex)
            {
                // Không nhả được thì khoá tự hết hạn theo TTL. Đây đúng là lý do TTL
                // tồn tại, nên không cần retry và càng không được ném lỗi ra ngoài —
                // lúc này tiền đã trừ và slot đã chiếm xong.
                logger.LogWarning(ex, "Không nhả được khoá slot {Key}, chờ TTL", key);
            }
        }
    }
}
