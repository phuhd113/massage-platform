using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Auth;

/// <summary>Đăng ký / đăng nhập bằng OTP qua số điện thoại.</summary>
[ApiController]
[Route("auth")]
[Tags("Auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    /// <summary>Xin mã OTP cho một số điện thoại.</summary>
    /// <remarks>
    /// Khi <c>Otp:StubEnabled=true</c> (mặc định ở môi trường dev), mã được trả về
    /// ngay trong trường <c>debugCode</c> để test mà không cần SMS thật.
    /// </remarks>
    [HttpPost("otp/request")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> RequestOtp(RequestOtpDto dto, CancellationToken ct)
    {
        var (phone, expiresAt, debugCode) = await auth.RequestOtpAsync(
            dto.Phone, dto.Purpose ?? OtpPurposes.Register, ct);

        return Ok(new { phone, expiresAt, debugCode });
    }

    /// <summary>Xác thực OTP và cấp JWT.</summary>
    [HttpPost("otp/verify")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> VerifyOtp(VerifyOtpDto dto, CancellationToken ct)
    {
        var tokens = await auth.VerifyOtpAndIssueTokenAsync(
            dto.Phone, dto.Code, dto.Purpose ?? OtpPurposes.Register, dto.Role ?? UserRoles.Customer, ct);

        return Ok(tokens);
    }

    /// <summary>Tạo tài khoản bằng số điện thoại + mật khẩu, trả JWT luôn.</summary>
    /// <remarks>
    /// Đây là đường đăng ký đang dùng ở giai đoạn đầu, khi chưa có giấy phép kinh
    /// doanh để bật Zalo ZNS. Số điện thoại **chưa được xác thực** ở bước này.
    /// </remarks>
    [HttpPost("register")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> Register(RegisterPasswordDto dto, CancellationToken ct)
    {
        var tokens = await auth.RegisterWithPasswordAsync(
            dto.Phone, dto.Password, dto.Role ?? UserRoles.Customer, ct);

        return Ok(tokens);
    }

    /// <summary>Đăng nhập bằng số điện thoại + mật khẩu.</summary>
    [HttpPost("login")]
    [EnableRateLimiting(RateLimitPolicies.Auth)]
    public async Task<IActionResult> Login(LoginPasswordDto dto, CancellationToken ct)
    {
        var tokens = await auth.LoginWithPasswordAsync(dto.Phone, dto.Password, ct);
        return Ok(tokens);
    }

    /// <summary>Đặt hoặc đổi mật khẩu của tài khoản đang đăng nhập.</summary>
    /// <remarks>
    /// Tài khoản tạo bằng OTP chưa có mật khẩu — với chúng, <c>currentPassword</c>
    /// không cần thiết. Tài khoản đã có mật khẩu thì bắt buộc phải gửi đúng.
    /// </remarks>
    [HttpPatch("password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword(ChangePasswordDto dto, CancellationToken ct)
    {
        await auth.SetPasswordAsync(User.GetUserId(), dto.CurrentPassword, dto.NewPassword, ct);
        return NoContent();
    }

    /// <summary>Thông tin tài khoản đang đăng nhập.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var user = await auth.FindByIdAsync(User.GetUserId(), ct);
        if (user is null) return NotFound();

        // hasPassword chứ không phải hash: trang tài khoản cần biết nên hỏi mật khẩu
        // hiện tại hay không (tài khoản tạo bằng OTP thì chưa có), và đó là toàn bộ
        // thứ nó cần biết về mật khẩu.
        return Ok(new { user.Id, user.Phone, user.Role, user.Email, HasPassword = user.PasswordHash is not null });
    }
}
