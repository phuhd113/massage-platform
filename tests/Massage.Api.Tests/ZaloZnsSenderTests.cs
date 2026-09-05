using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Sms;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Massage.Api.Tests;

/// <summary>
/// Adapter ZNS chạy hoàn toàn trên HTTP giả — không cần Postgres, không cần Zalo thật.
/// Thứ được canh ở đây là những chỗ API của Zalo cư xử khác trực giác, và chúng đều
/// hỏng im lặng: lỗi trả về kèm HTTP 200, và số điện thoại phải đổi dạng.
/// </summary>
public class ZaloZnsSenderTests
{
    private static ZaloZnsOptions Options() => new()
    {
        AppId = "app-1",
        SecretKey = "secret",
        TemplateId = "tpl-1",
        CodeParamName = "otp",
        ApiBaseUrl = "https://zns.test",
        OauthBaseUrl = "https://oauth.test",
    };

    private static ZaloZnsSender Create(FakeHandler handler, ZaloZnsOptions? options = null,
        IZaloTokenStore? tokenStore = null)
    {
        var factory = new FakeHttpClientFactory(handler);
        return new ZaloZnsSender(
            factory,
            tokenStore ?? new FakeTokenStore(),
            Microsoft.Extensions.Options.Options.Create(options ?? Options()),
            NullLogger<ZaloZnsSender>.Instance);
    }

    [Theory]
    [InlineData("0912345678", "84912345678")]
    [InlineData("+84912345678", "84912345678")]
    [InlineData("84912345678", "84912345678")]
    public void Số_điện_thoại_đổi_sang_dạng_ZNS(string input, string expected)
    {
        // ZNS nhận 84xxxxxxxxx: không dấu cộng, không số 0 đầu. Hệ thống lưu dạng
        // 0xxxxxxxxx nên nếu gửi thẳng thì Zalo trả lỗi tham số — và lỗi đó đọc như
        // lỗi quyền, tốn rất nhiều thời gian để lần ra.
        ZaloZnsSender.ToZaloPhone(input).Should().Be(expected);
    }

    [Fact]
    public async Task Gửi_thành_công_khi_error_bằng_0()
    {
        var handler = new FakeHandler(_ => Json("{\"error\":0,\"message\":\"Success\"}"));

        var act = () => Create(handler).SendAsync("0912345678", "123456", 300);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task HTTP_200_kèm_error_khác_0_vẫn_là_THẤT_BẠI()
    {
        // Cái bẫy lớn nhất của API này: ZNS trả HTTP 200 cho cả lượt hỏng. Chỉ đọc
        // status code nghĩa là tin nhắn nào cũng "gửi thành công" trong khi không tin
        // nào tới nơi — và người dùng chỉ ngồi chờ một mã không tồn tại.
        var handler = new FakeHandler(_ => Json("{\"error\":-108,\"message\":\"Template khong hop le\"}"));

        var act = () => Create(handler).SendAsync("0912345678", "123456", 300);

        await act.Should().ThrowAsync<OtpDeliveryException>().WithMessage("*-108*");
    }

    [Fact]
    public async Task Gửi_đúng_template_id_và_mã_vào_đúng_tên_tham_số()
    {
        var handler = new FakeHandler(_ => Json("{\"error\":0}"));
        var options = Options();
        options.CodeParamName = "ma_xac_thuc";

        await Create(handler, options).SendAsync("0912345678", "123456", 300);

        using var doc = JsonDocument.Parse(handler.LastBody!);
        var root = doc.RootElement;
        root.GetProperty("template_id").GetString().Should().Be("tpl-1");
        root.GetProperty("phone").GetString().Should().Be("84912345678");
        // Tên tham số do người tạo template đặt, nên không hằng hoá được: khai sai thì
        // ZNS từ chối và không có gì trong code nói cho ta biết tên đúng là gì.
        root.GetProperty("template_data").GetProperty("ma_xac_thuc").GetString().Should().Be("123456");
    }

    [Fact]
    public async Task Mỗi_lượt_gửi_có_tracking_id_riêng()
    {
        // Zalo dùng tracking_id để chống gửi trùng, nên dùng lại một id nghĩa là tin
        // thứ hai bị lặng lẽ bỏ — người bấm "gửi lại" không bao giờ nhận được gì.
        var handler = new FakeHandler(_ => Json("{\"error\":0}"));
        var sender = Create(handler);

        await sender.SendAsync("0912345678", "111111", 300);
        var first = JsonDocument.Parse(handler.LastBody!).RootElement.GetProperty("tracking_id").GetString();
        await sender.SendAsync("0912345678", "222222", 300);
        var second = JsonDocument.Parse(handler.LastBody!).RootElement.GetProperty("tracking_id").GetString();

        second.Should().NotBe(first);
    }

    [Fact]
    public async Task Token_bị_từ_chối_thì_làm_mới_rồi_gửi_lại_một_lần()
    {
        // Access token có thể bị thu hồi trước hạn ghi trong DB (đổi secret, gỡ quyền),
        // nên "hạn còn xa" không chứng minh được token còn dùng được.
        var calls = 0;
        var handler = new FakeHandler(_ =>
        {
            calls++;
            return Json(calls == 1
                ? "{\"error\":-124,\"message\":\"Access token invalid\"}"
                : "{\"error\":0}");
        });
        var store = new FakeTokenStore();

        await Create(handler, tokenStore: store).SendAsync("0912345678", "123456", 300);

        calls.Should().Be(2);
        store.Invalidated.Should().BeTrue();
    }

    [Fact]
    public async Task Thất_bại_hai_lần_liên_tiếp_thì_không_thử_vô_hạn()
    {
        // Thử lại mãi trên một request đồng bộ là để khách chờ đến hết timeout.
        var calls = 0;
        var handler = new FakeHandler(_ =>
        {
            calls++;
            return Json("{\"error\":-124,\"message\":\"Access token invalid\"}");
        });

        var act = () => Create(handler).SendAsync("0912345678", "123456", 300);

        await act.Should().ThrowAsync<Exception>();
        calls.Should().Be(2);
    }

    [Fact]
    public async Task Lỗi_mạng_thành_OtpDeliveryException()
    {
        // Phải là OtpDeliveryException chứ không phải HttpRequestException trần: tầng
        // HTTP dịch loại đầu thành 503 ("thử lại sau"), loại sau rơi vào nhánh 500.
        var handler = new FakeHandler(_ => throw new HttpRequestException("mạng hỏng"));

        var act = () => Create(handler).SendAsync("0912345678", "123456", 300);

        await act.Should().ThrowAsync<OtpDeliveryException>();
    }

    [Fact]
    public async Task Không_bao_giờ_lộ_mã_ra_response()
    {
        var handler = new FakeHandler(_ => Json("{\"error\":0}"));
        Create(handler).RevealsCode.Should().BeFalse();
        await Task.CompletedTask;
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json"),
    };

    private sealed class FakeHandler(Func<HttpRequestMessage, HttpResponseMessage> respond)
        : HttpMessageHandler
    {
        public string? LastBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken ct)
        {
            if (request.Content is not null)
                LastBody = await request.Content.ReadAsStringAsync(ct);
            return respond(request);
        }
    }

    private sealed class FakeHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class FakeTokenStore : IZaloTokenStore
    {
        public bool Invalidated { get; private set; }
        public Task<string> GetAccessTokenAsync(CancellationToken ct = default) => Task.FromResult("token");
        public Task InvalidateAsync(CancellationToken ct = default)
        {
            Invalidated = true;
            return Task.CompletedTask;
        }
    }
}
