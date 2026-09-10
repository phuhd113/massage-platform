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
/// Ảnh đại diện phải qua duyệt (2026-09-10).
///
/// Bất biến quan trọng nhất được canh ở đây: <b><c>avatar_key</c> chỉ chứa ảnh đã được
/// duyệt</b>. Trước đó avatar hiện ngay, và lỗ hổng là hồ sơ đã VERIFIED đổi ảnh bất cứ
/// lúc nào mà không lượt nào lọt vào mắt ai — ở đúng tấm ảnh lớn nhất trên trang công
/// khai, trong ngành mà Google phạt cả tên miền khi phân loại nhầm.
///
/// Vế thứ hai, cũng dễ hỏng khi ai đó "gọn hoá": <b>ảnh cũ phải ở nguyên trên sàn trong
/// lúc bản mới chờ duyệt</b>. Mất vế này thì đổi ảnh nghĩa là mất hiển thị vài giờ, và
/// KTV sẽ học được rằng đừng bao giờ đổi ảnh — tức tính năng tự vô hiệu hoá chính nó.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiAvatarModerationTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private static byte[] TinyPng() => Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent ImageForm(string name = "anh.png")
    {
        var content = new ByteArrayContent(TinyPng());
        content.Headers.ContentType = new MediaTypeHeaderValue("image/png");

        return new MultipartFormDataContent { { content, "file", name } };
    }

    private async Task<(HttpClient Client, Guid KtvId)> KtvWithProfileAsync(
        string status = VerificationStatuses.Verified, string? avatarKey = null)
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
            AvatarKey = avatarKey,
        };
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync();

        return (client, profile.Id);
    }

    [Fact(DisplayName = "Gửi ảnh đại diện KHÔNG đổi ảnh đang hiển thị công khai")]
    public async Task Gửi_ảnh_không_đổi_ảnh_công_khai()
    {
        var (client, ktvId) = await KtvWithProfileAsync(avatarKey: "avatars/2026/09/cu.png");

        var res = await client.PutAsync("/api/v1/ktv/profile/avatar", ImageForm());
        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var p = await db.KtvProfiles.AsNoTracking().FirstAsync(x => x.Id == ktvId);

        // Vế quan trọng nhất của cả file: ảnh công khai không đổi một ký tự.
        p.AvatarKey.Should().Be("avatars/2026/09/cu.png",
            "ảnh đang hiển thị phải ở nguyên trên sàn cho tới khi bản mới được duyệt");

        p.PendingAvatarKey.Should().NotBeNull().And.NotBe(p.AvatarKey);
        p.AvatarVerifyStatus.Should().Be(VerificationStatuses.Pending);
        p.AvatarSubmittedAt.Should().NotBeNull();
    }

    [Fact(DisplayName = "Admin duyệt thì ảnh chờ thay ảnh đang hiển thị")]
    public async Task Duyệt_thì_ảnh_chờ_lên_sàn()
    {
        var (client, ktvId) = await KtvWithProfileAsync(avatarKey: "avatars/2026/09/cu.png");
        await client.PutAsync("/api/v1/ktv/profile/avatar", ImageForm());

        string? pendingKey;
        await using (var db = fixture.CreateContext())
            pendingKey = (await db.KtvProfiles.AsNoTracking().FirstAsync(x => x.Id == ktvId))
                .PendingAvatarKey;

        var admin = await _api.LoginAdminAsync();
        var res = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/ktv/{ktvId}/avatar/verify",
            new { decision = VerificationStatuses.Verified, reason = (string?)null });

        res.StatusCode.Should().Be(HttpStatusCode.NoContent, _api.ErrorsOrEmpty());

        await using var after = fixture.CreateContext();
        var p = await after.KtvProfiles.AsNoTracking().FirstAsync(x => x.Id == ktvId);

        p.AvatarKey.Should().Be(pendingKey);
        p.PendingAvatarKey.Should().BeNull("duyệt xong thì không còn gì đang chờ");
        p.AvatarVerifyStatus.Should().Be(VerificationStatuses.Verified);
    }

    [Fact(DisplayName = "Admin từ chối thì ảnh đang hiển thị giữ nguyên")]
    public async Task Từ_chối_thì_giữ_ảnh_cũ()
    {
        var (client, ktvId) = await KtvWithProfileAsync(avatarKey: "avatars/2026/09/cu.png");
        await client.PutAsync("/api/v1/ktv/profile/avatar", ImageForm());

        var admin = await _api.LoginAdminAsync();
        var res = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/ktv/{ktvId}/avatar/verify",
            new { decision = VerificationStatuses.Rejected, reason = "Ảnh không rõ mặt" });

        res.StatusCode.Should().Be(HttpStatusCode.NoContent, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var p = await db.KtvProfiles.AsNoTracking().FirstAsync(x => x.Id == ktvId);

        // Từ chối là "không dùng ảnh mới", không phải "phạt hồ sơ này bằng cách gỡ ảnh".
        p.AvatarKey.Should().Be("avatars/2026/09/cu.png");
        p.PendingAvatarKey.Should().BeNull();
        p.AvatarVerifyStatus.Should().Be(VerificationStatuses.Rejected);
        p.AvatarRejectionReason.Should().Be("Ảnh không rõ mặt",
            "KTV phải đọc được lý do, nếu không họ gửi lại đúng tấm ảnh đó");
    }

    [Fact(DisplayName = "Duyệt hồ sơ mới thì duyệt kèm ảnh đại diện đang chờ")]
    public async Task Duyệt_hồ_sơ_thì_duyệt_kèm_avatar()
    {
        var (client, ktvId) = await KtvWithProfileAsync(VerificationStatuses.Pending);
        await client.PutAsync("/api/v1/ktv/profile/avatar", ImageForm());

        // Hai điều kiện bắt buộc để hồ sơ sang VERIFIED.
        await using (var db = fixture.CreateContext())
        {
            db.IdentityDocuments.Add(new IdentityDocument
            {
                KtvId = ktvId,
                FrontKey = "identity/2026/09/f.png",
                BackKey = "identity/2026/09/b.png",
                VerifyStatus = VerificationStatuses.Verified,
                SubmittedAt = DateTimeOffset.UtcNow,
            });
            await db.KtvProfiles.Where(p => p.Id == ktvId)
                .ExecuteUpdateAsync(s => s.SetProperty(
                    p => p.CommitmentVersion, KtvCommitments.CurrentVersion));
            await db.SaveChangesAsync();
        }

        var admin = await _api.LoginAdminAsync();
        var res = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/ktv/{ktvId}/verify",
            new { decision = VerificationStatuses.Verified, reason = (string?)null });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        await using var after = fixture.CreateContext();
        var p = await after.KtvProfiles.AsNoTracking().FirstAsync(x => x.Id == ktvId);

        // Admin vừa xem cả hồ sơ lẫn CCCD của người này, và avatar nằm ngay trước mắt —
        // bắt nó đi vòng qua hàng đợi riêng nghĩa là hồ sơ vừa duyệt xong lên sàn mà
        // không có ảnh, tức chặn đúng nhóm cần được nhìn thấy nhất.
        p.AvatarKey.Should().NotBeNull();
        p.PendingAvatarKey.Should().BeNull();
        p.AvatarVerifyStatus.Should().Be(VerificationStatuses.Verified);
    }

    [Fact(DisplayName = "Ảnh chờ duyệt không bao giờ ra trang công khai")]
    public async Task Ảnh_chờ_không_ra_trang_công_khai()
    {
        var (client, ktvId) = await KtvWithProfileAsync();
        await client.PutAsync("/api/v1/ktv/profile/avatar", ImageForm());

        string? pendingKey;
        await using (var db = fixture.CreateContext())
            pendingKey = (await db.KtvProfiles.AsNoTracking().FirstAsync(x => x.Id == ktvId))
                .PendingAvatarKey;

        var anon = _api.CreateClient();
        var res = await anon.GetAsync($"/api/v1/ktv/{ktvId}");

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        var body = await res.Content.ReadAsStringAsync();

        // Hồ sơ này chưa có avatar đã duyệt, nên trang công khai phải nói "không có ảnh"
        // chứ không được rò key của tấm đang chờ.
        body.Should().NotContain(pendingKey!.Split('/')[^1],
            "key của ảnh chưa duyệt không được xuất hiện ở bất kỳ đâu trên đường công khai");
    }

    [Fact(DisplayName = "Gỡ ảnh xoá cả bản đang hiển thị lẫn bản chờ duyệt")]
    public async Task Gỡ_ảnh_xoá_cả_hai()
    {
        var (client, ktvId) = await KtvWithProfileAsync(avatarKey: "avatars/2026/09/cu.png");
        await client.PutAsync("/api/v1/ktv/profile/avatar", ImageForm());

        var res = await client.DeleteAsync("/api/v1/ktv/profile/avatar");
        res.StatusCode.Should().Be(HttpStatusCode.NoContent, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var p = await db.KtvProfiles.AsNoTracking().FirstAsync(x => x.Id == ktvId);

        // Chỉ xoá bản đang hiển thị sẽ để một ảnh chờ duyệt sống sót rồi tự lên sàn khi
        // admin duyệt — tức ảnh KTV đã chủ động gỡ lại xuất hiện, muộn vài giờ.
        p.AvatarKey.Should().BeNull();
        p.PendingAvatarKey.Should().BeNull();
        p.AvatarVerifyStatus.Should().BeNull();
    }

    [Fact(DisplayName = "Không có ảnh nào đang chờ thì duyệt trả 400")]
    public async Task Không_có_ảnh_chờ_thì_400()
    {
        var (_, ktvId) = await KtvWithProfileAsync();

        var admin = await _api.LoginAdminAsync();
        var res = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/ktv/{ktvId}/avatar/verify",
            new { decision = VerificationStatuses.Verified, reason = (string?)null });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact(DisplayName = "Token của tài khoản đã bị xoá trả 401, không phải 500")]
    public async Task Token_của_tài_khoản_đã_xoá_trả_401()
    {
        var (client, userId, _) = await _api.LoginAsync(UserRoles.Ktv);

        // Tài khoản biến mất trong khi token còn hạn: quyền bị thu hồi, hoặc admin dọn
        // dữ liệu. JWT không thu hồi được nên chữ ký vẫn hợp lệ.
        await using (var db = fixture.CreateContext())
            await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync();

        var res = await client.GetAsync("/api/v1/ktv/profile/me");

        // Trước 2026-09-10 request kiểu này đi tiếp bình thường rồi vỡ ở tận khoá ngoại
        // `verified_by` dưới DB — một 500 kèm câu "Đã có lỗi xảy ra" mà người thao tác
        // không suy ra được gì. 401 thì frontend đưa họ về màn hình đăng nhập, đúng việc
        // họ cần làm. Đã gặp thật ở trang duyệt ảnh.
        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact(DisplayName = "KTV không tự duyệt được ảnh đại diện của mình")]
    public async Task KTV_không_tự_duyệt_được()
    {
        var (client, ktvId) = await KtvWithProfileAsync();
        await client.PutAsync("/api/v1/ktv/profile/avatar", ImageForm());

        var res = await client.PatchAsJsonAsync(
            $"/api/v1/admin/ktv/{ktvId}/avatar/verify",
            new { decision = VerificationStatuses.Verified, reason = (string?)null });

        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
