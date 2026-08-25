using System.Security.Cryptography;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Massage.Api.Modules.Auth;

public record OtpIssueResult(DateTimeOffset ExpiresAt, string? DebugCode);

public enum OtpFailure { NotFound, Expired, TooManyAttempts, Mismatch }

public record OtpVerifyResult(bool Ok, OtpFailure? Reason = null)
{
    public static readonly OtpVerifyResult Success = new(true);
    public static OtpVerifyResult Fail(OtpFailure reason) => new(false, reason);
}

public interface IOtpService
{
    Task<OtpIssueResult> IssueAsync(string phone, string purpose, CancellationToken ct = default);
    Task<OtpVerifyResult> VerifyAsync(string phone, string purpose, string code, CancellationToken ct = default);
}

public class OtpService(AppDbContext db, IOptions<OtpOptions> options, ILogger<OtpService> logger) : IOtpService
{
    private readonly OtpOptions _options = options.Value;

    public async Task<OtpIssueResult> IssueAsync(string phone, string purpose, CancellationToken ct = default)
    {
        // Vô hiệu hoá mã cũ chưa dùng: mỗi số chỉ có đúng một mã sống tại một thời
        // điểm, nếu không kẻ tấn công có nhiều mã hợp lệ để thử song song.
        await db.OtpCodes
            .Where(o => o.Phone == phone && o.Purpose == purpose && o.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.ConsumedAt, DateTimeOffset.UtcNow), ct);

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var expiresAt = DateTimeOffset.UtcNow.AddSeconds(_options.TtlSeconds);

        db.OtpCodes.Add(new OtpCode
        {
            Phone = phone,
            Purpose = purpose,
            CodeHash = BCrypt.Net.BCrypt.HashPassword(code, workFactor: 8),
            ExpiresAt = expiresAt,
        });
        await db.SaveChangesAsync(ct);

        if (_options.StubEnabled)
        {
            logger.LogWarning("[OTP STUB] {Phone} ({Purpose}) -> {Code}", phone, purpose, code);
            return new OtpIssueResult(expiresAt, code);
        }

        // Khi cắm nhà cung cấp SMS thật, thay chỗ này bằng lời gọi adapter.
        // Giữ nguyên chữ ký hàm để phần còn lại của luồng đăng ký không phải sửa.
        throw new InvalidOperationException(
            "Chưa cấu hình nhà cung cấp SMS. Đặt Otp:StubEnabled=true cho môi trường dev.");
    }

    public async Task<OtpVerifyResult> VerifyAsync(string phone, string purpose, string code, CancellationToken ct = default)
    {
        var record = await db.OtpCodes
            .Where(o => o.Phone == phone && o.Purpose == purpose && o.ConsumedAt == null)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (record is null) return OtpVerifyResult.Fail(OtpFailure.NotFound);
        if (record.ExpiresAt <= DateTimeOffset.UtcNow) return OtpVerifyResult.Fail(OtpFailure.Expired);
        if (record.Attempts >= _options.MaxAttempts) return OtpVerifyResult.Fail(OtpFailure.TooManyAttempts);

        if (!BCrypt.Net.BCrypt.Verify(code, record.CodeHash))
        {
            record.Attempts++;
            await db.SaveChangesAsync(ct);
            return OtpVerifyResult.Fail(OtpFailure.Mismatch);
        }

        // Đánh dấu đã dùng ngay khi khớp — một mã chỉ đổi được một lần thành phiên đăng nhập.
        record.ConsumedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
        return OtpVerifyResult.Success;
    }
}
