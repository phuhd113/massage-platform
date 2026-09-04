using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;

namespace Massage.Api.Tests;

/// <summary>
/// Trang tài khoản khách đọc dữ liệu của chính mình qua <c>GET /me/reviews</c>.
///
/// Tầng HTTP bắt đúng thứ test service không thấy: endpoint lấy id người dùng từ
/// token chứ không từ tham số, và danh sách rỗng phải là 200 chứ không phải 404 —
/// đúng hình dạng lỗi từng làm hỏng dashboard của KTV vừa đăng ký.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiMyReviewTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private sealed record MyReview(
        Guid Id,
        Guid KtvId,
        string KtvFullName,
        string KtvSlug,
        short Rating,
        string? Comment,
        string Status);

    [Fact]
    public async Task Khách_đọc_lại_được_đánh_giá_mình_vừa_viết()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);

        var gửi = await client.PostAsJsonAsync(
            $"/api/v1/ktv/{ktv.Id}/reviews", new { rating = 5, comment = "Rất hài lòng" });
        gửi.StatusCode.Should().Be(HttpStatusCode.OK);

        var res = await client.GetAsync("/api/v1/me/reviews");
        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var items = await res.Content.ReadFromJsonAsync<List<MyReview>>();
        var dòng = items.Should().ContainSingle().Subject;

        dòng.KtvId.Should().Be(ktv.Id);
        dòng.Comment.Should().Be("Rất hài lòng");
        // Tên và slug đi kèm để dựng /ktv/{slug}-{id} mà không phải gọi thêm một
        // lượt cho mỗi dòng.
        dòng.KtvFullName.Should().Be(ktv.FullName);
        dòng.KtvSlug.Should().Be(ktv.Slug);
    }

    [Fact]
    public async Task Không_đọc_được_đánh_giá_của_người_khác()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var (ngườiKhác, _, _) = await _api.LoginAsync(UserRoles.Customer);
        await ngườiKhác.PostAsJsonAsync(
            $"/api/v1/ktv/{ktv.Id}/reviews", new { rating = 1, comment = "của người khác" });

        var (tôi, _, _) = await _api.LoginAsync(UserRoles.Customer);
        var res = await tôi.GetAsync("/api/v1/me/reviews");

        var items = await res.Content.ReadFromJsonAsync<List<MyReview>>();
        items.Should().BeEmpty(
            "endpoint lấy id người dùng từ token, không nhận tham số từ ngoài — "
            + "một id trên query string là đường đọc đánh giá của người khác");
    }

    [Fact]
    public async Task Tài_khoản_mới_nhận_danh_sách_rỗng_chứ_không_phải_404()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);

        var res = await client.GetAsync("/api/v1/me/reviews");

        res.StatusCode.Should().Be(
            HttpStatusCode.OK,
            "404 cho danh sách rỗng làm hỏng màn hình của người vừa tạo tài khoản — "
            + "đúng hình dạng lỗi đã gặp ở /ktv/campaigns");

        (await res.Content.ReadFromJsonAsync<List<MyReview>>()).Should().BeEmpty();
    }

    [Fact]
    public async Task KTV_cũng_đọc_được_đánh_giá_mình_viết_cho_người_khác()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktvKhác = await TestData.CreateKtvAsync(db, lat, lon);

        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        await client.PostAsJsonAsync(
            $"/api/v1/ktv/{ktvKhác.Id}/reviews", new { rating = 4, comment = "đồng nghiệp tốt" });

        var res = await client.GetAsync("/api/v1/me/reviews");

        res.StatusCode.Should().Be(
            HttpStatusCode.OK,
            "endpoint này theo tài khoản chứ không theo vai trò: KTV cũng là khách của KTV khác");
        (await res.Content.ReadFromJsonAsync<List<MyReview>>()).Should().ContainSingle();
    }
}
