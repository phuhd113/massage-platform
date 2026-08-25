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
            Modules.Auth.TooManyAttemptsException => HttpStatusCode.BadRequest,
            Modules.Auth.InvalidOtpException => HttpStatusCode.Unauthorized,
            _ => HttpStatusCode.InternalServerError,
        };

        if (status == HttpStatusCode.InternalServerError)
        {
            logger.LogError(ex, "Lỗi chưa xử lý tại {Path}", ctx.Request.Path);
        }

        ctx.Response.StatusCode = (int)status;
        await ctx.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = (int)status,
            Title = status == HttpStatusCode.InternalServerError
                // Không lộ chi tiết lỗi hệ thống ra ngoài — nó có thể chứa thông tin
                // về cấu trúc DB hoặc đường dẫn máy chủ.
                ? "Đã có lỗi xảy ra, vui lòng thử lại"
                : ex.Message,
        }, ct);

        return true;
    }
}
