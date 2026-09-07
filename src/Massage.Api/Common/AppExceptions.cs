using System.Net;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Common;

public class NotFoundException(string message) : Exception(message);
public class ConflictException(string message) : Exception(message);
public class BadRequestException(string message) : Exception(message);

/// <summary>
/// Ánh xạ exception nghiệp vụ sang mã HTTP ở một chỗ duy nhất, để service không
/// phải biết gì về HTTP và controller không phải lặp lại try/catch.
/// </summary>
public class AppExceptionHandler(ILogger<AppExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var status = ex switch
        {
            NotFoundException => HttpStatusCode.NotFound,
            ConflictException => HttpStatusCode.Conflict,
            BadRequestException => HttpStatusCode.BadRequest,
            // 429, KHÔNG phải 400. Đây là lỗi đã cắn: FluentValidation cũng trả 400
            // cho dữ liệu sai định dạng, nên client không phân biệt được "số điện
            // thoại nhập sai" với "tài khoản đang bị khoá" — và màn hình đăng nhập
            // hiện "sai quá nhiều lần" cho người vừa gõ sai định dạng ở lần thử đầu
            // tiên. Hai tình huống dẫn tới hai hành động khác hẳn nhau (sửa ô nhập
            // / chờ 15 phút), nên chúng phải mang hai mã khác nhau.
            Modules.Auth.TooManyAttemptsException => HttpStatusCode.TooManyRequests,
            Modules.Auth.InvalidOtpException => HttpStatusCode.Unauthorized,

            // Sai số điện thoại hoặc sai mật khẩu — cùng một mã, cùng một message,
            // vì phân biệt hai trường hợp là cho phép dò xem số nào đã có tài khoản.
            Modules.Auth.InvalidLoginException => HttpStatusCode.Unauthorized,

            // Không gửi được OTP là sự cố phía nhà cung cấp, không phải lỗi của người
            // dùng: 503 nói đúng bản chất và cho client biết thử lại là hợp lý, khác
            // 500 (lỗi của ta) và khác 400 (họ nhập sai).
            Modules.Auth.Sms.OtpDeliveryException => HttpStatusCode.ServiceUnavailable,

            // Hết slot là kết quả bình thường của việc bán hàng có giới hạn, không
            // phải sự cố hệ thống — 409 để client biết thử khu vực hoặc khung khác.
            global::Massage.Promotion.Domain.SlotExhaustedException => HttpStatusCode.Conflict,
            global::Massage.Promotion.Domain.InvalidCampaignTransitionException => HttpStatusCode.Conflict,
            Modules.Wallets.Infrastructure.WalletConcurrencyException => HttpStatusCode.Conflict,

            // Lỗi nghiệp vụ của ví (không đủ số dư, số tiền không hợp lệ, hold hết
            // hạn) đều là thứ người dùng sửa được, nên 400 kèm thông điệp thật.
            global::Massage.Wallet.Domain.WalletDomainException => HttpStatusCode.BadRequest,
            global::Massage.Promotion.Domain.PromotionDomainException => HttpStatusCode.BadRequest,

            _ => HttpStatusCode.InternalServerError,
        };

        if (status == HttpStatusCode.InternalServerError)
        {
            logger.LogError(ex, "Lỗi chưa xử lý tại {Path}", ctx.Request.Path);
        }

        // Message của lỗi gửi OTP nêu đích danh khoá cấu hình còn thiếu (Zalo:Zns:*) —
        // hữu ích trong log, nhưng trả ra ngoài là chỉ cho người lạ biết hệ thống dùng
        // nhà cung cấp nào và đang hỏng ở đâu. Log đầy đủ, ra ngoài chỉ một câu chung.
        if (ex is Modules.Auth.Sms.OtpDeliveryException)
        {
            logger.LogError(ex, "Không gửi được OTP tại {Path}", ctx.Request.Path);
        }

        ctx.Response.StatusCode = (int)status;
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = (int)status,
            Title = status switch
            {
                // Không lộ chi tiết lỗi hệ thống ra ngoài — nó có thể chứa thông tin
                // về cấu trúc DB hoặc đường dẫn máy chủ.
                HttpStatusCode.InternalServerError => "Đã có lỗi xảy ra, vui lòng thử lại",
                HttpStatusCode.ServiceUnavailable => "Hiện chưa gửi được mã xác thực. Vui lòng thử lại sau ít phút.",
                _ => ex.Message,
            },
        }, ct);

        return true;
    }
}
