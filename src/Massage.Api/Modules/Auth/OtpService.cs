using System.Security.Cryptography;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Auth.Sms;
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

public class OtpService(
    AppDbContext db,
    IOtpSender sender,
    IOptions<OtpOptions> options,
    ILogger<OtpService> logger) : IOtpService
{
    private readonly OtpOptions _options = options.Value;

    public async Task<OtpIssueResult> IssueAsync(string phone, string purpose, CancellationToken ct = default)
    {
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var expiresAt = DateTimeOffset.UtcNow.AddSeconds(_options.TtlSeconds);

        // Gửi **trước** khi đụng vào DB. Thứ tự này quan trọng và ngược với bản đầu:
        // vô hiệu hoá mã cũ rồi mới phát hiện không gửi được nghĩa là người dùng vừa
        // mất mã đang cầm trên tay để đổi lấy một mã không bao giờ tới. Với người bấm
        // "gửi lại" vì tin đến chậm, đó là biến một phiền toái thành hỏng hẳn.
        //
        // Đánh đổi: gửi thành công mà lưu DB thất bại thì mã tới nơi nhưng không xác
        // thực được. Hiếm hơn nhiều và người dùng chỉ cần bấm gửi lại — trong khi chiều
        // ngược lại đẩy họ vào trạng thái không có mã nào dùng được.
        await sender.SendAsync(phone, code, _options.TtlSeconds, ct);

        // Vô hiệu hoá mã cũ chưa dùng: mỗi số chỉ có đúng một mã sống tại một thời
        // điểm, nếu không kẻ tấn công có nhiều mã hợp lệ để thử song song.
        await db.OtpCodes
            .Where(o => o.Phone == phone && o.Purpose == purpose && o.ConsumedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.ConsumedAt, DateTimeOffset.UtcNow), ct);

        db.OtpCodes.Add(new OtpCode
        {
            Phone = phone,
            Purpose = purpose,
            CodeHash = BCrypt.Net.BCrypt.HashPassword(code, workFactor: 8),
            ExpiresAt = expiresAt,
        });
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Đã phát hành OTP qua {Channel} cho mục đích {Purpose}", sender.Channel, purpose);

        // Mã chỉ ra khỏi server khi chính adapter khai là nó làm vậy. Trước đây điều này
        // đọc cờ `Otp:StubEnabled`, nên về lý thuyết còn tổ hợp cấu hình vừa gửi tin thật
        // vừa trả mã ra response — nay không còn tồn tại tổ hợp đó.
        return new OtpIssueResult(expiresAt, sender.RevealsCode ? code : null);
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
