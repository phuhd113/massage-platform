namespace Massage.Api.Modules.Auth.Entities;

public static class UserRoles
{
    public const string Customer = "CUSTOMER";
    public const string Ktv = "KTV";
    public const string Admin = "ADMIN";
}

public class User
{
    public Guid Id { get; set; }
    public string Phone { get; set; } = null!;
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public string Role { get; set; } = UserRoles.Customer;
    public DateTimeOffset? PhoneVerifiedAt { get; set; }

    /// <summary>
    /// Số lần gõ sai mật khẩu liên tiếp, reset về 0 sau mỗi lần đăng nhập thành công.
    ///
    /// Đường OTP tự có trần thử riêng cho từng mã (<c>OtpCode.Attempts</c>), nhưng
    /// mật khẩu thì không có gì tương đương — thiếu hai cột này thì <c>/auth/login</c>
    /// là một endpoint dò mật khẩu không giới hạn.
    /// </summary>
    public int FailedLoginAttempts { get; set; }

    /// <summary>Khoá tới thời điểm này; NULL nghĩa là không bị khoá.</summary>
    public DateTimeOffset? LockedUntil { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
