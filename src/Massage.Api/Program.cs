using System.Text;
using FluentValidation;
using FluentValidation.AspNetCore;
using Hangfire;
using Massage.Api.Common;
using Massage.Api.Common.Storage;
using Massage.Api.Data;
using Massage.Api.Modules.Analytics;
using Massage.Api.Modules.Admin;
using Massage.Api.Modules.Auth;
using Massage.Api.Modules.Auth.Sms;
using Massage.Api.Modules.Areas;
using Massage.Api.Modules.Collaborators;
using Massage.Api.Modules.Jobs;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.Leads;
using Massage.Api.Modules.Reviews;
using Massage.Api.Modules.Promotions;
using Massage.Api.Modules.Promotions.Infrastructure;
using Massage.Api.Modules.Promotions.UseCases;
using Massage.Api.Modules.PublicSite;
using Massage.Api.Modules.Reports;
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
using Npgsql;
using StackExchange.Redis;

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

// Data source dựng tường minh, **một lần**, có plugin NetTopologySuite.
//
// Không truyền chuỗi kết nối thẳng vào `UseNpgsql`: khi làm vậy Npgsql tự dựng data
// source và tra nó trong một cache dùng chung cả process, khoá theo chuỗi kết nối —
// nên bản nào mở kết nối trước sẽ chiếm chỗ. Nếu bản đó thiếu plugin NTS thì mọi thứ
// dựng sau nhận lại bản thiếu, và cột `geography` không đọc thành `Point` được nữa:
// `/ktv/profile/me` trả 500 trong khi `/search` (raw SQL, tự đọc lat/lon thành double)
// vẫn 200 — hỏng một nửa, rất khó lần ra.
//
// Đã xảy ra thật khi AnalyticsWriter (BackgroundService, mở kết nối riêng để COPY) chạy
// trước request đầu tiên. Cùng cái bẫy mà PostgresFixture đã ghi chú ở tầng test.
var dataSourceBuilder =
    new NpgsqlDataSourceBuilder(builder.Configuration.GetConnectionString("Default"));
// UseNetTopologySuite trả về type mapper chứ không phải builder, nên không nối chuỗi được.
dataSourceBuilder.UseNetTopologySuite();
var dataSource = dataSourceBuilder.Build();

builder.Services.AddSingleton(dataSource);
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(dataSource, npgsql => npgsql.UseNetTopologySuite()));

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
builder.Services.AddAppCors(builder.Configuration);

builder.Services.AddOtpSender(builder.Configuration);
builder.Services.AddScoped<IOtpService, OtpService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<KtvProfileService>();
builder.Services.AddScoped<CollaboratorService>();
builder.Services.AddObjectStorage(builder.Configuration);
builder.Services.AddScoped<UploadService>();
builder.Services.AddScoped<MediaUrls>();
builder.Services.AddScoped<AdminService>();
builder.Services.AddScoped<ServiceCatalogService>();
builder.Services.AddScoped<AreaService>();
builder.Services.AddScoped<SiteStatsService>();
builder.Services.AddScoped<AnalyticsService>();
builder.Services.AddScoped<AnalyticsPartitionMaintenance>();

// Writer vừa là BackgroundService vừa là hàng đợi mà request ghi vào, nên phải là **một**
// instance: đăng ký hai lần sẽ tạo ra hai đối tượng, request xếp sự kiện vào cái không
// có ai đọc, và dashboard đứng số mà không có lỗi nào.
builder.Services.AddSingleton<AnalyticsWriter>();
builder.Services.AddSingleton<IAnalyticsQueue>(sp => sp.GetRequiredService<AnalyticsWriter>());
builder.Services.AddHostedService(sp => sp.GetRequiredService<AnalyticsWriter>());
builder.Services.AddScoped<SearchService>();
builder.Services.AddScoped<LeadService>();
builder.Services.AddScoped<ReviewService>();
builder.Services.AddScoped<ReportService>();

// Vùng chạm tiền: adapter hiện thực các cổng do hai project domain khai báo.
// Domain không tham chiếu EF nên việc nối dây chỉ xảy ra ở đây.
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddScoped<IWalletRepository, WalletRepository>();
builder.Services.AddScoped<IWalletUnitOfWork, WalletUnitOfWork>();
builder.Services.AddScoped<IPromotionCatalog, PromotionCatalog>();
builder.Services.AddScoped<ICampaignRepository, CampaignRepository>();
builder.Services.AddScoped<ISlotAllocator, SlotAllocator>();

// Redis chỉ là fast-path, nên kết nối được đăng ký ở dạng "có thì dùng".
//
// `AbortOnConnectFail = false` để app vẫn khởi động khi Redis chưa sẵn sàng và tự
// nối lại sau — ngược lại thì một Redis chậm khởi động sẽ chặn cả API, đúng kiểu
// đặt tính sẵn sàng của hệ thống vào tay một cache.
builder.Services.AddSingleton<RedisConnection>(sp =>
{
    var host = builder.Configuration["Redis:Host"];
    if (string.IsNullOrWhiteSpace(host)) return new RedisConnection(null);

    var options = new ConfigurationOptions
    {
        EndPoints = { { host, int.TryParse(builder.Configuration["Redis:Port"], out var p) ? p : 6379 } },
        AbortOnConnectFail = false,
        ConnectTimeout = 2000,
        ConnectRetry = 3,
    };

    try
    {
        return new RedisConnection(ConnectionMultiplexer.Connect(options));
    }
    catch (Exception ex)
    {
        // Không ném: thiếu khoá fast-path thì mua gói chậm hơn chứ không sai.
        sp.GetRequiredService<ILogger<Program>>()
            .LogWarning(ex, "Không kết nối được Redis, khoá slot sẽ bỏ qua");
        return new RedisConnection(null);
    }
});
builder.Services.AddScoped<ISlotLock, RedisSlotLock>();

builder.Services.AddScoped<IPaymentGateway, VnPayGateway>();
builder.Services.AddScoped<StartTopUpUseCase>();
builder.Services.AddScoped<ConfirmTopUpUseCase>();
builder.Services.AddScoped<BuyPromotionUseCase>();
builder.Services.AddScoped<CancelCampaignUseCase>();
builder.Services.AddScoped<WalletMaintenance>();

// Hangfire chỉ chạy ở tiến trình phục vụ request thật. Hai trường hợp phải loại trừ:
//
//   - **Lệnh CLI** (migrate, seed-*, maintenance) chạy rồi thoát ngay. `AddHangfireServer`
//     khởi động worker nền ngay lúc build host, nên một lượt `migrate` lúc deploy sẽ vừa
//     áp migration vừa lặng lẽ bắt đầu chạy job — có thể đúng lúc schema đang đổi dở.
//   - **Test** (`WebApplicationFactory`, môi trường "Testing"): mỗi test dựng một host
//     riêng, mà worker sẽ giành job từ cùng một hàng đợi Postgres và chạy nghiệp vụ ví
//     thật xen vào giữa các test.
var runsBackgroundJobs =
    args.Length == 0 && !builder.Environment.IsEnvironment("Testing");

if (runsBackgroundJobs)
{
    builder.Services.AddJobs(builder.Configuration);
}

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

// Phục vụ file khi chạy LocalObjectStorage (dev/test). Với R2 thì không đường dẫn
// nào ở đây được dùng — ảnh đi thẳng từ custom domain của bucket.
//
// **Chỉ mở đúng hai tiền tố công khai.** `certifications/` cố ý nằm ngoài: nó là ảnh
// chụp giấy tờ tuỳ thân, và mở cả thư mục uploads nghĩa là ai đoán được key đều tải
// được. Đây từng đúng là như vậy trước khi có lớp object storage — cả `/uploads` được
// phục vụ bằng một `UseStaticFiles` duy nhất.
//
// Khai từng tiền tố thay vì chặn `certifications/`: danh sách cho phép thì một prefix
// riêng tư thêm về sau **mặc định** nằm ngoài, còn danh sách chặn thì mặc định lọt.
var uploadDir = Path.Combine(app.Environment.ContentRootPath,
    app.Configuration["Upload:Dir"] ?? "uploads");

foreach (var prefix in new[] { "avatars", "photos" })
{
    var dir = Path.Combine(uploadDir, prefix);
    Directory.CreateDirectory(dir);

    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(dir),
        RequestPath = $"/uploads/{prefix}",
    });
}

// UseCors phải đứng trước auth và rate limiter: preflight OPTIONS không mang
// credentials, nên nếu để sau thì nó bị chặn trước khi kịp trả header CORS.
app.UseCors(CorsSetup.PublicSite);

app.UseAuthentication();
app.UseAuthorization();
// Sau xác thực để phân vùng giới hạn theo user khi đã đăng nhập; đặt trước đó thì
// ctx.User còn rỗng và mọi request đều rơi chung một phân vùng theo IP.
app.UseRateLimiter();

app.MapControllers();

// Dashboard và lịch chỉ tồn tại khi Hangfire được đăng ký — cùng một điều kiện, vì gọi
// `UseHangfireDashboard` mà không có `AddHangfire` là lỗi lúc khởi động chứ không phải
// một no-op im lặng.
if (runsBackgroundJobs)
{
    // Sau MapControllers và sau auth: dashboard đọc `ctx.User` để nhận ra ADMIN đã đăng nhập.
    //
    // `Jobs:DashboardAnonymous` mặc định **false** — dashboard cho phép kích chạy và xoá
    // job (kể cả job đối soát ví), nên nó phải là thứ được bật có chủ ý chứ không phải
    // thứ phải nhớ tắt. Bật ở dev cho tiện; ở production để nguyên và xem qua SSH tunnel.
    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization =
        [
            new HangfireDashboardAuth(
                app.Configuration.GetValue("Jobs:DashboardAnonymous", false)),
        ],
        DisplayStorageConnectionString = false,
    });

    app.Services.ScheduleRecurringJobs();
}

app.Run();

public partial class Program;
