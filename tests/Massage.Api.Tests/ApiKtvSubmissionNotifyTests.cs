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
/// Email báo ban quản trị khi hồ sơ KTV hoàn tất và chờ duyệt.
///
/// Điều đáng test không phải "có gửi được email không" mà là <b>gửi đúng một lần, đúng
/// lúc</b>: điều kiện gồm hai thao tác độc lập (ký cam kết, gửi CCCD) đến theo thứ tự bất
/// kỳ, nên chỗ dễ hỏng là gửi hai lần cho cùng một người, hoặc không gửi lần nào với nửa
/// số KTV làm theo thứ tự ngược lại.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiKtvSubmissionNotifyTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;
    private FakeEmailSender _email = null!;

    public Task InitializeAsync()
    {
        _email = new FakeEmailSender();
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource) { EmailSender = _email };
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private async Task<(HttpClient Client, Guid KtvId, string Phone)> KtvWithProfileAsync()
    {
        var (client, userId, phone) = await _api.LoginAsync(UserRoles.Ktv);

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

        return (client, profile.Id, phone);
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

    private Task<HttpResponseMessage> AcceptCommitmentsAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/v1/ktv/profile/commitments",
            new { Version = KtvCommitments.CurrentVersion });

    [Fact]
    public async Task Chỉ_cam_kết_thôi_thì_chưa_báo()
    {
        var (client, _, _) = await KtvWithProfileAsync();

        (await AcceptCommitmentsAsync(client)).EnsureSuccessStatusCode();

        _email.Sent.Should().BeEmpty(
            "chưa có CCCD thì admin mở trang duyệt ra cũng không có gì để xem");
    }

    [Fact]
    public async Task Chỉ_gửi_CCCD_thôi_thì_chưa_báo()
    {
        var (client, _, _) = await KtvWithProfileAsync();

        (await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides())).EnsureSuccessStatusCode();

        _email.Sent.Should().BeEmpty("thiếu cam kết thì hồ sơ chưa duyệt được");
    }

    [Fact]
    public async Task Cam_kết_rồi_gửi_CCCD_thì_báo_đúng_một_lần()
    {
        var (client, _, phone) = await KtvWithProfileAsync();

        await AcceptCommitmentsAsync(client);
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        _email.Sent.Should().HaveCount(1, _api.ErrorsOrEmpty());
        _email.Sent[0].To.Should().Contain("admin@test.local");
        _email.Sent[0].Subject.Should().Contain("chờ duyệt");

        // Số điện thoại là thứ duy nhất trong email cho phép liên hệ KTV — thiếu nó thì
        // admin phải đi tra ngược bằng SQL hoặc bằng tên, mà tên thì trùng được.
        _email.Sent[0].Body.Should().Contain(phone);
    }

    [Fact]
    public async Task Gửi_CCCD_trước_rồi_cam_kết_cũng_báo_đúng_một_lần()
    {
        var (client, _, _) = await KtvWithProfileAsync();

        // Thứ tự ngược lại của test trên. Đây chính là lý do việc kiểm tra nằm ở **cả
        // hai** đường ghi: đặt ở một chỗ thì đúng một nửa số KTV không sinh thông báo nào.
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        await AcceptCommitmentsAsync(client);

        _email.Sent.Should().HaveCount(1, _api.ErrorsOrEmpty());
    }

    [Fact]
    public async Task Cam_kết_lại_không_sinh_thêm_email()
    {
        var (client, _, _) = await KtvWithProfileAsync();

        await AcceptCommitmentsAsync(client);
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        // KTV bấm lại nút cam kết (F5, hoặc mở hai tab). Không có cột chống trùng thì
        // mỗi lần bấm là một email cho cùng một hồ sơ, và kênh thông báo tự làm mình
        // mất tin cậy.
        await AcceptCommitmentsAsync(client);
        await AcceptCommitmentsAsync(client);

        _email.Sent.Should().HaveCount(1);
    }

    [Fact]
    public async Task Gửi_lại_CCCD_sau_khi_bị_từ_chối_thì_báo_lần_nữa()
    {
        var (client, ktvId, _) = await KtvWithProfileAsync();

        await AcceptCommitmentsAsync(client);
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        _email.Sent.Should().HaveCount(1);

        var admin = await _api.LoginAdminAsync();
        (await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/identity/verify",
            new { Decision = VerificationStatuses.Rejected, Reason = "Ảnh mờ" }))
            .EnsureSuccessStatusCode();

        // Lượt gửi lại cần admin xem lại từ đầu — đúng lý do hàng đợi CCCD tách khỏi
        // hàng đợi hồ sơ. Giữ nguyên mốc cũ thì nó nằm im không ai biết.
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        _email.Sent.Should().HaveCount(2, "lượt gửi lại cũng cần được xem");
    }

    [Fact]
    public async Task Hồ_sơ_đã_duyệt_gửi_lại_CCCD_thì_không_báo_hàng_đợi_hồ_sơ()
    {
        var (client, ktvId, _) = await KtvWithProfileAsync();

        await AcceptCommitmentsAsync(client);
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        var admin = await _api.LoginAdminAsync();
        await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/identity/verify",
            new { Decision = VerificationStatuses.Verified });
        (await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Verified })).EnsureSuccessStatusCode();

        var before = _email.Sent.Count;

        // KTV đã lên sàn thay thẻ khác: việc đó đi vào hàng đợi CCCD (`/admin/duyet-cccd`),
        // không phải hàng đợi hồ sơ. Email này nói "hồ sơ chờ duyệt" nên gửi ở đây là
        // chỉ admin tới một trang không có gì.
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        _email.Sent.Should().HaveCount(before);
    }

    [Fact]
    public async Task Email_hỏng_thì_KTV_vẫn_nộp_được_hồ_sơ()
    {
        _email.ThrowOnSend = true;
        var (client, ktvId, _) = await KtvWithProfileAsync();

        await AcceptCommitmentsAsync(client);

        // Đây là lời hứa trung tâm của cả module: người gây ra lượt gửi không phải người
        // nhận email, nên một sự cố ở Resend không được chặn onboarding của họ.
        var res = await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        res.StatusCode.Should().Be(HttpStatusCode.OK,
            "sự cố ở nhà cung cấp email không được biến thành lỗi nộp hồ sơ");

        await using var db = fixture.CreateContext();
        var doc = await db.IdentityDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.KtvId == ktvId);
        doc.Should().NotBeNull("CCCD phải được lưu dù email hỏng");
    }

    [Fact]
    public async Task Gửi_email_không_đẩy_updated_at_của_hồ_sơ()
    {
        var (client, ktvId, _) = await KtvWithProfileAsync();

        await AcceptCommitmentsAsync(client);

        await using (var db = fixture.CreateContext())
        {
            var before = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId);
            var updatedAtBefore = before.UpdatedAt;

            await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

            await using var db2 = fixture.CreateContext();
            var after = await db2.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == ktvId);

            // Sitemap đọc `updated_at` làm `lastmod`. Gửi CCCD và gửi email không đổi một
            // chữ nào trên trang công khai, nên đẩy cột này lên là khai với Google rằng
            // trang vừa được sửa.
            after.UpdatedAt.Should().Be(updatedAtBefore);
            after.SubmissionNotifiedAt.Should().NotBeNull();
        }
    }
}
