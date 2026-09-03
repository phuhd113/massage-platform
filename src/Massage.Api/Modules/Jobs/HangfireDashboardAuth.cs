using Hangfire.Dashboard;
using Massage.Api.Modules.Auth.Entities;

namespace Massage.Api.Modules.Jobs;

/// <summary>
/// Cho phép mở dashboard Hangfire.
///
/// <b>Vì sao không dùng thẳng <c>[Authorize(Roles = ADMIN)]</c>:</b> dashboard là trang
/// HTML người ta gõ URL vào trình duyệt, mà xác thực của API là JWT Bearer — trình duyệt
/// không tự gắn header <c>Authorization</c> cho một lần điều hướng. Nối thẳng hai thứ này
/// sẽ ra một trang không ai đăng nhập được, và cách "chữa" thường thấy là chấp nhận token
/// trên query string — tức là đẩy JWT vào lịch sử trình duyệt, log của proxy và Referer.
///
/// Nên mặc định ở đây là <b>đóng</b>: dashboard chỉ mở khi được bật tường minh trong cấu
/// hình. Ở môi trường dev thì bật cho tiện; ở production thì để tắt và xem qua đường hầm
/// SSH, hoặc đặt sau reverse proxy tự lo xác thực.
///
/// Mặc định đóng chứ không phải mặc định mở, vì hậu quả của hai lựa chọn rất lệch nhau:
/// dashboard này cho phép <b>kích chạy và xoá job</b>, trong đó có job đối soát ví.
/// </summary>
public class HangfireDashboardAuth(bool allowAnonymous) : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var http = context.GetHttpContext();

        // Đã đăng nhập bằng cookie/JWT và đúng vai ADMIN thì luôn cho qua — đường này
        // dùng được khi gọi từ công cụ tự gắn header.
        if (http.User.Identity?.IsAuthenticated == true && http.User.IsInRole(UserRoles.Admin))
            return true;

        return allowAnonymous;
    }
}
