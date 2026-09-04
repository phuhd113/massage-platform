using System.Net;
using FluentAssertions;

namespace Massage.Api.Tests;

/// <summary>
/// CORS cho hai endpoint mà trang công khai gọi **thẳng** từ trình duyệt.
///
/// Đây là loại lỗi không nhìn thấy được từ phía server: <c>curl</c> vẫn 200, mọi test
/// service vẫn xanh, chỉ trình duyệt thật mới chặn. Và hai endpoint này là
/// <c>POST /leads</c> — đơn vị doanh thu của sàn — cùng <c>POST /ktv/{id}/views</c>.
/// Thiếu CORS thì khách bấm "Gọi ngay" không lấy được số điện thoại, mà không có
/// dòng log nào ở server báo hỏng.
/// </summary>
[Collection(PostgresCollection.Name)]
public class CorsTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private const string AllowedOrigin = "http://localhost:3000";

    [Theory]
    [InlineData("/api/v1/leads")]
    [InlineData("/api/v1/ktv/11111111-1111-1111-1111-111111111111/views")]
    public async Task Preflight_từ_trang_web_được_chấp_nhận(string path)
    {
        var client = _api.CreateClient();

        var req = new HttpRequestMessage(HttpMethod.Options, path);
        req.Headers.Add("Origin", AllowedOrigin);
        req.Headers.Add("Access-Control-Request-Method", "POST");
        req.Headers.Add("Access-Control-Request-Headers", "content-type");

        var res = await client.SendAsync(req);

        res.StatusCode.Should().Be(HttpStatusCode.NoContent);
        res.Headers.GetValues("Access-Control-Allow-Origin").Should().Contain(AllowedOrigin);
    }

    [Fact]
    public async Task Origin_lạ_không_được_cấp_quyền()
    {
        var client = _api.CreateClient();

        var req = new HttpRequestMessage(HttpMethod.Options, "/api/v1/leads");
        req.Headers.Add("Origin", "https://ke-gian.example");
        req.Headers.Add("Access-Control-Request-Method", "POST");

        var res = await client.SendAsync(req);

        // Hai endpoint này ghi vào DB và ảnh hưởng trực tiếp tới số liệu tính tiền,
        // nên danh sách origin phải là danh sách trắng. Mở cho mọi origin là mời bất
        // kỳ trang nào bơm lead ảo cho một KTV bất kỳ.
        res.Headers.Contains("Access-Control-Allow-Origin").Should().BeFalse();
    }
}
