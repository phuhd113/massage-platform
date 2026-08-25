using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Auth;

[ApiController]
[Route("auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    [HttpPost("otp/request")]
    public async Task<IActionResult> RequestOtp(RequestOtpDto dto, CancellationToken ct)
    {
        var (phone, expiresAt, debugCode) = await auth.RequestOtpAsync(
            dto.Phone, dto.Purpose ?? OtpPurposes.Register, ct);

        return Ok(new { phone, expiresAt, debugCode });
    }

    [HttpPost("otp/verify")]
    public async Task<IActionResult> VerifyOtp(VerifyOtpDto dto, CancellationToken ct)
    {
        var tokens = await auth.VerifyOtpAndIssueTokenAsync(
            dto.Phone, dto.Code, dto.Purpose ?? OtpPurposes.Register, dto.Role ?? UserRoles.Customer, ct);

        return Ok(tokens);
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var user = await auth.FindByIdAsync(User.GetUserId(), ct);
        if (user is null) return NotFound();

        return Ok(new { user.Id, user.Phone, user.Role, user.Email });
    }
}
