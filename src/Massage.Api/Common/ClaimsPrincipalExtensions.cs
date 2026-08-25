using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace Massage.Api.Common;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        // JwtSecurityTokenHandler ánh xạ "sub" sang NameIdentifier theo mặc định,
        // nên phải tra cả hai để không phụ thuộc vào cấu hình mapping.
        var raw = principal.FindFirstValue(JwtRegisteredClaimNames.Sub)
                  ?? principal.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(raw, out var id)
            ? id
            : throw new InvalidOperationException("Token thiếu định danh người dùng hợp lệ");
    }
}
