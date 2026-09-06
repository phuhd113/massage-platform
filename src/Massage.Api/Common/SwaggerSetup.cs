using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Massage.Api.Common;

/// <summary>
/// Cấu hình Swagger/OpenAPI cho API. Tách khỏi Program.cs vì phần khai báo
/// security scheme khá dài và sẽ còn phình ra khi thêm phiên bản API mới.
/// </summary>
public static class SwaggerSetup
{
    private const string BearerScheme = "Bearer";

    public static IServiceCollection AddAppSwagger(this IServiceCollection services)
    {
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen(opt =>
        {
            opt.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "Massage Platform API",
                Version = "v1",
                Description =
                    "Marketplace kết nối khách với kỹ thuật viên massage trị liệu tận nơi.\n\n"
                    + "**Đăng nhập để thử các endpoint có khoá:** gọi `POST /api/v1/auth/otp/request` "
                    + "→ lấy `debugCode` trong response (OTP đang ở chế độ stub) → gọi "
                    + "`POST /api/v1/auth/otp/verify` → bấm **Authorize** và dán `accessToken`.",
            });

            // Không có phần này thì mọi endpoint [Authorize] đều trả 401 khi thử từ
            // Swagger UI, vì UI không có chỗ nào để đính kèm token.
            opt.AddSecurityDefinition(BearerScheme, new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "Dán thẳng JWT (Swagger tự thêm tiền tố \"Bearer \").",
            });

            // Gắn yêu cầu bảo mật theo từng endpoint thay vì AddSecurityRequirement
            // toàn cục: endpoint công khai (OTP, health, tìm kiếm) không nên bị đánh
            // dấu là cần token — đó là thông tin sai trong tài liệu công khai.
            opt.OperationFilter<AuthorizeOperationFilter>();

            var xmlPath = Path.Combine(AppContext.BaseDirectory, "Massage.Api.xml");
            if (File.Exists(xmlPath))
            {
                opt.IncludeXmlComments(xmlPath);
            }
        });

        return services;
    }
}

/// <summary>
/// Đánh dấu ổ khoá và bổ sung response 401/403 cho đúng những endpoint thực sự
/// yêu cầu xác thực, dựa trên metadata authorization mà ASP.NET đã dựng sẵn.
/// </summary>
public class AuthorizeOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var metadata = context.ApiDescription.ActionDescriptor.EndpointMetadata;
        var requiresAuth =
            metadata.OfType<Microsoft.AspNetCore.Authorization.IAuthorizeData>().Any()
            && !metadata.OfType<Microsoft.AspNetCore.Authorization.IAllowAnonymous>().Any();

        if (!requiresAuth) return;

        operation.Responses.TryAdd("401", new OpenApiResponse { Description = "Chưa đăng nhập" });
        operation.Responses.TryAdd("403", new OpenApiResponse { Description = "Không đủ quyền" });
        operation.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer",
                },
            }] = Array.Empty<string>(),
        });
    }
}
