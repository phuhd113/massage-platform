namespace Massage.Api.Common;

public class JwtOptions
{
    public const string Section = "Jwt";
    public string Secret { get; set; } = "";
    public string Issuer { get; set; } = "massage-platform";
    public string Audience { get; set; } = "massage-platform";
    public int ExpiresDays { get; set; } = 7;
}

public class OtpOptions
{
    public const string Section = "Otp";

    /// <summary>
    /// Khi bật, mã OTP được ghi log và trả trong response thay vì gửi SMS thật.
    /// Phải tắt ở production — lúc đó OtpService sẽ báo lỗi rõ ràng nếu chưa cắm
    /// adapter SMS, thay vì âm thầm không gửi gì.
    /// </summary>
    public bool StubEnabled { get; set; } = true;

    public int TtlSeconds { get; set; } = 300;
    public int MaxAttempts { get; set; } = 5;
}

public class UploadOptions
{
    public const string Section = "Upload";
    public string Dir { get; set; } = "uploads";
    public int MaxSizeMb { get; set; } = 5;
}
