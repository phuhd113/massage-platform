using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Reports.Entities;

namespace Massage.Api.Tests;

/// <summary>
/// Luồng báo cáo vi phạm ở tầng HTTP.
///
/// Tầng này bắt những thứ test service không thấy: khách chưa đăng nhập vẫn gửi được
/// báo cáo (nếu vô tình thêm <c>[Authorize]</c> thì service vẫn xanh còn nút trên trang
/// công khai chết), lỗi nghiệp vụ ra đúng mã HTTP, và hàng đợi chỉ admin đọc được.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiReportTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private sealed record Created(Guid Id, DateTimeOffset CreatedAt, bool Deduplicated);

    [Fact]
    public async Task Khách_chưa_đăng_nhập_vẫn_gửi_được_báo_cáo()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var res = await _api.CreateClient().PostAsJsonAsync(
            "/api/v1/reports",
            new { ktvId = ktv.Id, reason = ProfileReportReasons.Prostitution, detail = "Có dấu hiệu trá hình" });

        res.StatusCode.Should().Be(
            HttpStatusCode.OK,
            "người nhìn thấy nội dung vi phạm trên trang công khai gần như luôn là khách vãng "
            + "lai — bắt đăng nhập là chặn đúng nhóm có nhiều khả năng báo cáo nhất");

        var created = await res.Content.ReadFromJsonAsync<Created>();
        created!.Id.Should().NotBeEmpty();
        created.Deduplicated.Should().BeFalse();
    }

    [Fact]
    public async Task Lý_do_không_hợp_lệ_bị_400()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var res = await _api.CreateClient().PostAsJsonAsync(
            "/api/v1/reports", new { ktvId = ktv.Id, reason = "KHONG_CO_LY_DO_NAY" });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Chọn_lý_do_khác_mà_không_mô_tả_thì_bị_400()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var res = await _api.CreateClient().PostAsJsonAsync(
            "/api/v1/reports", new { ktvId = ktv.Id, reason = ProfileReportReasons.Other });

        res.StatusCode.Should().Be(
            HttpStatusCode.BadRequest,
            "OTHER mà không mô tả thì admin không có gì để xử lý — dòng đó chỉ làm dài hàng đợi");
    }

    [Fact]
    public async Task Hồ_sơ_không_tồn_tại_thì_bị_404_chứ_không_phải_500()
    {
        var res = await _api.CreateClient().PostAsJsonAsync(
            "/api/v1/reports",
            new { ktvId = Guid.NewGuid(), reason = ProfileReportReasons.Misconduct });

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task KTV_không_đọc_được_hàng_đợi_báo_cáo()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.GetAsync("/api/v1/admin/reports");

        res.StatusCode.Should().Be(
            HttpStatusCode.Forbidden,
            "hàng đợi chứa ip và mô tả của người báo cáo — để KTV bị báo cáo đọc được là "
            + "biến cơ chế bảo vệ thành đường tìm ra người đã tố giác");
    }

    [Fact]
    public async Task Admin_đọc_được_hàng_đợi_và_chốt_được_báo_cáo()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var gửi = await _api.CreateClient().PostAsJsonAsync(
            "/api/v1/reports",
            new { ktvId = ktv.Id, reason = ProfileReportReasons.InappropriateContent, detail = "Ảnh phản cảm" });
        var báoCáo = (await gửi.Content.ReadFromJsonAsync<Created>())!;

        var admin = await _api.LoginAdminAsync();

        var hàngĐợi = await admin.GetAsync("/api/v1/admin/reports?status=PENDING&limit=100");
        hàngĐợi.StatusCode.Should().Be(HttpStatusCode.OK);

        var chốt = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/reports/{báoCáo.Id}/resolve",
            new { decision = ProfileReportStatuses.ActionTaken, note = "Đã yêu cầu đổi ảnh" });

        chốt.StatusCode.Should().Be(HttpStatusCode.OK);

        // Chốt lần hai phải là 409, không phải ghi đè im lặng: hai admin mở cùng một
        // hàng đợi là chuyện bình thường.
        var chốtLại = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/reports/{báoCáo.Id}/resolve",
            new { decision = ProfileReportStatuses.Dismissed, note = (string?)null });

        chốtLại.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Trạng_thái_lọc_không_hợp_lệ_bị_400()
    {
        var admin = await _api.LoginAdminAsync();

        var res = await admin.GetAsync("/api/v1/admin/reports?status=KHONG_CO");

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Hàng_đợi_rỗng_trả_về_danh_sách_rỗng_chứ_không_phải_404()
    {
        var admin = await _api.LoginAdminAsync();

        // DISMISSED gần như luôn rỗng ở database test. Đây chính là hình dạng lỗi đã
        // từng lọt qua hai tầng test kia: endpoint trả 404 cho danh sách rỗng làm hỏng
        // màn hình của người vừa mở lần đầu.
        var res = await admin.GetAsync($"/api/v1/admin/reports?status={ProfileReportStatuses.Dismissed}");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
