using Massage.Api.Data;
using Massage.Promotion.Domain;
using Massage.Promotion.Domain.Ports;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Modules.Promotions.Infrastructure;

/// <summary>
/// Chiếm slot quảng cáo, dựa vào ràng buộc <c>uq_slot</c> làm trọng tài cuối cùng.
///
/// Cách hoạt động khi hai KTV bấm mua cùng lúc: cả hai cùng chọn chỉ số slot trống
/// nhỏ nhất mà mình nhìn thấy, vì transaction này không thấy dòng chưa commit của
/// transaction kia. Người thứ hai khi INSERT sẽ <b>bị chặn</b> ở khoá của unique
/// index cho tới khi người thứ nhất commit hoặc rollback — rồi hoặc nhận 23505
/// (người kia đã lấy) và thử chỉ số tiếp theo, hoặc ghi được (người kia đã huỷ).
///
/// Vì vậy vẫn còn slot trống thì không ai bị báo "hết chỗ" oan, mà slot cuối cùng
/// thì đúng một người thắng.
/// </summary>
public class SlotAllocator(AppDbContext db) : ISlotAllocator
{
    public async Task<int> AllocateAsync(
        Guid campaignId,
        Guid areaId,
        string packageType,
        IReadOnlyList<DateTimeOffset> windows,
        int maxSlotsPerArea,
        CancellationToken ct = default)
    {
        var tx = db.Database.CurrentTransaction
            ?? throw new InvalidOperationException(
                "Chiếm slot phải nằm trong cùng transaction với việc giữ tiền. " +
                "Tách ra thì giữa hai bước sẽ có người khác chen vào.");

        // Số lần thử tối đa bằng số slot: mỗi lần thất bại loại được đúng một chỉ số.
        for (var attempt = 0; attempt < maxSlotsPerArea; attempt++)
        {
            var savepoint = $"slot_try_{attempt}";
            await tx.CreateSavepointAsync(savepoint, ct);

            try
            {
                var index = await TryInsertLowestFreeAsync(
                    campaignId, areaId, packageType, windows, maxSlotsPerArea, ct);

                if (index is null)
                {
                    await tx.RollbackToSavepointAsync(savepoint, ct);
                    throw new SlotExhaustedException(areaId, packageType);
                }

                await tx.ReleaseSavepointAsync(savepoint, ct);
                return index.Value;
            }
            // Bắt đúng mã 23505. Bắt PostgresException trần sẽ nuốt luôn lỗi mất
            // kết nối và biến nó thành "thử slot tiếp theo" cho tới khi hết vòng lặp.
            catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                // Một lệnh lỗi làm abort cả transaction trong Postgres, nên phải quay
                // về savepoint trước khi chạy tiếp — không có savepoint thì mọi câu
                // lệnh sau đó đều fail với "current transaction is aborted".
                await tx.RollbackToSavepointAsync(savepoint, ct);
            }
        }

        throw new SlotExhaustedException(areaId, packageType);
    }

    /// <summary>
    /// Chọn chỉ số slot trống nhỏ nhất và ghi <b>toàn bộ</b> các khung trong một
    /// câu lệnh.
    ///
    /// Một câu lệnh chứ không phải vòng lặp theo từng khung: nếu ghi được vài khung
    /// rồi hỏng ở khung sau, campaign sẽ đứng hạng khác nhau giữa các ngày — thứ
    /// không bán được cho ai. Cùng một câu lệnh thì hoặc đủ, hoặc không có gì.
    /// </summary>
    private async Task<int?> TryInsertLowestFreeAsync(
        Guid campaignId,
        Guid areaId,
        string packageType,
        IReadOnlyList<DateTimeOffset> windows,
        int maxSlotsPerArea,
        CancellationToken ct)
    {
        var rows = await db.Database.SqlQueryRaw<AllocatedIndex>("""
            WITH taken AS (
                SELECT DISTINCT slot_index
                FROM slot_allocations
                WHERE area_id = @areaId
                  AND package_type = @packageType
                  AND window_start = ANY(@windows)
            ),
            chosen AS (
                SELECT i AS slot_index
                FROM generate_series(0, @maxSlots - 1) AS i
                WHERE i NOT IN (SELECT slot_index FROM taken)
                ORDER BY i
                LIMIT 1
            ),
            inserted AS (
                INSERT INTO slot_allocations
                    (campaign_id, area_id, package_type, window_start, slot_index)
                SELECT @campaignId, @areaId, @packageType, w, chosen.slot_index
                FROM chosen CROSS JOIN unnest(@windows) AS w
                RETURNING slot_index
            )
            SELECT DISTINCT slot_index AS "SlotIndex" FROM inserted
            """,
            new NpgsqlParameter("areaId", NpgsqlDbType.Uuid) { Value = areaId },
            new NpgsqlParameter("packageType", NpgsqlDbType.Text) { Value = packageType },
            new NpgsqlParameter("windows", NpgsqlDbType.Array | NpgsqlDbType.TimestampTz)
            {
                Value = windows.Select(w => w.UtcDateTime).ToArray(),
            },
            new NpgsqlParameter("maxSlots", NpgsqlDbType.Integer) { Value = maxSlotsPerArea },
            new NpgsqlParameter("campaignId", NpgsqlDbType.Uuid) { Value = campaignId })
            .ToListAsync(ct);

        // Không dòng nào nghĩa là CTE `chosen` rỗng: mọi chỉ số đã bị chiếm.
        return rows.Count > 0 ? rows[0].SlotIndex : null;
    }

    public async Task ReleaseAsync(Guid campaignId, CancellationToken ct = default) =>
        await db.SlotAllocations.Where(s => s.CampaignId == campaignId).ExecuteDeleteAsync(ct);

    public async Task<int> CountFreeAsync(
        Guid areaId, string packageType, DateTimeOffset window, int maxSlotsPerArea,
        CancellationToken ct = default)
    {
        var taken = await db.SlotAllocations
            .Where(s => s.AreaId == areaId
                        && s.PackageType == packageType
                        && s.WindowStart == window.ToUniversalTime())
            .Select(s => s.SlotIndex)
            .Distinct()
            .CountAsync(ct);

        return Math.Max(0, maxSlotsPerArea - taken);
    }

    private class AllocatedIndex
    {
        public int SlotIndex { get; set; }
    }
}
