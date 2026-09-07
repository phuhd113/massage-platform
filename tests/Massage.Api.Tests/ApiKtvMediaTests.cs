using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Massage.Api.Tests;

/// <summary>
/// Ảnh đại diện và bộ sưu tập ảnh hồ sơ KTV.
///
/// Cùng lý do với <see cref="ApiUploadTests"/>: luồng multipart chỉ tồn tại ở tầng
/// HTTP, không test service nào chạm tới nó. Ngoài ra ở đây còn hai luật chỉ quan sát
/// được qua HTTP — ảnh chờ duyệt không ra trang công khai, và một KTV không xoá được
/// ảnh của KTV khác.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiKtvMediaTests(PostgresFixture fixture) : IAsyncLifetime
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
            VerificationStatus = VerificationStatuses.Verified,
        };
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync();

        return (client, profile.Id);
    }

    /// <summary>PNG 1x1 thật — đủ để qua kiểm đuôi + MIME, và nhỏ hơn mọi hạn mức.</summary>
    private static byte[] TinyPng() => Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");

    private static MultipartFormDataContent ImageForm(
        byte[] bytes, string fileName, string contentType, string? caption = null)
    {
        var content = new MultipartFormDataContent();
        if (caption is not null)
            content.Add(new StringContent(caption), "caption");

        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        content.Add(file, "file", fileName);

        return content;
    }

    [Fact]
    public async Task Đặt_ảnh_đại_diện_lưu_key_chứ_không_lưu_URL()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        var res = await client.PutAsync("/api/v1/ktv/profile/avatar",
            ImageForm(TinyPng(), "anh.png", "image/png"));

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var key = await db.KtvProfiles.Where(p => p.Id == ktvId)
            .Select(p => p.AvatarKey).FirstAsync();

        // Cột lưu key, không lưu URL: đổi bucket hay đổi custom domain không được
        // biến thành một lượt backfill toàn bảng.
        key.Should().StartWith("avatars/").And.EndWith(".png");
        key.Should().NotContain("://").And.NotStartWith("/");
        key.Should().NotContain("anh.png", "tên file của client không được làm tên lưu trữ");
    }

    [Fact]
    public async Task Đổi_ảnh_đại_diện_xoá_file_cũ_khỏi_storage()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        await client.PutAsync("/api/v1/ktv/profile/avatar",
            ImageForm(TinyPng(), "cu.png", "image/png"));

        string? first;
        await using (var db = fixture.CreateContext())
            first = await db.KtvProfiles.Where(p => p.Id == ktvId)
                .Select(p => p.AvatarKey).FirstAsync();

        await client.PutAsync("/api/v1/ktv/profile/avatar",
            ImageForm(TinyPng(), "moi.png", "image/png"));

        await using var db2 = fixture.CreateContext();
        var second = await db2.KtvProfiles.Where(p => p.Id == ktvId)
            .Select(p => p.AvatarKey).FirstAsync();

        second.Should().NotBe(first, "mỗi lượt upload sinh key mới");

        // File cũ phải biến mất. Không dọn thì mỗi lần KTV đổi ảnh lại bỏ lại một
        // file không ai tham chiếu, và hoá đơn lưu trữ tăng theo số lần đổi ảnh.
        File.Exists(Path.Combine(_api.UploadDir, first!)).Should().BeFalse();
        File.Exists(Path.Combine(_api.UploadDir, second!)).Should().BeTrue();
    }

    [Fact]
    public async Task File_không_phải_ảnh_bị_chặn_ở_ảnh_đại_diện()
    {
        var (client, _) = await KtvWithProfileAsync();

        // PDF hợp lệ cho chứng chỉ nhưng không phải ảnh: hai luồng có hai danh sách
        // định dạng khác nhau, dùng chung một danh sách sẽ cho PDF lên card tìm kiếm.
        var res = await client.PutAsync("/api/v1/ktv/profile/avatar",
            ImageForm(Encoding.ASCII.GetBytes("%PDF-1.4"), "a.pdf", "application/pdf"));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Ảnh_bộ_sưu_tập_vào_hàng_chờ_duyệt_và_chưa_ra_trang_công_khai()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        var res = await client.PostAsync("/api/v1/ktv/profile/photos",
            ImageForm(TinyPng(), "p1.png", "image/png", caption: "Phong tri lieu"));

        res.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var photo = await db.KtvPhotos.FirstAsync(p => p.KtvId == ktvId);
        photo.VerifyStatus.Should().Be(VerificationStatuses.Pending,
            "ảnh tự động hiện là mở một khe đăng nội dung mà không ai xem trước");
        photo.Caption.Should().Be("Phong tri lieu");

        // Trang hồ sơ công khai chính là thứ Google đọc — ảnh chờ duyệt lọt vào đó là
        // rủi ro cho cả tên miền, không riêng một hồ sơ.
        var pub = await _api.CreateClient()
            .GetFromJsonAsync<PublicProfile>($"/api/v1/ktv/{ktvId}");
        pub!.Photos.Should().BeEmpty();
    }

    [Fact]
    public async Task Ảnh_đã_duyệt_hiện_trên_trang_công_khai_theo_đúng_thứ_tự()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        await client.PostAsync("/api/v1/ktv/profile/photos",
            ImageForm(TinyPng(), "p1.png", "image/png", caption: "Mot"));
        await client.PostAsync("/api/v1/ktv/profile/photos",
            ImageForm(TinyPng(), "p2.png", "image/png", caption: "Hai"));

        await using (var db = fixture.CreateContext())
        {
            await db.KtvPhotos.Where(p => p.KtvId == ktvId)
                .ExecuteUpdateAsync(s => s.SetProperty(
                    p => p.VerifyStatus, VerificationStatuses.Verified));
        }

        var pub = await _api.CreateClient()
            .GetFromJsonAsync<PublicProfile>($"/api/v1/ktv/{ktvId}");

        pub!.Photos.Should().HaveCount(2);
        pub.Photos.Select(p => p.Caption).Should().Equal("Mot", "Hai");
        pub.Photos.Should().OnlyContain(p => p.Url.Contains("/uploads/photos/"));
    }

    [Fact]
    public async Task Vượt_hạn_mức_ảnh_bị_chặn_và_không_để_lại_file_mồ_côi()
    {
        var (client, ktvId) = await KtvWithProfileAsync();

        // Hạn mức mặc định là 10 (UploadOptions.MaxPhotosPerKtv).
        for (var i = 0; i < 10; i++)
        {
            var ok = await client.PostAsync("/api/v1/ktv/profile/photos",
                ImageForm(TinyPng(), $"p{i}.png", "image/png"));
            ok.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());
        }

        var res = await client.PostAsync("/api/v1/ktv/profile/photos",
            ImageForm(TinyPng(), "thua.png", "image/png"));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        await using var db = fixture.CreateContext();
        (await db.KtvPhotos.CountAsync(p => p.KtvId == ktvId)).Should().Be(10);
    }

    [Fact]
    public async Task Không_xoá_được_ảnh_của_KTV_khác()
    {
        var (owner, ownerKtvId) = await KtvWithProfileAsync();
        await owner.PostAsync("/api/v1/ktv/profile/photos",
            ImageForm(TinyPng(), "cua-toi.png", "image/png"));

        Guid photoId;
        await using (var db = fixture.CreateContext())
            photoId = await db.KtvPhotos.Where(p => p.KtvId == ownerKtvId)
                .Select(p => p.Id).FirstAsync();

        var (attacker, _) = await KtvWithProfileAsync();
        var res = await attacker.DeleteAsync($"/api/v1/ktv/profile/photos/{photoId}");

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);

        await using var db2 = fixture.CreateContext();
        (await db2.KtvPhotos.AnyAsync(p => p.Id == photoId)).Should().BeTrue(
            "ảnh của người khác phải còn nguyên");
    }

    private sealed record PublicPhoto(Guid Id, string Url, string? Caption);

    private sealed record PublicProfile(Guid Id, string? AvatarUrl, List<PublicPhoto> Photos);
}
