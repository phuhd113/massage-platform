namespace Massage.Api.Common;

public static class CorsSetup
{
    public const string PublicSite = "public-site";

    /// <summary>
    /// CORS cho ba endpoint trang công khai gọi **thẳng** từ trình duyệt:
    /// <c>POST /leads</c>, <c>POST /ktv/{id}/views</c> và <c>POST /reports</c>.
    ///
    /// Cả ba cố ý không đi vòng qua Next.js proxy vì backend cần thấy đúng IP và user
    /// agent của khách — đó là dữ liệu gộp lead trùng, lượt xem trùng và báo cáo trùng.
    /// Đi qua proxy thì mọi khách chung một IP (IP của server) và cả ba cơ chế gộp sập
    /// thành một nhóm duy nhất.
    ///
    /// Khai báo origin tường minh qua cấu hình <c>Cors:Origins</c>, **không** dùng
    /// <c>AllowAnyOrigin</c>: chúng ghi vào DB và ảnh hưởng trực tiếp tới số liệu tính
    /// tiền lẫn hàng đợi người thật phải đọc, nên mở cho mọi origin là mời bất kỳ trang
    /// nào bơm lead ảo hoặc báo cáo ảo.
    /// Thiếu cấu hình thì mặc định về localhost để môi trường dev chạy được ngay.
    /// </summary>
    public static IServiceCollection AddAppCors(this IServiceCollection services, IConfiguration config)
    {
        var origins = config.GetSection("Cors:Origins").Get<string[]>()
                      ?? ["http://localhost:3000"];

        return services.AddCors(opt => opt.AddPolicy(PublicSite, policy => policy
            .WithOrigins(origins)
            .WithMethods("POST")
            // Không AllowCredentials: hai endpoint này không đọc cookie phiên, và bật
            // nó lên sẽ khiến trình duyệt gửi kèm cookie tới một endpoint công khai
            // mà không có lý do nào cần.
            .WithHeaders("content-type")));
    }
}
