namespace Massage.Api.Modules.Auth.Entities;

public static class OtpPurposes
{
    public const string Register = "REGISTER";
    public const string Login = "LOGIN";
}

public class OtpCode
{
    public Guid Id { get; set; }
    public string Phone { get; set; } = null!;

    /// <summary>
    /// Lưu hash thay vì mã trần: nếu DB bị lộ, mã còn hiệu lực không dùng lại
    /// được để chiếm tài khoản.
    /// </summary>
    public string CodeHash { get; set; } = null!;

    public string Purpose { get; set; } = OtpPurposes.Register;
    public short Attempts { get; set; }
    public DateTimeOffset? ConsumedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
