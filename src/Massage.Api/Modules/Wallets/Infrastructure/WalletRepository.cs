using Massage.Api.Data;
using Massage.Api.Modules.Wallets.Entities;
using Massage.Wallet.Domain;
using Massage.Wallet.Domain.Ports;
using Microsoft.EntityFrameworkCore;
using DomainWallet = Massage.Wallet.Domain.Wallet;

namespace Massage.Api.Modules.Wallets.Infrastructure;

/// <summary>
/// Hiện thực cổng lưu trữ ví bằng EF + raw SQL.
///
/// Toàn bộ SQL của vùng chạm tiền nằm ở đây, không lọt vào domain. Bốn chỗ EF
/// không làm được và phải viết tay:
/// upsert (<c>ON CONFLICT</c>), khoá dòng (<c>FOR UPDATE</c>), cập nhật số dư
/// bằng biểu thức, và đối soát tổng sổ cái.
/// </summary>
public class WalletRepository(AppDbContext db) : IWalletRepository
{
    public async Task<DomainWallet> GetForUpdateAsync(Guid userId, CancellationToken ct = default)
    {
        // Tạo ví nếu chưa có. ON CONFLICT thay vì "kiểm tra rồi thêm": hai request
        // đầu tiên của cùng một KTV sẽ cùng thấy chưa có ví và cùng ghi.
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO wallets (user_id) VALUES ({userId}) ON CONFLICT (user_id) DO NOTHING", ct);

        // FirstOrDefaultAsync KHÔNG khoá dòng — phải FOR UPDATE tường minh, nếu
        // không hai request song song cùng đọc số dư cũ rồi cùng tiêu từ nó.
        var row = await db.Wallets
            .FromSqlInterpolated($"SELECT * FROM wallets WHERE user_id = {userId} FOR UPDATE")
            .AsNoTracking()
            .FirstAsync(ct);

        return Map(row);
    }

    public async Task<DomainWallet?> FindAsync(Guid userId, CancellationToken ct = default)
    {
        var row = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.UserId == userId, ct);
        return row is null ? null : Map(row);
    }

    public async Task<DomainWallet?> FindByIdAsync(Guid walletId, CancellationToken ct = default)
    {
        var row = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(w => w.Id == walletId, ct);
        return row is null ? null : Map(row);
    }

    public async Task<bool> TryAppendAsync(
        DomainWallet wallet, LedgerEntry entry, CancellationToken ct = default)
    {
        // EF không sinh được ON CONFLICT nên bút toán phải viết raw SQL, và phải
        // kiểm tra số dòng ảnh hưởng. Dùng AnyAsync rồi Add sẽ để hở đúng cái khe
        // mà khoá chống lặp sinh ra để bịt.
        var inserted = await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO wallet_transactions
                (wallet_id, type, amount, balance_after, idempotency_key, campaign_id)
            VALUES ({wallet.Id}, {entry.Type}, {entry.Amount}, {entry.BalanceAfter.Amount},
                    {entry.IdempotencyKey}, {entry.CampaignId})
            ON CONFLICT (idempotency_key) DO NOTHING
            """, ct);

        if (inserted == 0)
        {
            // Khoá đã tồn tại: bút toán này đã ghi ở lần gọi trước. Không đụng vào
            // số dư nữa và báo cho người gọi biết để họ trả về thành công.
            return false;
        }

        await PersistAmountsAsync(wallet, ct);
        return true;
    }

    public async Task PersistAmountsAsync(DomainWallet wallet, CancellationToken ct = default)
    {
        var updated = await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE wallets
            SET balance = {wallet.Balance.Amount},
                held = {wallet.Held.Amount},
                version = version + 1,
                updated_at = now()
            WHERE id = {wallet.Id} AND version = {wallet.Version}
            """, ct);

        if (updated == 0)
        {
            // Dòng đã được ghi bởi một transaction khác từ lúc ta đọc. Với FOR UPDATE
            // thì không xảy ra, nhưng kiểm tra ở đây để nếu ai đó bỏ khoá dòng trong
            // tương lai, lỗi nổ ra ngay thay vì âm thầm ghi đè số dư.
            throw new WalletConcurrencyException(wallet.Id);
        }

        wallet.MarkPersisted();
    }

    public async Task AddHoldAsync(WalletHold hold, CancellationToken ct = default)
    {
        db.WalletHolds.Add(new WalletHoldRow
        {
            Id = hold.Id,
            WalletId = hold.WalletId,
            Amount = hold.Amount.Amount,
            Status = hold.Status,
            ExpiresAt = hold.ExpiresAt.ToUniversalTime(),
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateHoldAsync(WalletHold hold, CancellationToken ct = default) =>
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            UPDATE wallet_holds SET status = {hold.Status}, updated_at = now()
            WHERE id = {hold.Id}
            """, ct);

    public async Task<WalletHold?> FindHoldAsync(Guid holdId, CancellationToken ct = default)
    {
        var row = await db.WalletHolds.AsNoTracking().FirstOrDefaultAsync(h => h.Id == holdId, ct);
        return row is null ? null : MapHold(row);
    }

    public async Task<IReadOnlyList<WalletHold>> ListExpiredHoldsAsync(
        DateTimeOffset now, int limit, CancellationToken ct = default)
    {
        var rows = await db.WalletHolds.AsNoTracking()
            .Where(h => h.Status == HoldStatuses.Active && h.ExpiresAt <= now.ToUniversalTime())
            .OrderBy(h => h.ExpiresAt)
            .Take(limit)
            .ToListAsync(ct);

        return rows.Select(MapHold).ToList();
    }

    public async Task<Guid?> FindCampaignByIdempotencyKeyAsync(
        string key, CancellationToken ct = default) =>
        await db.WalletTransactions.AsNoTracking()
            .Where(t => t.IdempotencyKey == key)
            .Select(t => t.CampaignId)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<WalletDrift>> FindDriftAsync(CancellationToken ct = default)
    {
        // Bất biến của toàn bộ vùng chạm tiền: tổng có dấu của sổ cái phải bằng số
        // dư đang lưu. Lệch một đồng cũng phải hiện ra chứ không làm tròn cho qua.
        var rows = await db.Database.SqlQueryRaw<DriftRow>("""
            SELECT w.id AS "WalletId",
                   COALESCE(SUM(t.amount), 0)::numeric AS "LedgerSum",
                   w.balance AS "StoredBalance"
            FROM wallets w
            LEFT JOIN wallet_transactions t ON t.wallet_id = w.id
            GROUP BY w.id, w.balance
            HAVING COALESCE(SUM(t.amount), 0) <> w.balance
            """).ToListAsync(ct);

        return rows.Select(r => new WalletDrift(r.WalletId, r.LedgerSum, r.StoredBalance)).ToList();
    }

    private static DomainWallet Map(WalletRow row) =>
        new(row.Id, row.UserId, Money.Of(row.Balance), Money.Of(row.Held), row.Version);

    private static WalletHold MapHold(WalletHoldRow row) =>
        new(row.Id, row.WalletId, Money.Of(row.Amount), row.ExpiresAt, row.Status);

    private class DriftRow
    {
        public Guid WalletId { get; set; }
        public decimal LedgerSum { get; set; }
        public decimal StoredBalance { get; set; }
    }
}

public sealed class WalletConcurrencyException(Guid walletId)
    : Exception($"Ví {walletId} đã bị sửa bởi một giao dịch khác");
