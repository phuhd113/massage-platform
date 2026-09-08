using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

/// <summary>
/// Hợp đồng HTTP: mã trạng thái và hình dạng phản hồi.
///
/// Mọi test ở đây kiểm thứ mà test service không chạm tới. Nếu một khẳng định
/// ở đây đỏ mà test service vẫn xanh, đó chính là loại lỗi mà bộ test này sinh
/// ra để bắt.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiContractTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    [Fact]
    public async Task Danh_sách_chiến_dịch_của_KTV_chưa_có_hồ_sơ_là_rỗng_chứ_không_phải_404()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.GetAsync("/api/v1/ktv/campaigns");

        // Đây là lỗi đã lọt ra production-ish: 404 ở đây làm hỏng cả trang tổng
        // quan của KTV vừa đăng ký — đúng người cần dashboard nhất.
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        (await res.ReadAsync<object[]>()).Should().BeEmpty();
    }

    [Fact]
    public async Task Số_dư_ví_của_tài_khoản_chưa_từng_giao_dịch_là_0_chứ_không_phải_404()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.GetAsync("/api/v1/wallet/balance");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await res.ReadAsync<WalletBalanceDto>();
        body!.Balance.Should().Be(0);
        body.Available.Should().Be(0);
    }

    [Fact]
    public async Task Chưa_có_hồ_sơ_thì_hỏi_hồ_sơ_của_mình_trả_404()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        // Khác với danh sách: ở đây tài nguyên thật sự chưa tồn tại, nên 404 đúng.
        // Cặp test này khoá lại ranh giới giữa hai trường hợp.
        var res = await client.GetAsync("/api/v1/ktv/profile/me");

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Hồ_sơ_chưa_duyệt_không_xem_được_qua_đường_công_khai()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var pending = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);

        var res = await _api.CreateClient().GetAsync($"/api/v1/ktv/{pending.Id}");

        res.StatusCode.Should().Be(HttpStatusCode.NotFound,
            "đoán được id là xem được hồ sơ chưa qua kiểm duyệt thì kiểm duyệt mất tác dụng");
    }

    [Fact]
    public async Task Tạo_hồ_sơ_thiếu_dữ_liệu_trả_400_kèm_lỗi_theo_từng_trường()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", new
        {
            fullName = "A",          // ngắn hơn 2 ký tự
            lat = 200.0,             // ngoài dải vĩ độ
            lon = 106.7,
            serviceRadiusKm = 5,
        });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Client dựa vào cấu trúc errors theo trường để chỉ đúng ô cần sửa; đổi
        // hình dạng này là làm hỏng thông báo lỗi trên form mà không ai biết.
        var body = await res.Content.ReadAsStringAsync();
        body.Should().Contain("errors");
    }

    [Fact]
    public async Task Tiền_tố_phiên_bản_api_v1_là_bắt_buộc()
    {
        var client = _api.CreateClient();

        (await client.GetAsync("/api/v1/health")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.GetAsync("/health")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Tìm_kiếm_không_có_phạm_vi_bị_từ_chối()
    {
        // Không toạ độ, không khu vực: truy vấn không giới hạn phạm vi sẽ quét
        // toàn bảng. Chặn ở tầng validate chứ không để nó chạy rồi mới chậm.
        var res = await _api.CreateClient().GetAsync("/api/v1/search");

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Khu_vực_không_tồn_tại_trả_404_chứ_không_phải_lỗi_hệ_thống()
    {
        var res = await _api.CreateClient().GetAsync("/api/v1/areas/khong-co-that/cung-khong-co");

        res.StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await res.ProblemTitleAsync()).Should().NotBeEmpty("thông điệp lỗi phải nói được nguyên nhân");
    }

    [Fact]
    public async Task Dò_khu_vực_ngoài_lãnh_thổ_trả_204_chứ_không_phải_404()
    {
        // Khách ở nước ngoài hoặc GPS trôi ra biển là chuyện bình thường, không phải
        // lỗi: nút "Tìm quanh tôi" vẫn cho ra kết quả đúng theo bán kính, chỉ là không
        // gắn được cái nhãn khu vực. 404 ở đây sẽ hiện thành thông báo đỏ cho một tiện
        // ích phụ trợ, đúng lúc khách đã có kết quả trong tay.
        var res = await _api.CreateClient().GetAsync("/api/v1/areas/resolve?lat=0&lon=160");

        res.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Dò_khu_vực_với_toạ_độ_rác_trả_400()
    {
        var res = await _api.CreateClient().GetAsync("/api/v1/areas/resolve?lat=999&lon=0");

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.ProblemTitleAsync()).Should().NotBeEmpty();
    }

    [Fact]
    public async Task Dò_khu_vực_trả_về_đúng_hình_dạng_của_một_gợi_ý()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        await TestData.SetCentroidAsync(db, quận.Id, lat, lon);

        var res = await _api.CreateClient().GetAsync(
            $"/api/v1/areas/resolve?lat={lat.ToString(CultureInfo.InvariantCulture)}" +
            $"&lon={lon.ToString(CultureInfo.InvariantCulture)}");

        res.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await res.ReadAsync<AreaResolveDto>();

        // Hình dạng phải trùng khít với `/areas/suggest`: frontend dùng chung một đường
        // dựng URL cho cả hai (`lib/area-search.ts`). Thiếu `provinceSlug` ở đây thì ô
        // khu vực điền xong nhưng bấm tìm lại rơi vào một tỉnh khác — và cả hai endpoint
        // vẫn trả 200, nên không có gì khác báo động.
        dto!.Id.Should().Be(quận.Id);
        dto.Level.Should().Be(AreaLevels.District);
        dto.Slug.Should().Be(quận.Slug);
        dto.ProvinceSlug.Should().Be(tỉnh.Slug);
    }

    private sealed record WalletBalanceDto(decimal Balance, decimal Held, decimal Available);

    private sealed record AreaResolveDto(
        Guid Id, string Name, string Slug, string Level, string? ProvinceSlug);
}

/// <summary>
/// Hợp đồng HTTP của trường giới tính (2026-09-08).
///
/// Tầng service không bắt được những thứ ở đây: mã trạng thái khi thiếu trường bắt buộc,
/// và việc <c>gender</c> có thật sự đi ra tới response hay không — một trường bị quên
/// trong DTO vẫn để mọi test service xanh.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiKtvGenderTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    private static object Body(string? gender) => new
    {
        fullName = "Nguyen Thi Lan",
        gender,
        yearsExperience = 3,
        lat = 10.7769,
        lon = 106.7009,
        serviceRadiusKm = 5,
    };

    private sealed record ProfileResponse(Guid Id, string? Gender);

    [Fact]
    public async Task Tạo_hồ_sơ_không_khai_giới_tính_trả_400()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", new
        {
            fullName = "Nguyen Thi Lan",
            lat = 10.7769,
            lon = 106.7009,
            serviceRadiusKm = 5,
        });

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        // Form dựa vào cấu trúc errors theo trường để chỉ đúng ô cần sửa.
        (await res.Content.ReadAsStringAsync()).Should().Contain("Gender");
    }

    [Fact]
    public async Task Tạo_hồ_sơ_với_giới_tính_lạ_trả_400()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsJsonAsync("/api/v1/ktv/profile", Body("OTHER"));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Giới_tính_đi_ra_tới_hồ_sơ_của_tôi_và_hồ_sơ_công_khai()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var tạo = await client.PostAsJsonAsync("/api/v1/ktv/profile", Body(Genders.Female));
        tạo.StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());
        var id = (await tạo.ReadAsync<ProfileResponse>())!.Id;

        (await (await client.GetAsync("/api/v1/ktv/profile/me")).ReadAsync<ProfileResponse>())!
            .Gender.Should().Be(Genders.Female);

        // Trang hồ sơ công khai chỉ trả hồ sơ đã duyệt, nên phải duyệt trước khi đọc.
        await using (var db = fixture.CreateContext())
        {
            var p = await db.KtvProfiles.SingleAsync(x => x.Id == id);
            p.VerificationStatus = VerificationStatuses.Verified;
            await db.SaveChangesAsync();
        }

        var côngKhai = await _api.CreateClient().GetAsync($"/api/v1/ktv/{id}");
        côngKhai.StatusCode.Should().Be(HttpStatusCode.OK);
        (await côngKhai.ReadAsync<ProfileResponse>())!.Gender.Should().Be(Genders.Female);
    }

    [Fact]
    public async Task Sửa_hồ_sơ_không_gửi_giới_tính_thì_giữ_nguyên_chứ_không_xoá()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);
        (await client.PostAsJsonAsync("/api/v1/ktv/profile", Body(Genders.Female)))
            .StatusCode.Should().Be(HttpStatusCode.Created, _api.ErrorsOrEmpty());

        // null ở đường PATCH là "không đổi". Diễn giải nó thành "xoá" sẽ âm thầm đưa
        // hồ sơ ra khỏi mọi lượt lọc theo giới tính mỗi lần KTV sửa một trường khác.
        var sửa = await client.PatchAsJsonAsync("/api/v1/ktv/profile", new { yearsExperience = 7 });
        sửa.StatusCode.Should().Be(HttpStatusCode.OK);

        (await sửa.ReadAsync<ProfileResponse>())!.Gender.Should().Be(Genders.Female);
    }

    [Fact]
    public async Task Lọc_tìm_kiếm_với_giới_tính_lạ_trả_400_chứ_không_lặng_lẽ_bỏ_qua()
    {
        var res = await _api.CreateClient()
            .GetAsync("/api/v1/search?areaSlug=tp-ho-chi-minh&gender=OTHER");

        // Bỏ qua nghĩa là giao diện hiện "đang lọc" trong khi kết quả không lọc gì.
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
