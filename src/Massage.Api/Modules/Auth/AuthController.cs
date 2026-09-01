using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.AspNetCore.Authorization;
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
    public async Task<IActionResult> RequestOtp(RequestOtpDto dto, CancellationToken ct)
    {
        var (phone, expiresAt, debugCode) = await auth.RequestOtpAsync(
            dto.Phone, dto.Purpose ?? OtpPurposes.Register, ct);

        return Ok(new { phone, expiresAt, debugCode });
    }

    /// <summary>Xác thực OTP và cấp JWT.</summary>
    [HttpPost("otp/verify")]
    public async Task<IActionResult> VerifyOtp(VerifyOtpDto dto, CancellationToken ct)
    {
        var tokens = await auth.VerifyOtpAndIssueTokenAsync(
            dto.Phone, dto.Code, dto.Purpose ?? OtpPurposes.Register, dto.Role ?? UserRoles.Customer, ct);

        return Ok(tokens);
    }

    /// <summary>Thông tin tài khoản đang đăng nhập.</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var user = await auth.FindByIdAsync(User.GetUserId(), ct);
        if (user is null) return NotFound();

        return Ok(new { user.Id, user.Phone, user.Role, user.Email });
    }
}
