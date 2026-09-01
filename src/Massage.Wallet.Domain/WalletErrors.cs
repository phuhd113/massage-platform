namespace Massage.Wallet.Domain;

/// <summary>Lỗi nghiệp vụ của ví. Tầng API ánh xạ sang mã HTTP, domain không biết gì về HTTP.</summary>
public abstract class WalletDomainException(string message) : Exception(message);

public sealed class InvalidAmountException(string message) : WalletDomainException(message);

public sealed class InsufficientBalanceException(Money available, Money requested)
    : WalletDomainException($"Số dư khả dụng {available} không đủ cho {requested}")
{
    public Money Available { get; } = available;
    public Money Requested { get; } = requested;
}

/// <summary>
/// Hold đã hết hạn hoặc đã được xử lý. Capture một hold không còn ACTIVE sẽ trừ
/// tiền lần thứ hai cho cùng một lần mua, nên đây phải là lỗi chứ không phải
/// no-op im lặng.
/// </summary>
public sealed class HoldNotActiveException(Guid holdId, string status)
    : WalletDomainException($"Hold {holdId} không ở trạng thái ACTIVE (hiện tại: {status})");
