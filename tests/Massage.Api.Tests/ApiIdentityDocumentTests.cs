using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Massage.Api.Tests;

/// <summary>
/// Ảnh CCCD — điều kiện bắt buộc để hồ sơ được duyệt VERIFIED.
///
/// Test ở tầng HTTP vì phần lớn luật nằm đúng ở đó: binding multipart hai file, dọn
/// file mồ côi khi một trong hai lượt ghi hỏng, và quyền đọc ảnh giấy tờ tuỳ thân.
/// Không test nào ở tầng service nhìn thấy những thứ này.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiIdentityDocumentTests(PostgresFixture fixture) : IAsyncLifetime
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
        var profile = new KtvProfile
        {
            UserId = userId,
            FullName = $"KTV {Guid.NewGuid():N}"[..20],
            Slug = $"ktv-{Guid.NewGuid():N}"[..24],
            BasePoint = new Point(TestData.RandomOrigin().Lon, TestData.RandomOrigin().Lat) { SRID = 4326 },
            VerificationStatus = VerificationStatuses.Pending,
        };
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync();

        return (client, profile.Id);
    }

    /// <summary>PNG 1x1 thật — đủ để qua kiểm đuôi file và MIME.</summary>
    private static byte[] Png() => Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent TwoSides(
        string frontName = "front.png",
        string backName = "back.png",
        string frontType = "image/png",
        string backType = "image/png")
    {
        var content = new MultipartFormDataContent();

        var front = new ByteArrayContent(Png());
        front.Headers.ContentType = new MediaTypeHeaderValue(frontType);
        content.Add(front, "front", frontName);

        var back = new ByteArrayContent(Png());
        back.Headers.ContentType = new MediaTypeHeaderValue(backType);
        content.Add(back, "back", backName);

        return content;
    }

    private sealed record Doc(
        Guid Id, Guid KtvId, string FrontUrl, string BackUrl,
        string VerifyStatus, string? RejectionReason, DateTimeOffset SubmittedAt);

    [Fact]
    public async Task Gửi_hai_mặt_hợp_lệ_thì_lưu_và_chờ_duyệt()
    {
        var (client, _) = await KtvWithProfileAsync();

        var res = await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        var body = await res.ReadAsync<Doc>();
        body!.VerifyStatus.Should().Be(VerificationStatuses.Pending,
            "CCCD tự động được duyệt thì việc bắt buộc nó mất hết ý nghĩa");

        // Hai mặt phải là hai file khác nhau trên storage, không phải một key dùng lại.
        body.FrontUrl.Should().NotBe(body.BackUrl);

        // URL phải trỏ về endpoint có [Authorize], không phải đường dẫn tĩnh — và phải
        // là endpoint của CCCD chứ không phải của chứng chỉ (hai bảng khác nhau).
        body.FrontUrl.Should().Contain("/ktv/profile/identity/file?key=");
        body.FrontUrl.Should().Contain("identity%2F");
        body.FrontUrl.Should().NotContain("front.png",
            "tên file do client gửi không được dùng làm tên lưu trữ");
    }

    [Fact]
    public async Task Thiếu_một_mặt_thì_bị_400_và_không_tạo_bản_ghi()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        var content = new MultipartFormDataContent();
        var front = new ByteArrayContent(Png());
        front.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(front, "front", "front.png");

        var res = await client.PutAsync("/api/v1/ktv/profile/identity", content);

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        await using var db = fixture.CreateContext();
        (await db.IdentityDocuments.AnyAsync(d => d.KtvId == ktvId)).Should().BeFalse();
    }

    [Fact]
    public async Task Mặt_sau_sai_định_dạng_thì_không_để_lại_ảnh_mặt_trước_mồ_côi()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        var content = new MultipartFormDataContent();

        var front = new ByteArrayContent(Png());
        front.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(front, "front", "front.png");

        // Mặt sau là text/plain: lượt ghi mặt trước đã xong, lượt sau ném lỗi.
        var back = new ByteArrayContent(Encoding.UTF8.GetBytes("khong phai anh"));
        back.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        content.Add(back, "back", "back.txt");

        var res = await client.PutAsync("/api/v1/ktv/profile/identity", content);

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        await using var db = fixture.CreateContext();
        (await db.IdentityDocuments.AnyAsync(d => d.KtvId == ktvId)).Should().BeFalse(
            "một mặt đã lên storage không được để lại bản ghi nửa vời");
    }

    [Fact]
    public async Task PDF_không_được_chấp_nhận_cho_CCCD_dù_chứng_chỉ_thì_được()
    {
        var (client, _) = await KtvWithProfileAsync();

        var content = new MultipartFormDataContent();
        foreach (var field in new[] { "front", "back" })
        {
            var part = new ByteArrayContent(Encoding.ASCII.GetBytes("%PDF-1.4\n%%EOF\n"));
            part.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
            content.Add(part, field, $"{field}.pdf");
        }

        var res = await client.PutAsync("/api/v1/ktv/profile/identity", content);

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Gửi_lại_thì_ghi_đè_bản_cũ_chứ_không_thêm_hàng()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        var second = await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        second.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        (await db.IdentityDocuments.CountAsync(d => d.KtvId == ktvId)).Should().Be(1,
            "một KTV chỉ có nhiều nhất một CCCD");
    }

    [Fact]
    public async Task Gửi_lại_sau_khi_đã_duyệt_thì_quay_về_chờ_duyệt()
    {
        var (client, ktvId) = await KtvWithProfileAsync();
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        var admin = await _api.LoginAdminAsync();
        await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/identity/verify",
            new { Decision = VerificationStatuses.Verified });

        // Gửi ảnh khác sau khi đã được duyệt: nếu trạng thái giữ nguyên VERIFIED thì
        // một hồ sơ đã duyệt thay được thẻ khác vào mà không ai nhìn lại.
        var res = await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
        (await res.ReadAsync<Doc>())!.VerifyStatus.Should().Be(VerificationStatuses.Pending);
    }

    [Fact]
    public async Task Không_duyệt_được_hồ_sơ_khi_chưa_có_CCCD()
    {
        var (_, ktvId) = await KtvWithProfileAsync();
        var admin = await _api.LoginAdminAsync();

        var res = await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Verified });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest,
            "hồ sơ VERIFIED là thứ khách dựa vào để mời người lạ vào nhà");
        (await res.ProblemTitleAsync()).Should().Contain("CCCD");

        await using var db = fixture.CreateContext();
        var profile = await db.KtvProfiles.FirstAsync(p => p.Id == ktvId);
        profile.VerificationStatus.Should().Be(VerificationStatuses.Pending);
    }

    [Fact]
    public async Task Không_duyệt_được_hồ_sơ_khi_CCCD_mới_gửi_chưa_được_xác_minh()
    {
        var (client, ktvId) = await KtvWithProfileAsync();
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        var admin = await _api.LoginAdminAsync();
        var res = await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Verified });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest,
            "có ảnh nhưng chưa ai đối chiếu thì chưa phải là đã xác minh");
    }

    [Fact]
    public async Task Duyệt_CCCD_xong_thì_duyệt_được_hồ_sơ()
    {
        var (client, ktvId) = await KtvWithProfileAsync();
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        // Hồ sơ chỉ duyệt được khi đủ **cả hai** điều kiện, nên phải cam kết ở đây.
        await client.PostAsJsonAsync("/api/v1/ktv/profile/commitments",
            new { Version = KtvCommitments.CurrentVersion });

        var admin = await _api.LoginAdminAsync();

        var verifyDoc = await admin.PatchAsJsonAsync(
            $"/api/v1/admin/ktv/{ktvId}/identity/verify",
            new { Decision = VerificationStatuses.Verified });
        verifyDoc.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        var res = await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Verified });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
    }

    [Fact]
    public async Task Từ_chối_hồ_sơ_vẫn_làm_được_khi_chưa_có_CCCD()
    {
        var (_, ktvId) = await KtvWithProfileAsync();
        var admin = await _api.LoginAdminAsync();

        // Chặn cả chiều từ chối sẽ khoá đúng đường gỡ những hồ sơ đáng ngờ nhất.
        var res = await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Rejected, Reason = "Thiếu giấy tờ" });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
    }

    [Fact]
    public async Task KTV_khác_không_mở_được_ảnh_CCCD_của_người_ta()
    {
        var (owner, _) = await KtvWithProfileAsync();
        var submit = await owner.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        var key = ExtractKey((await submit.ReadAsync<Doc>())!.FrontUrl);

        var (other, _) = await KtvWithProfileAsync();

        var res = await other.GetAsync($"/api/v1/ktv/profile/identity/file?key={Uri.EscapeDataString(key)}");

        // 404 chứ không phải 403: 403 xác nhận key đó có thật và thuộc về ai đó.
        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Khách_vãng_lai_không_mở_được_ảnh_CCCD()
    {
        var (owner, _) = await KtvWithProfileAsync();
        var submit = await owner.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        var key = ExtractKey((await submit.ReadAsync<Doc>())!.FrontUrl);

        var anonymous = _api.CreateClient();
        var res = await anonymous.GetAsync(
            $"/api/v1/ktv/profile/identity/file?key={Uri.EscapeDataString(key)}");

        res.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Admin_mở_được_ảnh_CCCD_của_KTV()
    {
        var (owner, _) = await KtvWithProfileAsync();
        var submit = await owner.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        var key = ExtractKey((await submit.ReadAsync<Doc>())!.FrontUrl);

        var admin = await _api.LoginAdminAsync();
        var res = await admin.GetAsync(
            $"/api/v1/ktv/profile/identity/file?key={Uri.EscapeDataString(key)}");

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
        res.Content.Headers.ContentType!.MediaType.Should().Be("image/png");
    }

    [Fact]
    public async Task Hồ_sơ_công_khai_không_bao_giờ_lộ_ảnh_CCCD()
    {
        var (client, ktvId) = await KtvWithProfileAsync();
        await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());
        await client.PostAsJsonAsync("/api/v1/ktv/profile/commitments",
            new { Version = KtvCommitments.CurrentVersion });

        var admin = await _api.LoginAdminAsync();
        await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/identity/verify",
            new { Decision = VerificationStatuses.Verified });
        await admin.PatchAsJsonAsync($"/api/v1/admin/ktv/{ktvId}/verify",
            new { Decision = VerificationStatuses.Verified });

        var anonymous = _api.CreateClient();
        var res = await anonymous.GetAsync($"/api/v1/ktv/{ktvId}");

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());
        var raw = await res.Content.ReadAsStringAsync();
        raw.Should().NotContain("identity/",
            "key ảnh CCCD không được xuất hiện ở bất kỳ đâu trên đường công khai");
        raw.ToLowerInvariant().Should().NotContain("cccd");
    }

    [Fact]
    public async Task Chưa_có_hồ_sơ_thì_không_gửi_CCCD_được()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PutAsync("/api/v1/ktv/profile/identity", TwoSides());

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private static string ExtractKey(string signedUrl) =>
        Uri.UnescapeDataString(signedUrl[(signedUrl.IndexOf("key=", StringComparison.Ordinal) + 4)..]);
}
