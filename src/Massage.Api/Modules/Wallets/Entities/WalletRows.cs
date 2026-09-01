namespace Massage.Api.Modules.Wallets.Entities;

/// <summary>
/// Model lưu trữ của ví.
///
/// Cố ý tách khỏi <see cref="Massage.Wallet.Domain.Wallet"/> và mang hậu tố
/// <c>Row</c>: domain không được tham chiếu EF, nên nó không thể là entity mà EF
/// materialize. Repository dịch qua lại giữa hai bên. Hậu tố tránh phải alias
/// <c>using</c> ở mọi file có mặt cả hai kiểu — và tránh sửa nhầm kiểu này khi
/// định sửa kiểu kia.
/// </summary>
public class WalletRow
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    /// <summary>Tổng tiền sở hữu, đã bao gồm phần đang bị giữ.</summary>
    public decimal Balance { get; set; }

    /// <summary>Phần đang bị giữ cho lần mua chưa chốt. Khả dụng = Balance − Held.</summary>
    public decimal Held { get; set; }

    /// <summary>Concurrency token, tăng mỗi lần ghi.</summary>
    public int Version { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class WalletTransactionRow
{
    public Guid Id { get; set; }
    public Guid WalletId { get; set; }
    public string Type { get; set; } = null!;

    /// <summary>Có dấu: dương là tiền vào, âm là tiền ra.</summary>
    public decimal Amount { get; set; }

    public decimal BalanceAfter { get; set; }

    /// <summary>UNIQUE. Trọng tài cuối cùng chống ghi trùng, do bên ngoài truyền vào.</summary>
    public string IdempotencyKey { get; set; } = null!;

    public Guid? CampaignId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class WalletHoldRow
{
    public Guid Id { get; set; }
    public Guid WalletId { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = null!;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
/// Một phiên nạp tiền đã mở với cổng thanh toán.
///
/// Tồn tại để đối chất khi có tranh chấp: khi KTV báo "đã chuyển tiền mà chưa
/// thấy vào ví", cần biết phiên nào đã mở, số tiền bao nhiêu, và cổng đã gọi lại
/// hay chưa — không thể suy ra từ bảng bút toán vì bút toán chỉ tồn tại khi tiền
/// đã vào.
/// </summary>
public class PaymentIntentRow
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public decimal Amount { get; set; }
    public string Provider { get; set; } = null!;

    /// <summary>Mã tham chiếu gửi sang cổng; cũng là thứ cổng trả lại trong IPN.</summary>
    public string ProviderRef { get; set; } = null!;

    /// <summary>Mã giao dịch do cổng sinh, chỉ có sau khi thanh toán xong.</summary>
    public string? ProviderTxnId { get; set; }

    public string Status { get; set; } = null!;
    public string? RawCallback { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public static class PaymentIntentStatuses
{
    public const string Pending = "PENDING";
    public const string Succeeded = "SUCCEEDED";
    public const string Failed = "FAILED";
}
