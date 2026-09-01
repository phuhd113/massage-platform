namespace Massage.Wallet.Domain;

/// <summary>
/// Số tiền VND. Không âm, không có phần lẻ.
///
/// Bọc <c>decimal</c> vào một kiểu riêng thay vì truyền decimal trần để không thể
/// cộng nhầm số tiền với một con số khác kiểu (điểm boost, số ngày, chỉ số slot) —
/// ở vùng code này một phép cộng nhầm không báo lỗi mà thành lệch sổ.
///
/// Luôn là <c>decimal</c>, không bao giờ <c>double</c>: sai số dấu phẩy động làm
/// đối soát ví lệch dần và không có cách nào truy ngược.
/// </summary>
public readonly record struct Money : IComparable<Money>
{
    public decimal Amount { get; }

    private Money(decimal amount) => Amount = amount;

    public static readonly Money Zero = new(0m);

    public static Money Of(decimal amount)
    {
        if (amount < 0)
            throw new InvalidAmountException($"Số tiền không được âm: {amount}");
        if (amount != decimal.Truncate(amount))
            throw new InvalidAmountException($"VND không có phần lẻ: {amount}");

        return new Money(amount);
    }

    /// <summary>Dùng cho số tiền phải lớn hơn 0 (nạp, mua gói) — 0 đồng là lỗi gọi hàm, không phải giao dịch hợp lệ.</summary>
    public static Money Positive(decimal amount)
    {
        var money = Of(amount);
        if (money.Amount == 0)
            throw new InvalidAmountException("Số tiền phải lớn hơn 0");

        return money;
    }

    public bool IsZero => Amount == 0;

    public static Money operator +(Money a, Money b) => new(a.Amount + b.Amount);

    /// <summary>Trừ ra số âm là lỗi lập trình, không phải số dư âm hợp lệ — ném ngay tại chỗ.</summary>
    public static Money operator -(Money a, Money b) =>
        a.Amount >= b.Amount
            ? new Money(a.Amount - b.Amount)
            : throw new InvalidAmountException($"Phép trừ ra số âm: {a.Amount} - {b.Amount}");

    public static bool operator <(Money a, Money b) => a.Amount < b.Amount;
    public static bool operator >(Money a, Money b) => a.Amount > b.Amount;
    public static bool operator <=(Money a, Money b) => a.Amount <= b.Amount;
    public static bool operator >=(Money a, Money b) => a.Amount >= b.Amount;

    public int CompareTo(Money other) => Amount.CompareTo(other.Amount);

    public override string ToString() => $"{Amount:N0}đ";
}
