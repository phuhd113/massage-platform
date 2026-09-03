using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;

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

    private sealed record WalletBalanceDto(decimal Balance, decimal Held, decimal Available);
}
