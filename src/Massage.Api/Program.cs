using System.Text;
using FluentValidation;
using FluentValidation.AspNetCore;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Admin;
using Massage.Api.Modules.Auth;
using Massage.Api.Modules.Areas;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.Leads;
using Massage.Api.Modules.Reviews;
using Massage.Api.Modules.Promotions;
using Massage.Api.Modules.Promotions.Infrastructure;
using Massage.Api.Modules.Promotions.UseCases;
using Massage.Api.Modules.Search;
using Massage.Api.Modules.ServiceCatalog;
using Massage.Api.Modules.Wallets;
using Massage.Api.Modules.Wallets.Infrastructure;
using Massage.Api.Modules.Wallets.UseCases;
using Massage.Promotion.Domain.Ports;
using Massage.Wallet.Domain.Ports;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.Section));
builder.Services.Configure<OtpOptions>(builder.Configuration.GetSection(OtpOptions.Section));
builder.Services.Configure<UploadOptions>(builder.Configuration.GetSection(UploadOptions.Section));
builder.Services.Configure<VnPayOptions>(builder.Configuration.GetSection(VnPayOptions.Section));

var jwtSecret = builder.Configuration["Jwt:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret) || jwtSecret.Length < 32)
{
    // Fail fast ngay lúc khởi động: một secret rỗng hoặc quá ngắn khiến mọi token
    // ký ra đều giả mạo được, và lỗi đó sẽ không lộ ra cho tới khi bị khai thác.
    throw new InvalidOperationException(
        "Jwt:Secret phải được cấu hình và dài tối thiểu 32 ký tự.");
}

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(
        builder.Configuration.GetConnectionString("Default"),
        npgsql => npgsql.UseNetTopologySuite()));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ClockSkew = TimeSpan.FromMinutes(1),
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddControllers(opt =>
{
    // Đặt tiền tố phiên bản ở một chỗ thay vì lặp "api/v1" trong từng [Route].
    opt.UseGeneralRoutePrefix("api/v1");
});
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<RequestOtpDtoValidator>();
builder.Services.AddExceptionHandler<AppExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddAppSwagger();
builder.Services.AddAppRateLimiter();

builder.Services.AddScoped<IOtpService, OtpService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<KtvProfileService>();
builder.Services.AddScoped<CertificationUpload>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<ServiceCatalogService>();
builder.Services.AddScoped<AreaService>();
builder.Services.AddScoped<SearchService>();
builder.Services.AddScoped<LeadService>();
builder.Services.AddScoped<ReviewService>();

// Vùng chạm tiền: adapter hiện thực các cổng do hai project domain khai báo.
// Domain không tham chiếu EF nên việc nối dây chỉ xảy ra ở đây.
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<IWalletRepository, WalletRepository>();
builder.Services.AddScoped<IWalletUnitOfWork, WalletUnitOfWork>();
builder.Services.AddScoped<IPromotionCatalog, PromotionCatalog>();
builder.Services.AddScoped<ICampaignRepository, CampaignRepository>();
builder.Services.AddScoped<ISlotAllocator, SlotAllocator>();
builder.Services.AddScoped<IPaymentGateway, VnPayGateway>();
builder.Services.AddScoped<StartTopUpUseCase>();
builder.Services.AddScoped<ConfirmTopUpUseCase>();
builder.Services.AddScoped<BuyPromotionUseCase>();
builder.Services.AddScoped<CancelCampaignUseCase>();
builder.Services.AddScoped<WalletMaintenance>();

var app = builder.Build();

// Tác vụ vận hành chạy trong cùng process để dùng lại đúng cấu hình và
// connection string của app, thay vì phải khai báo lại ở một script riêng.
if (args.Length > 0 && args[0] is "migrate" or "seed-areas" or "seed-services" or "seed-packages" or "maintenance")
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    switch (args[0])
    {
        case "migrate":
            await db.Database.MigrateAsync();
            logger.LogInformation("Đã áp dụng migration");
            break;
        case "seed-areas":
            await AreaSeeder.SeedAsync(db, logger);
            break;
        case "seed-services":
            await ServiceSeeder.SeedAsync(db, logger);
            break;
        case "maintenance":
            // Nhả hold quá hạn, đóng campaign hết hạn, đối soát ví. Phase 3 sẽ gắn
            // vào Hangfire; tới lúc đó chỉ phải gắn lịch, nghiệp vụ đã nằm sẵn đây.
            var report = await scope.ServiceProvider
                .GetRequiredService<WalletMaintenance>().RunAsync();
            logger.LogInformation(
                "Bảo trì xong: nhả {Holds} hold, đóng {Campaigns} campaign, {Drift} ví lệch sổ",
                report.HoldsReleased, report.CampaignsExpired, report.WalletsDrifting);
            // Thoát khác 0 khi có ví lệch, để cron/CI biết cần người xem lại thay vì
            // chỉ có một dòng log trôi qua.
            if (report.WalletsDrifting > 0) Environment.ExitCode = 1;
            break;
        default:
            await PromotionPackageSeeder.SeedAsync(db, logger);
            break;
    }
    return;
}

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(opt =>
    {
        opt.SwaggerEndpoint("/swagger/v1/swagger.json", "Massage Platform API v1");
        opt.DocumentTitle = "Massage Platform API";
        // Giữ token sau khi reload trang, đỡ phải xin OTP lại mỗi lần F5.
        opt.EnablePersistAuthorization();
    });

    // Mở thẳng http://localhost:5080 ra tài liệu thay vì trả 404 khó hiểu.
    app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
}

var uploadDir = Path.Combine(app.Environment.ContentRootPath,
    app.Configuration["Upload:Dir"] ?? "uploads");
Directory.CreateDirectory(uploadDir);
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadDir),
    RequestPath = "/uploads",
});

app.UseAuthentication();
app.UseAuthorization();
// Sau xác thực để phân vùng giới hạn theo user khi đã đăng nhập; đặt trước đó thì
// ctx.User còn rỗng và mọi request đều rơi chung một phân vùng theo IP.
app.UseRateLimiter();

app.MapControllers();

app.Run();

public partial class Program;
