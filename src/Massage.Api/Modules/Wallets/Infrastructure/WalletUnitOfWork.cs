using Massage.Api.Data;
using Massage.Wallet.Domain.Ports;
using Microsoft.EntityFrameworkCore.Storage;

namespace Massage.Api.Modules.Wallets.Infrastructure;

public class WalletUnitOfWork(AppDbContext db) : IWalletUnitOfWork
{
    public async Task<IWalletTransaction> BeginAsync(CancellationToken ct = default) =>
        new EfWalletTransaction(await db.Database.BeginTransactionAsync(ct));
}

/// <summary>
/// Bọc transaction của EF lại sau cổng domain.
///
/// <c>DisposeAsync</c> rollback nếu chưa commit: mọi nhánh thoát sớm — hết slot,
/// unique violation, exception bất kỳ — đều nhả hold vì hold nằm trong chính
/// transaction này. Đó là lý do luồng mua gói không cần khối <c>catch</c> riêng
/// để hoàn tác thủ công, và cũng là lý do không được đưa thao tác nào ra ngoài
/// transaction rồi tin rằng nó sẽ tự dọn.
/// </summary>
internal sealed class EfWalletTransaction(IDbContextTransaction inner) : IWalletTransaction
{
    private bool _completed;

    public async Task CommitAsync(CancellationToken ct = default)
    {
        await inner.CommitAsync(ct);
        _completed = true;
    }

    public async Task RollbackAsync(CancellationToken ct = default)
    {
        await inner.RollbackAsync(ct);
        _completed = true;
    }

    public async ValueTask DisposeAsync()
    {
        if (!_completed)
        {
            await inner.RollbackAsync();
        }
        await inner.DisposeAsync();
    }
}

public class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
