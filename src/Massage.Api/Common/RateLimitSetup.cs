using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace Massage.Api.Common;

public static class RateLimitPolicies
{
    public const string Leads = "leads";
    public const string Reviews = "reviews";
    public const string Reports = "reports";
    public const string ProfileViews = "profile-views";
}

public static class RateLimitSetup
{
    /// <summary>
    /// Giới hạn tần suất cho hai endpoint công khai ghi dữ liệu.
    ///
    /// Đặt ngay từ Phase 1 chứ không đợi Phase 4: <c>leads</c> và <c>reviews</c> là
    /// hai chỗ duy nhất người lạ ghi được vào DB, và cả hai đều trực tiếp ảnh hưởng
    /// tới thứ hạng — bơm lead ảo hoặc review ảo là cách rẻ nhất để phá xếp hạng.
    /// Chống gian lận đầy đủ (device fingerprint, điểm nghi ngờ) vẫn là việc của
    /// Phase 4; đây chỉ là cánh cửa đầu tiên.
    /// </summary>
    public static IServiceCollection AddAppRateLimiter(this IServiceCollection services) =>
        services.AddRateLimiter(opt =>
        {
            opt.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            opt.AddPolicy(RateLimitPolicies.Leads, ctx =>
                RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 30,
                    Window = TimeSpan.FromMinutes(1),
                }));

            // Rộng hơn lead nhiều: một khách xem vài chục hồ sơ trong một phiên là
            // hành vi bình thường của người đang chọn KTV. Ngưỡng này chỉ chặn kịch
            // bản bơm số tự động, không chạm tới người dùng thật.
            opt.AddPolicy(RateLimitPolicies.ProfileViews, ctx =>
                RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                }));

            // Chặt như đánh giá và vì cùng một lý do: đây là hàng đợi người thật phải
            // đọc bằng mắt. Một người báo cáo vài hồ sơ trong mười phút là bình thường;
            // hai mươi hồ sơ thì không phải đang tố giác mà đang bơm việc cho admin.
            opt.AddPolicy(RateLimitPolicies.Reports, ctx =>
                RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(10),
                }));

            opt.AddPolicy(RateLimitPolicies.Reviews, ctx =>
                RateLimitPartition.GetFixedWindowLimiter(ClientKey(ctx), _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 5,
                    Window = TimeSpan.FromMinutes(10),
                }));
        });

    /// <summary>
    /// Phân vùng theo user khi đã đăng nhập, theo IP khi chưa.
    ///
    /// Lưu ý vận hành: sau reverse proxy, <c>RemoteIpAddress</c> là IP của proxy nên
    /// mọi khách sẽ dùng chung một phân vùng. Khi đưa lên production phải bật
    /// <c>ForwardedHeaders</c> với danh sách proxy tin cậy — bật mà không khai báo
    /// proxy tin cậy còn tệ hơn không bật, vì lúc đó client tự đặt được IP giả.
    /// </summary>
    private static string ClientKey(HttpContext ctx) =>
        ctx.User.TryGetUserId()?.ToString()
        ?? ctx.Connection.RemoteIpAddress?.ToString()
        ?? "unknown";
}
