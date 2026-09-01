namespace Massage.Wallet.Domain.Ports;

/// <summary>
/// Đồng hồ được tiêm vào thay vì gọi thẳng <c>DateTimeOffset.UtcNow</c>, để test
/// hạn hold và hạn campaign không phải chờ thời gian thật trôi qua.
/// </summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

/// <summary>
/// Ranh giới transaction. Việc kiểm tra slot còn trống và việc chiếm slot phải nằm
/// trong <b>cùng một</b> transaction — tách ra thì giữa hai bước sẽ có người khác
/// chen vào.
/// </summary>
public interface IWalletUnitOfWork
{
    Task<IWalletTransaction> BeginAsync(CancellationToken ct = default);
}

public interface IWalletTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken ct = default);
    Task RollbackAsync(CancellationToken ct = default);
}
