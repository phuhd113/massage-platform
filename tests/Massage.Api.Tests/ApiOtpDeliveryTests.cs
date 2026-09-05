using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Sms;

namespace Massage.Api.Tests;

/// <summary>
/// Tầng HTTP cho luồng gửi OTP: mã trạng thái đúng khi nhà cung cấp hỏng, và
/// message nội bộ không rò ra ngoài.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiOtpDeliveryTests(PostgresFixture fixture)
{
    private static string NewPhone() => "09" + Random.Shared.Next(10_000_000, 99_999_999);

    [Fact]
    public async Task Không_gửi_được_OTP_thì_trả_503_chứ_không_phải_500()
    {
        // 503 nói đúng bản chất — sự cố phía nhà cung cấp, thử lại là hợp lý. Frontend
        // map lỗi theo HTTP status ở mọi flow khách, nên mã này là thứ quyết định
        // người dùng nhìn thấy câu gì.
        using var api = new ApiFactory(fixture.ConnectionString, fixture.DataSource)
        {
            OtpSender = new BrokenSender(),
        };
        using var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/otp/request",
            new { phone = NewPhone(), purpose = "REGISTER" });

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable, api.ErrorsOrEmpty());
    }

    [Fact]
    public async Task Lỗi_gửi_OTP_không_rò_tên_khoá_cấu_hình_ra_client()
    {
        // AppExceptionHandler trả `ex.Message` ra ngoài cho mọi status khác 500, và
        // message của OtpDeliveryException nêu đích danh Zalo:Zns:* — hữu ích trong
        // log, nhưng ra ngoài là chỉ cho người lạ biết ta dùng nhà cung cấp nào và
        // đang hỏng ở đâu.
        using var api = new ApiFactory(fixture.ConnectionString, fixture.DataSource)
        {
            OtpSender = new BrokenSender(),
        };
        using var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/otp/request",
            new { phone = NewPhone(), purpose = "REGISTER" });
        var body = await response.Content.ReadAsStringAsync();

        body.Should().NotContain("Zalo");
        body.Should().NotContain("RefreshToken");
        body.Should().NotContain("secret");
    }

    [Fact]
    public async Task Gửi_thành_công_qua_kênh_thật_thì_response_KHÔNG_có_debugCode()
    {
        // Đây là ràng buộc an toàn quan trọng nhất của cả thay đổi: mã chỉ ra khỏi
        // server khi chính adapter khai là nó làm vậy. Rò debugCode ở production nghĩa
        // là ai gọi được endpoint này cũng đăng nhập được bằng số của người khác.
        using var api = new ApiFactory(fixture.ConnectionString, fixture.DataSource)
        {
            OtpSender = new SilentSender(),
        };
        using var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/otp/request",
            new { phone = NewPhone(), purpose = "REGISTER" });
        var body = await response.Content.ReadFromJsonAsync<OtpResponse>();

        response.StatusCode.Should().Be(HttpStatusCode.OK, api.ErrorsOrEmpty());
        body!.DebugCode.Should().BeNull();
    }

    private sealed record OtpResponse(string Phone, DateTimeOffset ExpiresAt, string? DebugCode);

    private sealed class BrokenSender : IOtpSender
    {
        public string Channel => "BROKEN";
        public bool RevealsCode => false;
        public Task SendAsync(string phone, string code, int ttl, CancellationToken ct = default) =>
            throw new OtpDeliveryException("Chưa có Zalo:Zns:RefreshToken, secret không hợp lệ.");
    }

    private sealed class SilentSender : IOtpSender
    {
        public string Channel => "SILENT";
        public bool RevealsCode => false;
        public Task SendAsync(string phone, string code, int ttl, CancellationToken ct = default) =>
            Task.CompletedTask;
    }
}
