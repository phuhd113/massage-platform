namespace Massage.Wallet.Domain;

public static class HoldStatuses
{
    public const string Active = "ACTIVE";
    public const string Captured = "CAPTURED";
    public const string Released = "RELEASED";
    public const string Expired = "EXPIRED";
}

/// <summary>
/// Tiền đã được giữ nhưng chưa trừ.
///
/// <c>ExpiresAt</c> là bắt buộc chứ không phải tuỳ chọn: nếu process chết giữa
/// luồng mua, tiền của KTV không được treo vĩnh viễn. Ở Phase 2 luồng mua nằm gọn
/// trong một transaction nên rollback tự dọn; hold có hạn là để chuẩn bị cho
/// Phase 3, khi việc chiếm slot đi qua Redis và luồng kéo dài hơn một transaction.
/// </summary>
public sealed class WalletHold
{
    public Guid Id { get; }
    public Guid WalletId { get; }
    public Money Amount { get; }
    public DateTimeOffset ExpiresAt { get; }
    public string Status { get; private set; }

    public WalletHold(Guid id, Guid walletId, Money amount, DateTimeOffset expiresAt, string status)
    {
        Id = id;
        WalletId = walletId;
        Amount = amount;
        ExpiresAt = expiresAt;
        Status = status;
    }

    public bool IsActive => Status == HoldStatuses.Active;

    public bool HasExpired(DateTimeOffset now) => now >= ExpiresAt;

    internal void MarkCaptured() => Status = HoldStatuses.Captured;
    internal void MarkReleased() => Status = HoldStatuses.Released;
    internal void MarkExpired() => Status = HoldStatuses.Expired;
}
