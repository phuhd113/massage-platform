using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Massage.Api.Tests;

/// <summary>
/// Cam kết của kỹ thuật viên — điều kiện bắt buộc thứ hai để hồ sơ được duyệt.
///
/// Đây là tài liệu pháp lý, nên phần đáng test nhất không phải "tick được hay không"
/// mà là **bằng chứng còn lại sau đó**: đồng ý với bản nào, lúc nào. Một cờ boolean
/// vẫn làm mọi test hành vi xanh trong khi bằng chứng thì vô dụng.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiCommitmentTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private async Task<(HttpClient Client, Guid KtvId)> KtvWithProfileAsync()
    {
        var (client, userId, _) = await _api.LoginAsync(UserRoles.Ktv);

        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var profile = new KtvProfile
        {
            UserId = userId,
            FullName = $"KTV {Guid.NewGuid():N}"[..20],
            Slug = $"ktv-{Guid.NewGuid():N}"[..24],
            BasePoint = new Point(lon, lat) { SRID = 4326 },
            VerificationStatus = VerificationStatuses.Pending,
        };
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync();

        return (client, profile.Id);
    }

    private static byte[] Png() => Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent TwoSides()
    {
        var content = new MultipartFormDataContent();
        foreach (var field in new[] { "front", "back" })
        {
            var part = new ByteArrayContent(Png());
            part.Headers.ContentType = new MediaTypeHeaderValue("image/png");
            content.Add(part, field, $"{field}.png");
        }
        return content;
    }

    private sealed record Commitments(int Version, List<string> Items);

    [Fact]
    public async Task Nội_dung_cam_kết_đọc_được_không_cần_đăng_nhập()
    {
        var res = await _api.CreateClient().GetAsync("/api/v1/ktv/commitments");

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        var body = await res.ReadAsync<Commitments>();
        body!.Version.Should().Be(KtvCommitments.CurrentVersion);
        body.Items.Should().HaveCount(KtvCommitments.Items.Count);

        // Hai dòng chi phối nhất về mặt rủi ro tên miền: nếu ai đó rút gọn danh sách
        // thì phải là một quyết định tường minh, không phải một lần sửa vô tình.
        string.Join(" ", body.Items).Should().Contain("mại dâm");
        string.Join(" ", body.Items).Should().Contain("massage");
    }

    [Fact]
    public async Task Chấp_nhận_cam_kết_thì_lưu_lại_phiên_bản_và_thời_điểm()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile/commitments",
            new { Version = KtvCommitments.CurrentVersion });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId);

        profile.CommitmentVersion.Should().Be(KtvCommitments.CurrentVersion);
        profile.CommittedAt.Should().NotBeNull(
            "không có mốc thời gian thì bằng chứng đồng ý không dùng được khi tranh chấp");
    }

    [Fact]
    public async Task Gửi_phiên_bản_cũ_thì_bị_từ_chối()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        // Tab mở từ trước lúc cam kết được cập nhật: màn hình người dùng đang đọc là
        // bản cũ, nên ghi nhận họ đồng ý với bản mới là ghi nhận một điều không có thật.
        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile/commitments",
            new { Version = KtvCommitments.CurrentVersion - 1 });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        await using var db = fixture.CreateContext();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId);
        profile.CommitmentVersion.Should().Be(0);
    }

    [Fact]
    public async Task Hồ_sơ_mới_chưa_cam_kết_gì()
    {
        var (_, ktvId) = await KtvWithProfileAsync();

        await using var db = fixture.CreateContext();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId);

        profile.CommitmentVersion.Should().Be(0,
            "mặc định phải là chưa đồng ý — tự gán là tạo bằng chứng giả");
        profile.CommittedAt.Should().BeNull();
    }

    [Fact]
    public async Task Không_duyệt_được_hồ_sơ_khi_chưa_chấp_nhận_cam_kết()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        // CCCD đã xong hết, chỉ thiếu cam kết: cô lập đúng một điều kiện.
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        var admin = await _api.LoginAdminAsync();
        await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/identity/verify",
            new { Decision = VerificationStatuses.Verified });

        var res = await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Verified });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.ProblemTitleAsync()).Should().Contain("cam kết");
    }

    [Fact]
    public async Task Đủ_CCCD_và_cam_kết_thì_duyệt_được()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        await client.PostAsJsonAsync("/api/v1/ktv/profile/commitments",
            new { Version = KtvCommitments.CurrentVersion });

        var admin = await _api.LoginAdminAsync();
        await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/identity/verify",
            new { Decision = VerificationStatuses.Verified });

        var res = await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Verified });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
    }

    [Fact]
    public async Task Khách_không_chấp_nhận_cam_kết_KTV_được()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile/commitments",
            new { Version = KtvCommitments.CurrentVersion });

        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
