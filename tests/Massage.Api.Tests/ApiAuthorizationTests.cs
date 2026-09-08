using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;

namespace Massage.Api.Tests;

/// <summary>
/// Quyền truy cập theo vai trò.
///
/// Đây là lớp bảo vệ chỉ tồn tại ở tầng HTTP: service không biết gì về role, nên
/// một thuộc tính <c>[Authorize]</c> bị xoá nhầm sẽ không làm đỏ bất kỳ test
/// service nào — nó chỉ lộ ra khi có người lạ gọi được endpoint.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiAuthorizationTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    public static TheoryData<string, string> ProtectedEndpoints() => new()
    {
        { "GET", "/api/v1/wallet/balance" },
        { "GET", "/api/v1/wallet/transactions" },
        { "GET", "/api/v1/ktv/campaigns" },
        { "GET", "/api/v1/ktv/profile/me" },
        { "GET", "/api/v1/ktv/profile/services" },
        { "GET", "/api/v1/admin/ktv" },
        // Trang tra cứu trả **số điện thoại** KTV, thứ hồ sơ công khai cố ý giấu —
        // nên nó phải nằm trong danh sách này, không chỉ dựa vào [Authorize] ở class.
        { "GET", "/api/v1/admin/ktv/search" },
        { "GET", "/api/v1/admin/revenue" },
        { "GET", "/api/v1/admin/reports" },
        { "GET", "/api/v1/me/reviews" },
        { "GET", "/api/v1/admin/reviews" },
    };

    [Theory]
    [MemberData(nameof(ProtectedEndpoints))]
    public async Task Không_có_token_thì_bị_401(string method, string path)
    {
        var res = await _api.CreateClient()
            .SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_rác_bị_401_chứ_không_phải_500()
    {
        var client = _api.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "khong-phai-jwt");

        var res = await client.GetAsync("/api/v1/wallet/balance");

        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Khách_hàng_không_vào_được_endpoint_dành_cho_KTV()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);

        var res = await client.GetAsync("/api/v1/wallet/balance");

        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task KTV_không_vào_được_khu_vực_quản_trị()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.GetAsync("/api/v1/admin/ktv");

        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Admin_vào_được_khu_vực_quản_trị()
    {
        var admin = await _api.LoginAdminAsync();

        var res = await admin.GetAsync("/api/v1/admin/ktv");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Không_ai_tự_phong_được_quyền_admin_khi_đăng_ký()
    {
        var phone = ApiClient.UniquePhone();
        var client = _api.CreateClient();

        var request = await client.PostAsJsonAsync("/api/v1/auth/otp/request", new { phone });
        var code = (await request.Content.ReadFromJsonAsync<OtpDebug>())!.DebugCode;

        // Cố ý gửi role ADMIN. Validator phải chặn — nếu không, bất kỳ ai cũng tự
        // cấp quyền duyệt hồ sơ cho mình.
        var verify = await client.PostAsJsonAsync(
            "/api/v1/auth/otp/verify", new { phone, code, role = "ADMIN" });

        verify.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Không_sửa_được_hồ_sơ_của_người_khác_qua_đường_công_khai()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var victim = await TestData.CreateKtvAsync(db, lat, lon);

        var (attacker, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        // PATCH /ktv/profile luôn tác động lên hồ sơ của chính người gọi, không
        // nhận id từ ngoài — request này phải hỏng vì kẻ tấn công chưa có hồ sơ,
        // chứ không phải sửa trúng hồ sơ của nạn nhân.
        var res = await attacker.PatchAsJsonAsync("/api/v1/ktv/profile", new { fullName = "Bi chiem" });

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);

        await using var check = fixture.CreateContext();
        var unchanged = await check.KtvProfiles.FindAsync(victim.Id);
        unchanged!.FullName.Should().Be(victim.FullName);
    }

    [Fact]
    public async Task Endpoint_công_khai_vẫn_mở_cho_người_chưa_đăng_nhập()
    {
        var client = _api.CreateClient();

        foreach (var path in new[] { "/api/v1/health", "/api/v1/areas", "/api/v1/services", "/api/v1/promotions/packages" })
        {
            (await client.GetAsync(path)).StatusCode.Should().Be(HttpStatusCode.OK, $"{path} là đường công khai");
        }
    }

    private sealed record OtpDebug(string? DebugCode);
}
