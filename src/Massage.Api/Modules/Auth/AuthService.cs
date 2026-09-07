using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Npgsql;

namespace Massage.Api.Modules.Auth;

public record AuthUserDto(Guid Id, string Phone, string Role);
public record AuthTokensDto(string AccessToken, AuthUserDto User);

public class AuthService(AppDbContext db, IOtpService otp, IOptions<JwtOptions> jwtOptions)
{
    private readonly JwtOptions _jwt = jwtOptions.Value;

    /// <summary>Số lần gõ sai liên tiếp trước khi khoá tạm.</summary>
    public const int MaxFailedLogins = 5;

    /// <summary>
    /// Đủ dài để một kịch bản dò tự động trở nên vô nghĩa, đủ ngắn để người thật quên
    /// mật khẩu không phải chờ tới hôm sau — và khi chưa có "quên mật khẩu" thì khoá
    /// vĩnh viễn nghĩa là phải nhờ admin can thiệp bằng SQL.
    /// </summary>
    public static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

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

    /// <summary>Tạo tài khoản mới bằng số điện thoại + mật khẩu, và cấp token luôn.</summary>
    /// <remarks>
    /// Số điện thoại **không** được xác thực ở đây: chưa có kênh gửi mã nào chạy thật,
    /// nên <c>PhoneVerifiedAt</c> để NULL — đúng sự thật thay vì đánh dấu đã xác thực
    /// một thứ chưa ai kiểm. Chốt chặn thật với KTV vẫn nằm ở đường duyệt hồ sơ + CCCD.
    /// </remarks>
    public async Task<AuthTokensDto> RegisterWithPasswordAsync(
        string rawPhone, string password, string role, CancellationToken ct = default)
    {
        var phone = NormalizePhone(rawPhone);

        // Từ chối kể cả khi tài khoản cũ chưa đặt mật khẩu (tài khoản tạo bằng OTP).
        // Cho "đăng ký" ghi đè lên nó là biến trang đăng ký thành đường chiếm tài
        // khoản người khác chỉ bằng việc biết số điện thoại của họ. Người ở tình
        // huống đó đặt mật khẩu qua PATCH /auth/password sau khi đã đăng nhập.
        if (await db.Users.AnyAsync(u => u.Phone == phone, ct))
        {
            throw new ConflictException("Số điện thoại này đã có tài khoản. Vui lòng đăng nhập.");
        }

        var user = new User
        {
            Phone = phone,
            Role = role,
            PasswordHash = PasswordHasher.Hash(password),
        };

        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Hai lượt đăng ký cùng số chạy song song: cả hai qua được kiểm tra ở
            // trên rồi UNIQUE(phone) chặn một trong hai. Trọng tài là ràng buộc DB,
            // kiểm tra phía trên chỉ để có thông báo lỗi tử tế trong trường hợp thường.
            db.ChangeTracker.Clear();
            throw new ConflictException("Số điện thoại này đã có tài khoản. Vui lòng đăng nhập.");
        }

        return new AuthTokensDto(CreateToken(user), new AuthUserDto(user.Id, user.Phone, user.Role));
    }

    /// <summary>Đăng nhập bằng số điện thoại + mật khẩu.</summary>
    public async Task<AuthTokensDto> LoginWithPasswordAsync(
        string rawPhone, string password, CancellationToken ct = default)
    {
        var phone = NormalizePhone(rawPhone);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Phone == phone, ct);
        var now = DateTimeOffset.UtcNow;

        if (user is not null && user.LockedUntil > now)
        {
            // Không kiểm mật khẩu khi đang khoá: kiểm rồi vẫn từ chối chỉ tạo thêm
            // một kênh đo xem mật khẩu nào đúng qua thời gian phản hồi.
            throw new TooManyAttemptsException(
                "Tài khoản tạm khoá do nhập sai nhiều lần. Vui lòng thử lại sau ít phút.");
        }

        // Luôn chạy một lượt Verify, kể cả khi không có tài khoản hoặc tài khoản chưa
        // đặt mật khẩu. BCrypt cố ý chậm (~50-100ms), nên thoát sớm sẽ khiến số chưa
        // đăng ký trả lời nhanh hơn hẳn — tức là dò được số nào có tài khoản chỉ bằng
        // đồng hồ bấm giờ, đúng thứ mà việc trả cùng một message đang cố tránh.
        var ok = PasswordHasher.Verify(password, user?.PasswordHash);

        if (!ok)
        {
            if (user is not null) await RecordFailedLoginAsync(user, now, ct);

            // Cùng một câu cho mọi nguyên nhân (số không tồn tại / chưa đặt mật khẩu /
            // sai mật khẩu) — cùng lý do đã ghi ở nhánh OTP bên trên.
            throw new InvalidLoginException("Số điện thoại hoặc mật khẩu không đúng");
        }

        if (user!.FailedLoginAttempts != 0 || user.LockedUntil is not null)
        {
            user.FailedLoginAttempts = 0;
            user.LockedUntil = null;
            await db.SaveChangesAsync(ct);
        }

        return new AuthTokensDto(CreateToken(user), new AuthUserDto(user.Id, user.Phone, user.Role));
    }

    /// <summary>Đặt hoặc đổi mật khẩu cho tài khoản đang đăng nhập.</summary>
    /// <remarks>
    /// Đây cũng là đường duy nhất để tài khoản tạo bằng OTP (chưa có mật khẩu) đặt
    /// được một cái — và, khi chưa có "quên mật khẩu", là đường duy nhất đổi mật khẩu.
    /// </remarks>
    public async Task SetPasswordAsync(
        Guid userId, string? currentPassword, string newPassword, CancellationToken ct = default)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new NotFoundException("Không tìm thấy tài khoản");

        // Tài khoản đã có mật khẩu thì phải chứng minh mình biết nó. Bỏ bước này là
        // biến một phiên bị chiếm (máy để quên, token rò) thành mất tài khoản vĩnh viễn.
        if (user.PasswordHash is not null && !PasswordHasher.Verify(currentPassword ?? "", user.PasswordHash))
        {
            throw new InvalidLoginException("Mật khẩu hiện tại không đúng");
        }

        user.PasswordHash = PasswordHasher.Hash(newPassword);
        user.FailedLoginAttempts = 0;
        user.LockedUntil = null;
        user.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private async Task RecordFailedLoginAsync(User user, DateTimeOffset now, CancellationToken ct)
    {
        user.FailedLoginAttempts++;

        if (user.FailedLoginAttempts >= MaxFailedLogins)
        {
            user.LockedUntil = now.Add(LockoutDuration);
            // Reset ngay để hết hạn khoá là được thử lại đủ MaxFailedLogins lần nữa,
            // thay vì mỗi lần sai tiếp theo lại khoá thêm một lượt.
            user.FailedLoginAttempts = 0;
        }

        await db.SaveChangesAsync(ct);
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
public class InvalidLoginException(string message) : Exception(message);

/// <summary>
/// Băm mật khẩu. Một chỗ duy nhất giữ work factor để nó không bị rải ra controller
/// rồi lệch nhau giữa đường đăng ký và đường đổi mật khẩu.
/// </summary>
public static class PasswordHasher
{
    /// <summary>
    /// Cao hơn hẳn work factor 8 của OTP, và cố ý: mã OTP là bí mật 6 chữ số sống 5
    /// phút, còn mật khẩu nằm trong DB nhiều năm và thường được dùng lại ở nơi khác.
    /// 11 là khoảng ~100ms trên phần cứng hiện tại — đủ đắt để dò offline mất giá,
    /// đủ rẻ để không thành đường DoS cho chính mình.
    /// </summary>
    private const int WorkFactor = 11;

    /// <summary>
    /// Hash của một chuỗi không ai biết, dùng cho nhánh "không có tài khoản" để lượt
    /// verify vẫn tốn đúng chừng ấy thời gian.
    /// </summary>
    private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword(
        "khong-bao-gio-khop-" + Guid.NewGuid(), WorkFactor);

    public static string Hash(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);

    /// <summary>
    /// <paramref name="hash"/> null (tài khoản chưa đặt mật khẩu, hoặc không có tài
    /// khoản) vẫn chạy một lượt băm thật rồi trả false — xem chú thích ở
    /// <see cref="AuthService.LoginWithPasswordAsync"/>.
    /// </summary>
    public static bool Verify(string password, string? hash)
    {
        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash ?? DummyHash) && hash is not null;
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // Hash hỏng trong DB (sửa tay, migrate lỗi) là từ chối đăng nhập, không
            // phải 500 — và không bao giờ là cho qua.
            return false;
        }
    }
}
