using Massage.Api.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Collaborators;

/// <summary>
/// Kiểm tra mã giới thiệu cho form tạo hồ sơ KTV.
///
/// <b>Controller riêng, không nằm trong <see cref="CollaboratorController"/></b>: lớp đó
/// khai <c>[Authorize(Roles = ADMIN)]</c> ở cấp class, và một <c>[Authorize]</c> ở cấp
/// method **không nới rộng** được ràng buộc đó — mọi filter đều phải qua, nên KTV vẫn
/// nhận 403. Đây là lỗi thật đã bị test bắt, không phải suy đoán: form đăng ký sẽ không
/// bao giờ kiểm được mã nếu để chung chỗ.
/// </summary>
[ApiController]
[Route("referral-codes")]
[Tags("Collaborators")]
public class ReferralCodeController(CollaboratorService service) : ControllerBase
{
    /// <summary>Kiểm tra một mã giới thiệu có dùng được không, trả về tên cộng tác viên.</summary>
    /// <remarks>
    /// Cần đăng nhập (bất kỳ vai trò nào) vì form tạo hồ sơ cần xác nhận mã **trước khi**
    /// gửi — KTV gõ nhầm phải thấy ngay, chứ không phải điền xong cả biểu mẫu rồi mới
    /// nhận lỗi.
    ///
    /// Chỉ trả **tên** CTV, không trả số điện thoại hay ghi chú: mục đích là để KTV xác
    /// nhận "đúng người đã mời tôi", mà đây là endpoint dò được — ai đoán trúng mã cũng
    /// gọi được, nên nó không được thành đường rò thông tin liên hệ của cộng tác viên.
    /// </remarks>
    [HttpGet("{code}")]
    [Authorize]
    public async Task<IActionResult> Verify(string code, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new BadRequestException("Thiếu mã giới thiệu");

        var c = await service.RequireActiveByCodeAsync(code, ct);
        return Ok(new { c.Code, c.FullName });
    }
}
