using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Promotion.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Massage.Api.Tests;

/// <summary>
/// Vùng chạm tiền nhìn từ ngoài HTTP.
///
/// Test service đã phủ quy tắc nghiệp vụ; ở đây kiểm phần còn lại mà chỉ tầng
/// HTTP có: header bắt buộc, và exception nghiệp vụ có ra đúng mã trạng thái hay
/// không. Một <c>SlotExhaustedException</c> rơi thành 500 vẫn đúng nghiệp vụ
/// nhưng client sẽ hiển thị "lỗi hệ thống" cho một tình huống bình thường.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ApiMoneyTests(PostgresFixture fixture) : IAsyncLifetime
{
    private ApiFactory _api = null!;

    public Task InitializeAsync()
    {
        _api = new ApiFactory(fixture.ConnectionString, fixture.DataSource);
        return Task.CompletedTask;
    }

    public async Task DisposeAsync() => await _api.DisposeAsync();

    /// <summary>
    /// Gắn hồ sơ KTV đã duyệt và tiền vào ví cho một tài khoản đã đăng nhập.
    ///
    /// Không dùng <c>TestData.CreateKtvAsync</c> ở đây vì hàm đó tự tạo user riêng,
    /// còn test HTTP cần hồ sơ thuộc đúng tài khoản đang cầm token.
    /// </summary>
    private async Task MakeVerifiedKtvAsync(Guid userId, Guid areaId, decimal balance)
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var profile = new KtvProfile
        {
            UserId = userId,
            FullName = $"KTV {Guid.NewGuid():N}"[..20],
            Slug = $"ktv-{Guid.NewGuid():N}"[..24],
            BasePoint = new NetTopologySuite.Geometries.Point(lon, lat) { SRID = 4326 },
            ServiceRadiusKm = 20,
            VerificationStatus = VerificationStatuses.Verified,
        };
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync();

        await TestData.CoverAsync(db, profile.Id, areaId);
        await WalletTestData.SeedWalletAsync(db, userId, balance);
    }

    private async Task<Guid> NewAreaAsync()
    {
        await using var db = fixture.CreateContext();
        return (await TestData.CreateAreaAsync(db, AreaLevels.District)).Id;
    }

    /// <summary>KTV đã duyệt, có sẵn tiền và một khu vực phục vụ.</summary>
    private async Task<(HttpClient Client, Guid AreaId)> ReadyKtvAsync(decimal balance = 2_000_000)
    {
        var (client, userId, _) = await _api.LoginAsync(UserRoles.Ktv);
        var areaId = await NewAreaAsync();
        await MakeVerifiedKtvAsync(userId, areaId, balance);
        return (client, areaId);
    }

    private async Task<Guid> SeedPackageAsync(int maxSlots = 3, decimal price = 500_000)
    {
        await using var db = fixture.CreateContext();
        var pkg = await WalletTestData.SeedPackageAsync(
            db, PackageTypes.VipPin, price: price, maxSlots: maxSlots);
        return pkg.Id;
    }

    private static HttpRequestMessage Buy(Guid packageId, Guid areaId, string? key)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/v1/campaigns")
        {
            Content = JsonContent.Create(new { packageId, areaId }),
        };
        if (key is not null) req.Headers.Add("Idempotency-Key", key);
        return req;
    }

    [Fact]
    public async Task Thiếu_Idempotency_Key_thì_bị_400_chứ_không_âm_thầm_mua()
    {
        var (client, areaId) = await ReadyKtvAsync();
        var packageId = await SeedPackageAsync();

        var res = await client.SendAsync(Buy(packageId, areaId, key: null));

        // Không có khoá thì không có gì chặn double-click thành hai lần trừ tiền.
        // Từ chối request còn hơn nhận một request không chống lặp được.
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.ProblemTitleAsync()).Should().Contain("Idempotency-Key");
    }

    [Fact]
    public async Task Mua_gói_thành_công_trả_200_và_trừ_đúng_tiền()
    {
        var (client, areaId) = await ReadyKtvAsync(balance: 2_000_000);
        var packageId = await SeedPackageAsync(price: 500_000);

        var res = await client.SendAsync(Buy(packageId, areaId, $"k-{Guid.NewGuid():N}"));

        res.StatusCode.Should().Be(HttpStatusCode.OK);

        var balance = await (await client.GetAsync("/api/v1/wallet/balance")).ReadAsync<WalletBalanceDto>();
        balance!.Balance.Should().Be(1_500_000);
    }

    [Fact]
    public async Task Hết_slot_trả_409_chứ_không_phải_500()
    {
        var packageId = await SeedPackageAsync(maxSlots: 1, price: 300_000);
        var (first, areaId) = await ReadyKtvAsync();

        // Người thứ hai cũng là KTV đã duyệt, phục vụ cùng khu vực — nhưng khu vực
        // chỉ còn đúng một chỗ.
        var (second, secondUserId, _) = await _api.LoginAsync(UserRoles.Ktv);
        await MakeVerifiedKtvAsync(secondUserId, areaId, 2_000_000);

        (await first.SendAsync(Buy(packageId, areaId, $"k-{Guid.NewGuid():N}")))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var res = await second.SendAsync(Buy(packageId, areaId, $"k-{Guid.NewGuid():N}"));

        // Hết chỗ là kết quả bình thường của việc bán hàng có giới hạn. Trả 500 ở
        // đây khiến client hiện "lỗi hệ thống" và KTV nghĩ nền tảng đang hỏng.
        res.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Không_đủ_số_dư_trả_400_kèm_thông_điệp_đọc_được()
    {
        var (client, areaId) = await ReadyKtvAsync(balance: 100_000);
        var packageId = await SeedPackageAsync(price: 500_000);

        var res = await client.SendAsync(Buy(packageId, areaId, $"k-{Guid.NewGuid():N}"));

        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        (await res.ProblemTitleAsync()).Should().Contain("không đủ");
    }

    [Fact]
    public async Task Hồ_sơ_chưa_duyệt_thì_không_mua_được_gói()
    {
        var (client, userId, _) = await _api.LoginAsync(UserRoles.Ktv);
        var packageId = await SeedPackageAsync();

        var areaId = await NewAreaAsync();
        await using (var db = fixture.CreateContext())
        {
            await WalletTestData.SeedWalletAsync(db, userId, 2_000_000);
        }

        var res = await client.SendAsync(Buy(packageId, areaId, $"k-{Guid.NewGuid():N}"));

        // Gói chỉ có tác dụng khi hồ sơ đã hiển thị trong tìm kiếm. Cho mua trước
        // là bán một thứ không dùng được.
        res.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task IPN_sai_chữ_ký_bị_từ_chối_và_không_cộng_tiền()
    {
        var (client, userId, _) = await _api.LoginAsync(UserRoles.Ktv);

        await using (var db = fixture.CreateContext())
        {
            await WalletTestData.SeedWalletAsync(db, userId, 0);
        }

        // Endpoint IPN buộc phải công khai để cổng gọi được — chữ ký là thứ duy
        // nhất phân biệt lời gọi thật với một request bất kỳ từ internet.
        var res = await _api.CreateClient().GetAsync(
            "/api/v1/wallet/topup/callback?vnp_TxnRef=gia-mao&vnp_Amount=100000000" +
            "&vnp_ResponseCode=00&vnp_TransactionStatus=00&vnp_SecureHash=deadbeef");

        // HTTP **200** kể cả với request giả mạo, và đó không phải là chấp nhận nó:
        // VNPay đọc `RspCode` trong body để quyết định có gọi lại hay không, và coi
        // mọi mã HTTP khác 200 là "chưa tới nơi". Trả 400 ở đây biến mỗi request giả
        // thành một vòng retry không bao giờ dứt. Lời từ chối nằm ở RspCode=97.
        res.StatusCode.Should().Be(HttpStatusCode.OK);
        (await res.Content.ReadAsStringAsync()).Should().Contain("97");

        // Bảo đảm thật sự cần giữ: không đồng nào được cộng.
        var balance = await (await client.GetAsync("/api/v1/wallet/balance")).ReadAsync<WalletBalanceDto>();
        balance!.Balance.Should().Be(0);
    }

    [Fact]
    public async Task Nạp_tiền_khi_chưa_cấu_hình_cổng_không_làm_sập_API()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        var res = await client.PostAsJsonAsync("/api/v1/wallet/topup", new { amount = 500_000 });

        // Môi trường test không có credential VNPay. Chấp nhận 500 (lỗi cấu hình
        // được báo rõ) nhưng KHÔNG được là 200 kèm một URL thanh toán hỏng — KTV
        // sẽ bấm vào rồi mới phát hiện ở màn hình cổng.
        res.StatusCode.Should().NotBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Số_tiền_nạp_ngoài_khoảng_cho_phép_bị_400()
    {
        var (client, _, _) = await _api.LoginAsync(UserRoles.Ktv);

        foreach (var amount in new[] { 1_000, 999_999_999 })
        {
            var res = await client.PostAsJsonAsync("/api/v1/wallet/topup", new { amount });
            res.StatusCode.Should().Be(HttpStatusCode.BadRequest, $"{amount} nằm ngoài giới hạn");
        }
    }

    /// <summary>
    /// Báo cáo doanh thu phải trả **tên** khu vực, không chỉ id.
    ///
    /// Trước đây endpoint trả GUID trần, nên người đọc phải tra ngược từng dòng bằng
    /// SQL để biết mình đang nhìn doanh thu ở đâu — tức báo cáo chỉ dùng được bởi
    /// người có quyền vào thẳng DB, đúng nhóm ít cần tới nó nhất. Ca hỏng im lặng:
    /// endpoint vẫn 200 và vẫn có đủ số.
    /// </summary>
    [Fact]
    public async Task Báo_cáo_doanh_thu_trả_tên_khu_vực_và_số_liệu_theo_ngày()
    {
        var (client, areaId) = await ReadyKtvAsync();
        var packageId = await SeedPackageAsync(price: 500_000);

        var mua = await client.SendAsync(Buy(packageId, areaId, Guid.NewGuid().ToString()));
        mua.StatusCode.Should().Be(HttpStatusCode.OK);

        string tênKhuVực;
        await using (var db = fixture.CreateContext())
            tênKhuVực = (await db.AdministrativeAreas.SingleAsync(a => a.Id == areaId)).Name;

        var admin = await _api.LoginAdminAsync();
        var báoCáo = await admin.GetFromJsonAsync<RevenueDto>("/api/v1/admin/revenue");

        var dòng = báoCáo!.Items.Should().ContainSingle(i => i.AreaId == areaId).Subject;

        dòng.AreaName.Should().Be(tênKhuVực);
        dòng.PackageType.Should().Be(PackageTypes.VipPin);

        // CAPTURE mang dấu âm trong sổ; báo cáo đảo dấu nên doanh thu ra số dương.
        dòng.NetRevenue.Should().Be(500_000);

        báoCáo.Daily.Should().NotBeEmpty(
            "lượt mua vừa rồi phải rơi vào đúng một ngày trong chuỗi — chuỗi rỗng nghĩa là "
            + "phần gom nhóm theo ngày không nhìn thấy giao dịch nào");
        báoCáo.Daily.Sum(d => d.NetRevenue).Should().Be(báoCáo.Items.Sum(i => i.NetRevenue),
            "hai cách gộp cùng một tập bút toán thì phải ra cùng một tổng");
    }

    private sealed record WalletBalanceDto(decimal Balance, decimal Held, decimal Available);

    private sealed record RevenueRow(
        Guid AreaId, string AreaName, string PackageType, decimal NetRevenue, int Transactions);

    private sealed record RevenueDay(DateOnly Date, decimal NetRevenue);

    private sealed record RevenueDto(
        decimal Total, List<RevenueRow> Items, List<RevenueDay> Daily);
}
