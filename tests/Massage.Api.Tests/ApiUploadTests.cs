using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using NetTopologySuite.Geometries;

namespace Massage.Api.Tests;

/// <summary>
/// Upload chứng chỉ — luồng multipart duy nhất của hệ thống.
///
/// Binding form và kiểm tra file chỉ tồn tại ở tầng HTTP: <c>UploadService</c>
/// nhận <c>IFormFile</c>, thứ chỉ ASP.NET dựng được. Một lỗi ở đây (mất boundary,
/// tên trường sai, bỏ kiểm định dạng) không làm đỏ bất kỳ test service nào.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiUploadTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private async Task<HttpClient> KtvWithProfileAsync()
    {
        var (client, userId, _) = await _api.LoginAsync(UserRoles.Ktv);

        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        db.KtvProfiles.Add(new KtvProfile
        {
            UserId = userId,
            FullName = $"KTV {Guid.NewGuid():N}"[..20],
            Slug = $"ktv-{Guid.NewGuid():N}"[..24],
            BasePoint = new Point(lon, lat) { SRID = 4326 },
            VerificationStatus = VerificationStatuses.Pending,
        });
        await db.SaveChangesAsync();

        return client;
    }

    private static MultipartFormDataContent Form(
        string name, byte[] bytes, string fileName, string contentType)
    {
        var content = new MultipartFormDataContent();
        content.Add(new StringContent(name), "Name");

        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        content.Add(file, "file", fileName);

        return content;
    }

    private static byte[] MinimalPdf() =>
        Encoding.ASCII.GetBytes("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

    [Fact]
    public async Task Tải_lên_PDF_hợp_lệ_trả_201_và_gắn_trạng_thái_chờ_duyệt()
    {
        var client = await KtvWithProfileAsync();

        var res = await client.PostAsync("/api/v1/ktv/certifications",
            Form("Chung chi xoa bop", MinimalPdf(), "cc.pdf", "application/pdf"));

        // Kèm body vào thông báo: khi test HTTP đỏ, "mong 201 nhận 500" một mình
        // không đủ để biết vì sao, và log của test host thì không hiện ra ở đây.
        res.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());

        var body = await res.ReadAsync<Cert>();
        body!.VerifyStatus.Should().Be(VerificationStatuses.Pending,
            "chứng chỉ tự động được duyệt thì hàng rào chất lượng mất tác dụng");
        // Test chạy với LocalObjectStorage (không cấu hình R2), nên URL trỏ về endpoint
        // có [Authorize] chứ không phải một đường dẫn tĩnh. Với R2 nó là URL ký hạn
        // ngắn — hình dạng khác, nhưng cùng một luật: không ai mở được nếu không có
        // quyền, và tên file của client không bao giờ thành tên lưu trữ.
        body.FileUrl.Should().Contain("/ktv/certifications/file?key=");
        body.FileUrl.Should().Contain("certifications%2F");
        body.FileUrl.Should().NotContain("cc.pdf",
            "tên file do client gửi không được dùng làm tên lưu trữ");
    }

    [Fact]
    public async Task File_sai_định_dạng_bị_400_kèm_thông_điệp_rõ_ràng()
    {
        var client = await KtvWithProfileAsync();

        var res = await client.PostAsync("/api/v1/ktv/certifications",
            Form("File sai", Encoding.UTF8.GetBytes("khong phai anh"), "a.txt", "text/plain"));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.ProblemTitleAsync()).Should().Contain("JPG");
    }

    [Fact]
    public async Task Đuôi_file_hợp_lệ_nhưng_MIME_giả_mạo_vẫn_bị_chặn()
    {
        var client = await KtvWithProfileAsync();

        // Đổi đuôi thành .pdf mà content-type vẫn là text/plain: kiểm cả hai vế
        // chứ không chỉ một, vì cả hai đều do client khai báo.
        var res = await client.PostAsync("/api/v1/ktv/certifications",
            Form("Gia mao", Encoding.UTF8.GetBytes("khong phai pdf"), "a.pdf", "text/plain"));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Thiếu_file_thì_bị_400_chứ_không_tạo_bản_ghi_rỗng()
    {
        var client = await KtvWithProfileAsync();

        var content = new MultipartFormDataContent();
        content.Add(new StringContent("Chung chi khong file"), "Name");

        var res = await client.PostAsync("/api/v1/ktv/certifications", content);

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Chưa_có_hồ_sơ_thì_không_tải_chứng_chỉ_lên_được()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsync("/api/v1/ktv/certifications",
            Form("Chung chi", MinimalPdf(), "cc.pdf", "application/pdf"));

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task File_chứng_chỉ_KHÔNG_phục_vụ_qua_đường_tĩnh_công_khai()
    {
        var client = await KtvWithProfileAsync();

        var res = await client.PostAsync("/api/v1/ktv/certifications",
            Form("Chung chi", MinimalPdf(), "cc.pdf", "application/pdf"));
        var body = await res.ReadAsync<Cert>();

        // Đây là lỗ hổng đã sửa, không phải đề phòng: trước khi có lớp object storage,
        // cả thư mục uploads được UseStaticFiles phục vụ công khai, nên ai đoán được
        // tên file đều tải được ảnh chụp giấy tờ tuỳ thân của KTV.
        var key = body!.FileUrl[(body.FileUrl.IndexOf("key=", StringComparison.Ordinal) + 4)..];
        var direct = await _api.CreateClient().GetAsync($"/uploads/{Uri.UnescapeDataString(key)}");

        direct.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "đường tĩnh chỉ mở cho avatars/ và photos/");
    }

    [Fact]
    public async Task Không_tải_được_file_chứng_chỉ_của_KTV_khác()
    {
        var owner = await KtvWithProfileAsync();
        var res = await owner.PostAsync("/api/v1/ktv/certifications",
            Form("Cua toi", MinimalPdf(), "cc.pdf", "application/pdf"));
        var body = await res.ReadAsync<Cert>();

        // Chính chủ mở được.
        (await owner.GetAsync(body!.FileUrl)).StatusCode
            .Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        // KTV khác thì không — và nhận 404 chứ không phải 403: 403 xác nhận key đó có
        // thật, tức biến chính lời từ chối thành một kênh dò tìm.
        var attacker = await KtvWithProfileAsync();
        (await attacker.GetAsync(body.FileUrl)).StatusCode
            .Should().Be(HttpStatusCode.NotFound);

        // Chưa đăng nhập thì càng không.
        (await _api.CreateClient().GetAsync(body.FileUrl)).StatusCode
            .Should().Be(HttpStatusCode.Unauthorized);
    }

    private sealed record Cert(Guid Id, string Name, string FileUrl, string VerifyStatus);
}

/// <summary>
/// Giới hạn tần suất, tách riêng thành một class để có instance ứng dụng riêng.
///
/// Bộ đếm của rate limiter sống trong DI container của từng ứng dụng, nên test
/// này sẽ ăn hết hạn mức của mọi test khác nếu dùng chung factory.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiRateLimitTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    [Fact]
    public async Task Bơm_lead_liên_tục_bị_chặn_ở_ngưỡng()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var client = _api.CreateClient();
        var statuses = new List<HttpStatusCode>();

        // Ngưỡng là 30 request mỗi phút. Gửi 35 để chắc chắn vượt qua.
        for (var i = 0; i < 35; i++)
        {
            var res = await client.PostAsJsonAsync("/api/v1/leads",
                new { ktvId = ktv.Id, channel = "CALL" });
            statuses.Add(res.StatusCode);
        }

        // Bơm lead ảo là cách rẻ nhất để phá số liệu mà Phase 2 dùng để tính phí.
        statuses.Should().Contain(HttpStatusCode.TooManyRequests);
        statuses.Take(10).Should().AllBeEquivalentTo(HttpStatusCode.OK,
            "những lượt bấm đầu tiên phải đi qua bình thường");
    }
}
