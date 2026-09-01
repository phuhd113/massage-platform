namespace Massage.Wallet.Domain.Ports;

/// <summary>
/// Cổng ra tầng lưu trữ. Chỉ nói bằng ngôn ngữ domain — không có DbContext, không
/// có SQL, không có kiểu nào của EF lọt qua đây.
/// </summary>
public interface IWalletRepository
{
    /// <summary>
    /// Đọc ví và <b>khoá dòng</b> tới hết transaction (<c>SELECT … FOR UPDATE</c>),
    /// tạo mới nếu KTV chưa có ví.
    ///
    /// Phải là khoá thật ở tầng DB. Đọc thường rồi ghi lại chỉ cho optimistic
    /// concurrency, mà lúc đó xung đột sẽ trôi qua im lặng nếu không ai bắt
    /// exception tương ứng.
    /// </summary>
    Task<Wallet> GetForUpdateAsync(Guid userId, CancellationToken ct = default);

    Task<Wallet?> FindAsync(Guid userId, CancellationToken ct = default);

    Task<Wallet?> FindByIdAsync(Guid walletId, CancellationToken ct = default);

    /// <summary>
    /// Ghi bút toán kèm cập nhật số dư, chống lặp bằng
    /// <c>ON CONFLICT (idempotency_key) DO NOTHING</c>.
    /// </summary>
    /// <returns>
    /// <c>false</c> khi khoá đã tồn tại — nghĩa là bút toán này đã được ghi trước
    /// đó. Người gọi phải coi đây là <b>thành công</b>: cổng thanh toán cần 200 để
    /// ngừng retry, và client double-click không đáng bị báo lỗi.
    /// </returns>
    Task<bool> TryAppendAsync(Wallet wallet, LedgerEntry entry, CancellationToken ct = default);

    /// <summary>
    /// Ghi lại <c>balance</c>/<c>held</c> khi thao tác không sinh bút toán — giữ và
    /// nhả tiền chỉ đổi phần bị giữ.
    ///
    /// Không dùng cho thao tác có bút toán: ở đó số dư và bút toán phải ghi cùng
    /// nhau trong <see cref="TryAppendAsync"/>, nếu tách ra sẽ có lúc số dư đã đổi
    /// mà sổ chưa ghi.
    /// </summary>
    Task PersistAmountsAsync(Wallet wallet, CancellationToken ct = default);

    Task AddHoldAsync(WalletHold hold, CancellationToken ct = default);

    Task UpdateHoldAsync(WalletHold hold, CancellationToken ct = default);

    Task<WalletHold?> FindHoldAsync(Guid holdId, CancellationToken ct = default);

    /// <summary>Hold quá hạn còn ACTIVE — đầu vào của tác vụ dọn dẹp.</summary>
    Task<IReadOnlyList<WalletHold>> ListExpiredHoldsAsync(
        DateTimeOffset now, int limit, CancellationToken ct = default);

    /// <summary>
    /// Campaign đã tạo bởi đúng khoá chống lặp này, nếu có. Dùng để trả lại kết
    /// quả cũ cho một request lặp thay vì tạo campaign thứ hai.
    /// </summary>
    Task<Guid?> FindCampaignByIdempotencyKeyAsync(string key, CancellationToken ct = default);

    /// <summary>Đối soát: tổng bút toán so với số dư đang lưu, theo từng ví lệch.</summary>
    Task<IReadOnlyList<WalletDrift>> FindDriftAsync(CancellationToken ct = default);
}

/// <param name="LedgerSum">Tổng có dấu của mọi bút toán.</param>
/// <param name="StoredBalance">Số dư đang lưu ở bảng ví.</param>
public sealed record WalletDrift(Guid WalletId, decimal LedgerSum, decimal StoredBalance)
{
    public decimal Difference => StoredBalance - LedgerSum;
}
