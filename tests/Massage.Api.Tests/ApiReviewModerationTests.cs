using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;

namespace Massage.Api.Tests;

/// <summary>
/// Hàng đợi rà soát đánh giá của admin.
///
/// Tồn tại vì trước đây admin gỡ được một đánh giá (<c>PATCH .../moderate</c>) nhưng
/// không có đường nào **tìm ra** đánh giá đáng gỡ — cơ chế kiểm duyệt chỉ chạy khi
/// có người báo cáo.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiReviewModerationTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private sealed record Row(
        Guid Id,
        Guid KtvId,
        string KtvFullName,
        short Rating,
        string? Comment,
        string Status,
        bool HasLead,
        double AuthorAccountAgeHours);

    private sealed record Page(List<Row> Items, int Total, int PageNo, int Limit);

    [Fact]
    public async Task Lead_của_khách_đã_đăng_nhập_mang_theo_id_tài_khoản()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);

        // Gọi kèm token — đúng đường mà route /api/leads của Next dùng.
        var lead = await client.PostAsJsonAsync(
            "/api/v1/leads", new { ktvId = ktv.Id, channel = "CALL" });
        lead.StatusCode.Should().Be(HttpStatusCode.OK);

        await client.PostAsJsonAsync(
            $"/api/v1/ktv/{ktv.Id}/reviews", new { rating = 5, comment = "đã dùng thật" });

        var admin = await _api.LoginAdminAsync();
        var res = await admin.GetAsync("/api/v1/admin/reviews?limit=200");
        var page = await res.Content.ReadFromJsonAsync<Page>();

        page!.Items.Single(i => i.KtvId == ktv.Id).HasLead.Should().BeTrue(
            "đây là cả điểm của việc sửa lỗ token ở đường ghi lead: không có "
            + "customer_user_id thì không đánh giá nào gắn được với một lượt liên hệ thật");
    }

    [Fact]
    public async Task Đánh_giá_không_có_lead_bị_đánh_dấu_nhưng_vẫn_hiển_thị()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);
        await client.PostAsJsonAsync(
            $"/api/v1/ktv/{ktv.Id}/reviews", new { rating = 5, comment = "chưa liên hệ" });

        // Vẫn nằm trong danh sách công khai: dấu hiệu này để admin xem, không phải
        // để tự động ẩn.
        var côngKhai = await _api.CreateClient().GetAsync($"/api/v1/ktv/{ktv.Id}/reviews");
        côngKhai.StatusCode.Should().Be(HttpStatusCode.OK);

        var admin = await _api.LoginAdminAsync();
        var page = await (await admin.GetAsync("/api/v1/admin/reviews?unverifiedOnly=true&limit=200"))
            .Content.ReadFromJsonAsync<Page>();

        page!.Items.Should().Contain(i => i.KtvId == ktv.Id && !i.HasLead);
    }

    [Fact]
    public async Task KTV_không_đọc_được_hàng_đợi_rà_soát()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.GetAsync("/api/v1/admin/reviews");

        res.StatusCode.Should().Be(
            HttpStatusCode.Forbidden,
            "hàng đợi lộ id tài khoản người viết — để KTV bị đánh giá xấu đọc được là "
            + "biến cơ chế kiểm duyệt thành đường tìm ra người đã chấm điểm mình");
    }

    [Fact]
    public async Task Admin_gỡ_được_đánh_giá_tìm_thấy_từ_hàng_đợi()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);
        await client.PostAsJsonAsync(
            $"/api/v1/ktv/{ktv.Id}/reviews", new { rating = 1, comment = "spam" });

        var admin = await _api.LoginAdminAsync();
        var page = await (await admin.GetAsync("/api/v1/admin/reviews?unverifiedOnly=true&limit=200"))
            .Content.ReadFromJsonAsync<Page>();
        var dòng = page!.Items.Single(i => i.KtvId == ktv.Id);

        var gỡ = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/reviews/{dòng.Id}/moderate",
            new { status = "REJECTED", rejectionReason = "Đánh giá không có thật" });

        gỡ.StatusCode.Should().Be(HttpStatusCode.OK);

        // Gỡ xong phải tính lại rating: rating đi thẳng vào AggregateRating gửi cho
        // Google, nên để nó giữ điểm của một đánh giá đã gỡ là sai lệch dữ liệu
        // structured data chứ không chỉ hiển thị xấu.
        await using var đọcLại = fixture.CreateContext();
        var sau = await đọcLại.KtvProfiles.FindAsync(ktv.Id);
        sau!.RatingCount.Should().Be(0);
    }

    [Fact]
    public async Task Tham_số_phân_trang_sai_bị_400()
    {
        var admin = await _api.LoginAdminAsync();

        var res = await admin.GetAsync("/api/v1/admin/reviews?limit=999");

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
