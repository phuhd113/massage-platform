using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Massage.Api.Modules.Auth;

public record AuthUserDto(Guid Id, string Phone, string Role);
public record AuthTokensDto(string AccessToken, AuthUserDto User);

public class AuthService(AppDbContext db, IOtpService otp, IOptions<JwtOptions> jwtOptions)
{
    private readonly JwtOptions _jwt = jwtOptions.Value;

    /// <summary>Đưa mọi biến thể số VN về dạng 0xxxxxxxxx để một người chỉ có một tài khoản.</summary>
    public static string NormalizePhone(string raw) =>
        raw.StartsWith("+84", StringComparison.Ordinal) ? "0" + raw[3..] : raw;

    public async Task<(string Phone, DateTimeOffset ExpiresAt, string? DebugCode)> RequestOtpAsync(
        string rawPhone, string purpose, CancellationToken ct = default)
    {
        var phone = NormalizePhone(rawPhone);
        var result = await otp.IssueAsync(phone, purpose, ct);
        return (phone, result.ExpiresAt, result.DebugCode);
    }

    public async Task<AuthTokensDto> VerifyOtpAndIssueTokenAsync(
        string rawPhone, string code, string purpose, string role, CancellationToken ct = default)
    {
        var phone = NormalizePhone(rawPhone);
        var verification = await otp.VerifyAsync(phone, purpose, code, ct);

        if (!verification.Ok)
        {
            // Không tiết lộ chi tiết vì sao sai (không tồn tại / sai mã) để tránh dò xem
            // số nào đã đăng ký; chỉ tách riêng trường hợp bị khoá do thử quá nhiều.
            throw verification.Reason == OtpFailure.TooManyAttempts
                ? new TooManyAttemptsException("Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu mã mới.")
                : new InvalidOtpException("Mã OTP không đúng hoặc đã hết hạn");
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Phone == phone, ct);
        if (user is null)
        {
            user = new User { Phone = phone, Role = role, PhoneVerifiedAt = DateTimeOffset.UtcNow };
            db.Users.Add(user);
            await db.SaveChangesAsync(ct);
        }
        else if (user.PhoneVerifiedAt is null)
        {
            user.PhoneVerifiedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        return new AuthTokensDto(CreateToken(user), new AuthUserDto(user.Id, user.Phone, user.Role));
    }

    public Task<User?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    private string CreateToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Secret));
        var token = new JwtSecurityToken(
            issuer: _jwt.Issuer,
            audience: _jwt.Audience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim("phone", user.Phone),
                new Claim(ClaimTypes.Role, user.Role),
            ],
            expires: DateTime.UtcNow.AddDays(_jwt.ExpiresDays),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public class InvalidOtpException(string message) : Exception(message);
public class TooManyAttemptsException(string message) : Exception(message);
