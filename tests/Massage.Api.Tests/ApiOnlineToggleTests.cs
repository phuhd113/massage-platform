using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Massage.Api.Tests;

/// <summary>
/// Công tắc "đang nhận khách".
///
/// Điều đáng canh nhất ở đây không phải là cột có đổi giá trị hay không — mà là nó
/// <b>không</b> kéo theo việc duyệt lại hồ sơ. Bật/tắt là thao tác KTV làm nhiều lần
/// mỗi ngày; nối nó vào <c>PATCH /ktv/profile</c> cho gọn sẽ khiến mỗi lần tắt máy đi
/// ngủ là một lần hồ sơ rớt khỏi kết quả tìm kiếm chờ admin duyệt lại, và không có gì
/// báo cho KTV biết điều đó vừa xảy ra. Test này là thứ chặn lần "gọn hoá" đó.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiOnlineToggleTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private async Task<(HttpClient Client, Guid KtvId)> KtvWithProfileAsync(string status)
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
            VerificationStatus = status,
            IsOnline = false,
        };
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync();

        return (client, profile.Id);
    }

    [Fact(DisplayName = "Bật nhận khách thì ghi được xuống DB")]
    public async Task Bật_nhận_khách_ghi_xuống_DB()
    {
        var (client, ktvId) = await KtvWithProfileAsync(VerificationStatuses.Pending);

        var res = await client.PutAsJsonAsync("/api/v1/ktv/profile/online", new { isOnline = true });

        res.StatusCode.Should().Be(HttpStatusCode.OK);

        // DbContext mới: ExecuteUpdate ghi thẳng xuống DB và bỏ qua change tracker, nên
        // đọc lại bằng context cũ sẽ trúng entity còn nằm trong tracker.
        await using var db = fixture.CreateContext();
        (await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId))
            .IsOnline.Should().BeTrue();
    }

    [Fact(DisplayName = "Tắt nhận khách KHÔNG đưa hồ sơ đã duyệt về chờ duyệt lại")]
    public async Task Tắt_nhận_khách_không_bắt_duyệt_lại()
    {
        var (client, ktvId) = await KtvWithProfileAsync(VerificationStatuses.Verified);

        // Bật rồi tắt: đúng nhịp KTV dùng công tắc này trong một ngày làm việc.
        await client.PutAsJsonAsync("/api/v1/ktv/profile/online", new { isOnline = true });
        var res = await client.PutAsJsonAsync("/api/v1/ktv/profile/online", new { isOnline = false });

        res.StatusCode.Should().Be(HttpStatusCode.OK);

        await using var db = fixture.CreateContext();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId);

        profile.IsOnline.Should().BeFalse();

        // Vế quan trọng nhất của cả file: hồ sơ vẫn VERIFIED. Nếu đường này đi qua
        // UpdateAsync thì nó đã là PENDING, và hồ sơ đã biến mất khỏi tìm kiếm.
        profile.VerificationStatus.Should().Be(VerificationStatuses.Verified);
    }

    [Fact(DisplayName = "Bật tắt nhận khách không đẩy UpdatedAt của hồ sơ")]
    public async Task Không_đẩy_UpdatedAt()
    {
        var (client, ktvId) = await KtvWithProfileAsync(VerificationStatuses.Verified);

        DateTimeOffset before;
        await using (var db = fixture.CreateContext())
            before = (await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId)).UpdatedAt;

        await client.PutAsJsonAsync("/api/v1/ktv/profile/online", new { isOnline = true });

        await using var after = fixture.CreateContext();

        // UpdatedAt là "hồ sơ đổi nội dung lần cuối lúc nào" và sitemap đọc nó làm
        // lastmod. Bật/tắt trong ngày không đổi một chữ nào trên trang, nên đẩy cột này
        // lên là khai với Google rằng hàng trăm trang vừa được sửa.
        (await after.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId))
            .UpdatedAt.Should().Be(before);
    }

    [Fact(DisplayName = "Chưa có hồ sơ thì bật nhận khách trả 404")]
    public async Task Chưa_có_hồ_sơ_thì_404()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PutAsJsonAsync("/api/v1/ktv/profile/online", new { isOnline = true });

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact(DisplayName = "Tài khoản khách không bật được nhận khách")]
    public async Task Khách_không_bật_được()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);

        var res = await client.PutAsJsonAsync("/api/v1/ktv/profile/online", new { isOnline = true });

        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
