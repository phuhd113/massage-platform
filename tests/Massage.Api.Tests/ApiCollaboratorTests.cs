using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Collaborators.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Massage.Api.Tests;

/// <summary>
/// Cộng tác viên và mã giới thiệu.
///
/// Phần đáng canh nhất không phải "lưu được mã" mà là **mã sai bị chặn ngay**: một chuỗi
/// không ai sở hữu lưu êm vào hồ sơ sẽ chỉ vỡ ra lúc đối soát hoa hồng, khi không còn
/// cách nào biết ai thật sự đã mời người đó.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiCollaboratorTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    /// <summary>Mã riêng cho mỗi test — fixture dùng chung một DB cho cả collection.</summary>
    private static string UniqueCode() => $"CTV{Guid.NewGuid():N}"[..12].ToUpperInvariant();

    private async Task<Collaborator> SeedCollaboratorAsync(
        string? code = null, string status = CollaboratorStatuses.Active)
    {
        await using var db = fixture.CreateContext();
        var c = new Collaborator
        {
            Code = Collaborator.NormalizeCode(code ?? UniqueCode()),
            FullName = "Cong tac vien",
            Status = status,
        };
        db.Collaborators.Add(c);
        await db.SaveChangesAsync();
        return c;
    }

    private static object ProfileBody(string? referralCode) => new
    {
        FullName = "Nguyen Thi Lan",
        Lat = 10.7769,
        Lon = 106.7009,
        ServiceRadiusKm = (short)5,
        ReferralCode = referralCode,
    };

    private sealed record ProfileCreated(Guid Id);

    [Fact]
    public async Task Tạo_hồ_sơ_với_mã_đúng_thì_ghi_nhận_người_giới_thiệu()
    {
        var ctv = await SeedCollaboratorAsync();
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", ProfileBody(ctv.Code));

        res.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());
        var created = await res.ReadAsync<ProfileCreated>();

        await using var db = fixture.CreateContext();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == created!.Id);

        profile.ReferredByCollaboratorId.Should().Be(ctv.Id);
        profile.ReferredAt.Should().NotBeNull();
    }

    [Fact]
    public async Task Bỏ_trống_mã_vẫn_tạo_được_hồ_sơ()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        // Đa số KTV tự tìm tới qua SEO và không có mã nào — bắt buộc sẽ chặn đúng nhóm
        // đến miễn phí.
        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", ProfileBody(null));

        res.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var created = await res.ReadAsync<ProfileCreated>();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == created!.Id);

        profile.ReferredByCollaboratorId.Should().BeNull();
        profile.ReferredAt.Should().BeNull();
    }

    [Fact]
    public async Task Mã_không_tồn_tại_thì_bị_400_và_KHÔNG_tạo_hồ_sơ()
    {
        var (client, userId, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", ProfileBody("KHONGCOTHAT"));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.ProblemTitleAsync()).Should().Contain("không tồn tại");

        // Quan trọng hơn mã lỗi: không được để lại hồ sơ nửa vời. Nếu hồ sơ vẫn được tạo
        // thì KTV tưởng đã đăng ký xong, còn CTV thì mất dấu lượt giới thiệu.
        await using var db = fixture.CreateContext();
        (await db.KtvProfiles.AnyAsync(p => p.UserId == userId)).Should().BeFalse();
    }

    [Fact]
    public async Task Mã_của_CTV_đã_ngừng_hoạt_động_thì_bị_từ_chối()
    {
        var ctv = await SeedCollaboratorAsync(status: CollaboratorStatuses.Disabled);
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", ProfileBody(ctv.Code));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        // Nói đúng lý do, không gộp vào "mã không tồn tại": CTV vừa bị khoá sẽ đi báo
        // với KTV rằng hệ thống hỏng.
        (await res.ProblemTitleAsync()).Should().Contain("ngừng hoạt động");
    }

    [Fact]
    public async Task Mã_gõ_thường_hoặc_thừa_khoảng_trắng_vẫn_khớp()
    {
        var ctv = await SeedCollaboratorAsync("AN-01");
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        // Người ta đọc mã qua điện thoại rồi gõ lại; ba dạng này phải ra cùng một CTV,
        // nếu không thì một lỗi gõ phím thành mất hoa hồng.
        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", ProfileBody("  an-01 "));

        res.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var created = await res.ReadAsync<ProfileCreated>();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == created!.Id);
        profile.ReferredByCollaboratorId.Should().Be(ctv.Id);
    }

    [Fact]
    public async Task Sửa_hồ_sơ_không_đổi_được_người_giới_thiệu()
    {
        var ctv = await SeedCollaboratorAsync();
        var other = await SeedCollaboratorAsync();
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var created = await (await client.PostAsJsonAsync(
            "/api/v1/ktv/profile", ProfileBody(ctv.Code))).ReadAsync<ProfileCreated>();

        // Gửi kèm referralCode ở đường sửa: DTO cập nhật không có trường này nên nó phải
        // bị bỏ qua hoàn toàn. Đây là dữ liệu tính tiền — để sửa tự do là mở đường cho
        // một CTV đổi mã của mình vào hồ sơ người khác mang về.
        var res = await client.PatchAsJsonAsync("/api/v1/ktv/profile",
            new { FullName = "Ten moi", ReferralCode = other.Code });

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        await using var db = fixture.CreateContext();
        var profile = await db.KtvProfiles.AsNoTracking().FirstAsync(p => p.Id == created!.Id);
        profile.ReferredByCollaboratorId.Should().Be(ctv.Id, "mã chốt lúc tạo, không sửa");
    }

    [Fact]
    public async Task Mã_trùng_thì_không_tạo_được_CTV_thứ_hai()
    {
        var admin = await _api.LoginAdminAsync();
        var code = UniqueCode();

        var first = await admin.PostAsJsonAsync("/api/v1/collaborators",
            new { Code = code, FullName = "Nguoi thu nhat" });
        first.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());

        var second = await admin.PostAsJsonAsync("/api/v1/collaborators",
            new { Code = code.ToLowerInvariant(), FullName = "Nguoi thu hai" });

        // Chữ thường phải bị coi là **cùng** một mã: nếu không, hai CTV cùng đưa ra một
        // mã cho KTV và không cách nào biết ai mời ai.
        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Danh_sách_CTV_đếm_đúng_số_hồ_sơ_đã_giới_thiệu()
    {
        var ctv = await SeedCollaboratorAsync();

        // Hai hồ sơ cùng mã, một trong hai được duyệt.
        var ids = new List<Guid>();
        for (var i = 0; i < 2; i++)
        {
            var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);
            var created = await (await client.PostAsJsonAsync(
                "/api/v1/ktv/profile", ProfileBody(ctv.Code))).ReadAsync<ProfileCreated>();
            ids.Add(created!.Id);
        }

        await using (var db = fixture.CreateContext())
        {
            await db.KtvProfiles.Where(p => p.Id == ids[0])
                .ExecuteUpdateAsync(s => s.SetProperty(
                    p => p.VerificationStatus, VerificationStatuses.Verified));
        }

        var admin = await _api.LoginAdminAsync();
        var res = await admin.GetAsync("/api/v1/collaborators?limit=100");
        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        var body = await res.ReadAsync<CollaboratorList>();
        var row = body!.Items.Single(x => x.Id == ctv.Id);

        row.ReferredCount.Should().Be(2);
        // Hai con số trả lời hai câu khác nhau, và chỉ con số thứ hai đáng dùng để tính
        // hoa hồng: hồ sơ tạo ra rồi không bao giờ qua duyệt chưa mang lại gì cho sàn.
        row.VerifiedCount.Should().Be(1);
    }

    [Fact]
    public async Task Không_xoá_được_CTV_đang_có_hồ_sơ_giới_thiệu()
    {
        var ctv = await SeedCollaboratorAsync();
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);
        await client.PostAsJsonAsync("/api/v1/ktv/profile", ProfileBody(ctv.Code));

        // ON DELETE RESTRICT: xoá phải thất bại chứ không được lặng lẽ gỡ liên kết khỏi
        // hồ sơ đã giới thiệu — đó là xoá cơ sở tính hoa hồng của những lượt hợp lệ.
        //
        // Bắt PostgresException chứ không phải DbUpdateException: `ExecuteDelete` gửi
        // thẳng câu DELETE xuống DB, không đi qua SaveChanges nên EF không bọc lỗi lại.
        await using var db = fixture.CreateContext();
        var act = async () => await db.Collaborators
            .Where(c => c.Id == ctv.Id).ExecuteDeleteAsync();

        (await act.Should().ThrowAsync<PostgresException>())
            .Which.SqlState.Should().Be("23503", "phải là lỗi vi phạm khoá ngoại");
    }

    [Fact]
    public async Task Kiểm_mã_trả_về_tên_CTV_nhưng_không_lộ_số_điện_thoại()
    {
        Collaborator ctv;
        await using (var db = fixture.CreateContext())
        {
            ctv = new Collaborator
            {
                Code = UniqueCode(),
                FullName = "Tran Van Nam",
                Phone = "0900000001",
            };
            db.Collaborators.Add(ctv);
            await db.SaveChangesAsync();
        }

        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);
        var res = await client.GetAsync($"/api/v1/referral-codes/{ctv.Code}");

        res.StatusCode.Should().Be(HttpStatusCode.OK, _api.ErrorsOrEmpty());

        var raw = await res.Content.ReadAsStringAsync();
        raw.Should().Contain("Tran Van Nam");
        // Endpoint này ai đoán trúng mã cũng gọi được, nên nó không được thành đường rò
        // thông tin liên hệ của cộng tác viên.
        raw.Should().NotContain("0900000001");
    }

    [Fact]
    public async Task Khách_không_quản_lý_được_cộng_tác_viên()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Customer);

        var res = await client.PostAsJsonAsync("/api/v1/collaborators",
            new { Code = UniqueCode(), FullName = "Tu phong" });

        res.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private sealed record CollaboratorList(List<CollaboratorRow> Items, int Total);

    private sealed record CollaboratorRow(
        Guid Id, string Code, string FullName, int ReferredCount, int VerifiedCount);
}
