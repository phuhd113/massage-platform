using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Massage.Api.Tests;

/// <summary>
/// Dựng ứng dụng thật trong bộ nhớ và gọi nó qua HTTP.
///
/// Tồn tại vì test ở tầng service không nhìn thấy được cả một lớp lỗi: mã trạng
/// thái trả về, ánh xạ exception nghiệp vụ sang HTTP, binding form multipart,
/// tiền tố route, quyền theo role, và giới hạn tần suất. Một lỗi thật đã lọt qua
/// đúng khe đó — <c>GET /ktv/campaigns</c> trả 404 thay vì danh sách rỗng, làm
/// hỏng dashboard của KTV vừa đăng ký, trong khi mọi test service vẫn xanh.
///
/// Dùng chung database với <see cref="PostgresFixture"/> nên phải nằm cùng
/// collection: fixture đó xoá và tạo lại database mỗi lần chạy, và xUnit chạy
/// các collection khác nhau song song.
/// </summary>
public class ApiFactory(string connectionString) : WebApplicationFactory<Program>
{
    protected override IHost CreateHost(IHostBuilder builder)
    {
        builder.ConfigureHostConfiguration(config => config.AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = connectionString,
                // Đủ 32 ký tự, nếu không app từ chối khởi động — đúng như production.
                ["Jwt:Secret"] = "test-only-secret-at-least-32-characters-long",
                ["Jwt:Issuer"] = "massage-platform",
                ["Jwt:Audience"] = "massage-platform",
                // Bật stub để lấy được mã OTP mà không cần SMS. Đây cũng là cách
                // test đi qua đúng luồng đăng nhập thật thay vì tự ký JWT — nhờ
                // vậy nó kiểm luôn cả hai endpoint auth.
                ["Otp:StubEnabled"] = "true",
                ["Upload:Dir"] = Path.Combine(Path.GetTempPath(), $"massage-test-uploads-{Guid.NewGuid():N}"),
            }));

        // Không dùng Development: môi trường đó bật Swagger và route "/" chuyển
        // hướng, hai thứ không liên quan tới thứ đang được kiểm.
        builder.UseEnvironment("Testing");

        builder.ConfigureLogging(logging => logging.AddProvider(new CapturingLoggerProvider(Errors)));

        return base.CreateHost(builder);
    }

    /// <summary>
    /// Log mức Error mà ứng dụng ghi ra trong lúc test.
    ///
    /// Cần thiết vì <c>AppExceptionHandler</c> cố ý không lộ chi tiết lỗi 500 ra
    /// response — đúng ở production, nhưng khi test đỏ thì "mong 201 nhận 500" một
    /// mình không nói được nguyên nhân. Đây là chỗ đọc được nguyên nhân đó.
    /// </summary>
    public List<string> Errors { get; } = [];

    public string ErrorsOrEmpty() => Errors.Count == 0 ? "(không có log lỗi)" : string.Join("\n", Errors);
}

internal sealed class CapturingLoggerProvider(List<string> sink) : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new CapturingLogger(sink);
    public void Dispose() { }

    private sealed class CapturingLogger(List<string> sink) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

        public void Log<TState>(
            LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;

            lock (sink)
            {
                sink.Add($"{formatter(state, exception)}{(exception is null ? "" : $" :: {exception}")}");
            }
        }
    }
}

/// <summary>Tiện ích gọi API và đăng nhập trong test.</summary>
public static class ApiClient
{
    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web);

    public static async Task<T?> ReadAsync<T>(this HttpResponseMessage res) =>
        await res.Content.ReadFromJsonAsync<T>(Json);

    /// <summary>Đọc trường <c>title</c> của ProblemDetails để khẳng định thông điệp lỗi.</summary>
    public static async Task<string> ProblemTitleAsync(this HttpResponseMessage res)
    {
        var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
        return doc.TryGetProperty("title", out var title) ? title.GetString() ?? "" : "";
    }

    /// <summary>
    /// Uỷ quyền cho <see cref="TestData.UniquePhone"/> chứ không tự sinh.
    ///
    /// Hai bộ đếm độc lập cùng định dạng là cách chắc chắn tạo ra trùng khoá, và
    /// khi trùng thì test đỏ là một test ngẫu nhiên chứ không phải test có lỗi.
    /// </summary>
    public static string UniquePhone() => TestData.UniquePhone();

    /// <summary>
    /// Đăng ký/đăng nhập qua đúng luồng OTP thật và trả về client đã gắn token.
    /// </summary>
    public static async Task<(HttpClient Client, Guid UserId, string Phone)> LoginAsync(
        this ApiFactory factory, string role = UserRoles.Ktv, string? phone = null)
    {
        phone ??= UniquePhone();
        var client = factory.CreateClient();

        var request = await client.PostAsJsonAsync("/api/v1/auth/otp/request", new { phone });
        request.EnsureSuccessStatusCode();

        var code = (await request.ReadAsync<OtpRequested>())!.DebugCode;

        var verify = await client.PostAsJsonAsync(
            "/api/v1/auth/otp/verify", new { phone, code, role });
        verify.EnsureSuccessStatusCode();

        var token = (await verify.ReadAsync<TokenIssued>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var userId = await db.Users.Where(u => u.Phone == phone).Select(u => u.Id).FirstAsync();

        return (client, userId, phone);
    }

    /// <summary>
    /// Đăng nhập bằng quyền ADMIN.
    ///
    /// Phải phong quyền bằng SQL rồi đăng nhập lại: cố ý không có endpoint tự
    /// phong admin, và test không được tạo ra một đường vòng mà production không có.
    /// </summary>
    public static async Task<HttpClient> LoginAdminAsync(this ApiFactory factory)
    {
        var (_, _, phone) = await factory.LoginAsync(UserRoles.Customer);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE users SET role = 'ADMIN' WHERE phone = {phone}");
        }

        var (client, _, _) = await factory.LoginAsync(UserRoles.Customer, phone);
        return client;
    }

    private sealed record OtpRequested(string Phone, DateTimeOffset ExpiresAt, string? DebugCode);
    private sealed record TokenIssued(string AccessToken);
}
