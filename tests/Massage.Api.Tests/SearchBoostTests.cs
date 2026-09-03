using FluentAssertions;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Search;
using Massage.Promotion.Domain;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

/// <summary>
/// Cam kết thương mại của mô hình doanh thu: KTV trả phí đứng trên KTV miễn phí.
///
/// Đây là thứ khách hàng đã trả tiền để mua, nên nó phải có test canh chứ không
/// chỉ nằm trong tài liệu. Kiểm cả hai chiều: hạng nào giữ được lời hứa, và hạng
/// nào không.
/// </summary>
[Collection(PostgresCollection.Name)]
public class SearchBoostTests(PostgresFixture fixture)
{
    private static string Key(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    /// <summary>
    /// Truy vấn tìm theo một quận. Slug quận chỉ duy nhất trong phạm vi tỉnh nên phải
    /// gửi kèm tỉnh — thiếu vế đó là trộn KTV của mọi tỉnh trùng tên quận vào một trang.
    /// </summary>
    private async Task<SearchQueryDto> InAreaAsync(AdministrativeArea area, int size = 50)
    {
        await using var db = fixture.CreateContext();
        return new SearchQueryDto(
            AreaSlug: area.Slug,
            ProvinceSlug: await TestData.ProvinceSlugOfAsync(db, area.Id),
            Size: size);
    }

    private async Task<(Guid UserId, Guid KtvId)> KtvInAreaAsync(
        Guid areaId, decimal ratingAvg, int ratingCount, decimal balance = 2_000_000)
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: ratingAvg, ratingCount: ratingCount);
        await TestData.CoverAsync(db, ktv.Id, areaId);
        await WalletTestData.SeedWalletAsync(db, ktv.UserId, balance);
        return (ktv.UserId, ktv.Id);
    }

    [Fact]
    public async Task KTV_mua_VIP_Pin_đứng_trên_KTV_miễn_phí_có_điểm_nền_cao_nhất()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var vipPackage = await WalletTestData.SeedPackageAsync(
            setup, PackageTypes.VipPin, price: 500_000, maxSlots: 3);

        // KTV trả phí cố tình có hồ sơ kém hơn hẳn: chưa có đánh giá nào.
        var paid = await KtvInAreaAsync(area.Id, ratingAvg: 0m, ratingCount: 0);
        // Còn KTV miễn phí thì gần như hoàn hảo — 5 sao, 500 đánh giá.
        var organic = await KtvInAreaAsync(area.Id, ratingAvg: 5.00m, ratingCount: 500);

        await using var h = WalletTestData.Harness(fixture);
        await h.Buy.ExecuteAsync(paid.UserId, vipPackage.Id, area.Id, Key("vip"));

        var result = await new SearchService(fixture.CreateContext())
            .SearchAsync(await InAreaAsync(area));

        var order = result.Items.Select(i => i.Id).ToList();
        order.IndexOf(paid.KtvId).Should().BeLessThan(order.IndexOf(organic.KtvId),
            "VIP Pin +500 phải lớn hơn toàn bộ dải BaseScore (0–100) thì cam kết bán hàng mới giữ được");

        var paidItem = result.Items.Single(i => i.Id == paid.KtvId);
        paidItem.BoostPoints.Should().Be(500);
        paidItem.Score.Should().Be(paidItem.BoostPoints + paidItem.BaseScore,
            "Boost và Base phải tách rời, không được trộn vào nhau");

        result.Items.Single(i => i.Id == organic.KtvId).BoostPoints.Should().Be(0);
    }

    [Fact]
    public async Task Gói_mua_cho_khu_vực_này_không_đẩy_hạng_ở_khu_vực_khác()
    {
        await using var setup = fixture.CreateContext();
        var muaỞĐây = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var nhưngTìmỞKia = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(setup, PackageTypes.VipPin, price: 500_000);

        var ktv = await KtvInAreaAsync(muaỞĐây.Id, 4.5m, 10);
        await using (var db = fixture.CreateContext())
        {
            await TestData.CoverAsync(db, ktv.KtvId, nhưngTìmỞKia.Id);
        }

        await using var h = WalletTestData.Harness(fixture);
        await h.Buy.ExecuteAsync(ktv.UserId, package.Id, muaỞĐây.Id, Key("vip"));

        var result = await new SearchService(fixture.CreateContext())
            .SearchAsync(await InAreaAsync(nhưngTìmỞKia));

        // VIP Pin là ghim theo khu vực. Mua ở Quận 7 mà được ghim ở Hà Nội thì
        // khu vực đắt tiền có thể mua bằng giá của khu vực rẻ nhất.
        result.Items.Single(i => i.Id == ktv.KtvId).BoostPoints.Should().Be(0);
    }

    [Fact]
    public async Task Campaign_đã_huỷ_mất_boost_ngay_lập_tức()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(
            setup, PackageTypes.VipPin, price: 500_000, durationDays: 30);
        var ktv = await KtvInAreaAsync(area.Id, 4.5m, 10);

        var clock = new FakeClock(DateTimeOffset.UtcNow);
        await using var h = WalletTestData.Harness(fixture, clock);
        var bought = await h.Buy.ExecuteAsync(ktv.UserId, package.Id, area.Id, Key("vip"));

        var before = await new SearchService(fixture.CreateContext())
            .SearchAsync(await InAreaAsync(area));
        before.Items.Single(i => i.Id == ktv.KtvId).BoostPoints.Should().Be(500);

        await using var hc = WalletTestData.Harness(fixture, clock);
        await hc.Cancel.ExecuteAsync(ktv.UserId, bought.CampaignId);

        var after = await new SearchService(fixture.CreateContext())
            .SearchAsync(await InAreaAsync(area));
        after.Items.Single(i => i.Id == ktv.KtvId).BoostPoints.Should().Be(0,
            "đã hoàn tiền thì không được tiếp tục hưởng thứ hạng");
    }

    [Fact]
    public async Task Featured_Badge_đứng_trên_cả_KTV_miễn_phí_hoàn_hảo_nhất()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var badge = await WalletTestData.SeedPackageAsync(
            setup, PackageTypes.FeaturedBadge, price: 300_000, maxSlots: 20);

        // Dựng đúng tình huống bất lợi nhất cho người trả tiền: KTV mua Badge có
        // chất lượng trung bình và ở rìa bán kính; KTV miễn phí thì gần như tối đa
        // mọi thành phần BaseScore — ngay cạnh khách, 5 sao, phản hồi tuyệt đối.
        //
        // Trước ngày 2026-09-01, đúng cấu hình này khiến KTV miễn phí vượt lên và
        // lời hứa "trả phí thì đứng trên" bị phá. Badge nay là 150, lớn hơn dải
        // BaseScore, nên nó không thể xảy ra nữa — và test giữ nguyên cấu hình khắc
        // nghiệt đó để nếu ai hạ Badge xuống dưới 100 thì nó đỏ ngay.
        var (lat, lon) = TestData.RandomOrigin();

        var paidKtv = await TestData.CreateKtvAsync(
            setup, TestData.LatOffsetKm(lat, 9.5), lon, ratingAvg: 3.00m, ratingCount: 50);
        await TestData.CoverAsync(setup, paidKtv.Id, area.Id);
        await WalletTestData.SeedWalletAsync(setup, paidKtv.UserId, 1_000_000);

        var organicKtv = await TestData.CreateKtvAsync(
            setup, lat, lon, ratingAvg: 5.00m, ratingCount: 500);
        await TestData.CoverAsync(setup, organicKtv.Id, area.Id);
        await setup.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE ktv_profiles SET response_rate = 1 WHERE id = {organicKtv.Id}");

        await using var h = WalletTestData.Harness(fixture);
        await h.Buy.ExecuteAsync(paidKtv.UserId, badge.Id, area.Id, Key("badge"));

        // Tìm theo toạ độ để thành phần khoảng cách (0.35) tham gia — đây là chế độ
        // dải BaseScore mở rộng hết cỡ, và cũng là chế độ khách thật hay dùng nhất.
        var result = await new SearchService(fixture.CreateContext())
            .SearchAsync((await InAreaAsync(area)) with { Lat = lat, Lon = lon, RadiusKm = 10 });

        var paidItem = result.Items.Single(i => i.Id == paidKtv.Id);
        var organicItem = result.Items.Single(i => i.Id == organicKtv.Id);

        paidItem.BoostPoints.Should().Be(150);

        paidItem.Score.Should().BeGreaterThan(organicItem.Score,
            "Badge 150 lớn hơn dải BaseScore nên không điểm nền nào bù lại được");
        PackageTypes.GuaranteesTopPlacement(PackageTypes.FeaturedBadge).Should().BeTrue();

        // Nêu luôn lý do bằng số để nó nằm ngay trong test, không phải suy ra từ
        // hai con số rời rạc: điểm nền của KTV miễn phí, dù tối đa hoá mọi thành
        // phần, vẫn nằm dưới ngưỡng 100.
        organicItem.BaseScore.Should().BeLessThan(PackageTypes.MaxBaseScore);
    }

    [Fact]
    public async Task Không_cộng_dồn_điểm_của_nhiều_gói_đang_chạy()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var vip = await WalletTestData.SeedPackageAsync(setup, PackageTypes.VipPin, price: 500_000);
        var badge = await WalletTestData.SeedPackageAsync(
            setup, PackageTypes.FeaturedBadge, price: 300_000, maxSlots: 20);
        var ktv = await KtvInAreaAsync(area.Id, 4.5m, 10, balance: 5_000_000);

        await using var h1 = WalletTestData.Harness(fixture);
        await h1.Buy.ExecuteAsync(ktv.UserId, vip.Id, area.Id, Key("vip"));
        await using var h2 = WalletTestData.Harness(fixture);
        await h2.Buy.ExecuteAsync(ktv.UserId, badge.Id, area.Id, Key("badge"));

        var result = await new SearchService(fixture.CreateContext())
            .SearchAsync(await InAreaAsync(area));

        // Lấy MAX chứ không SUM: cộng dồn thì mua hai gói rẻ sẽ vượt gói đắt nhất,
        // và thứ tự giữa các hạng do phép cộng quyết định thay vì do bảng giá.
        result.Items.Single(i => i.Id == ktv.KtvId).BoostPoints.Should().Be(500);
    }
    [Fact]
    public async Task Boost_mua_ở_tỉnh_này_không_ăn_sang_tỉnh_trùng_tên_quận()
    {
        await using var setup = fixture.CreateContext();

        // Hai tỉnh cùng có một quận trùng slug — cấu hình có thật ở 10 tỉnh với
        // "Huyện Châu Thành". Khớp boost bằng slug trần nghĩa là gói VIP Pin mua ở
        // Tiền Giang đẩy hạng trên trang Bến Tre: bán một thứ, giao một thứ khác.
        var slugTrùng = $"huyen-chau-thanh-{Guid.NewGuid().ToString("N")[..8]}";

        var tỉnhMua = await TestData.CreateAreaAsync(setup, AreaLevels.Province);
        var tỉnhKhác = await TestData.CreateAreaAsync(setup, AreaLevels.Province);
        var quậnMua = await TestData.CreateAreaAsync(setup, AreaLevels.District, tỉnhMua.Id, slug: slugTrùng);
        var quậnKhác = await TestData.CreateAreaAsync(setup, AreaLevels.District, tỉnhKhác.Id, slug: slugTrùng);

        var package = await WalletTestData.SeedPackageAsync(setup, PackageTypes.VipPin, price: 500_000);

        var ktv = await KtvInAreaAsync(quậnMua.Id, 4.5m, 10);
        await using (var db = fixture.CreateContext())
            await TestData.CoverAsync(db, ktv.KtvId, quậnKhác.Id);

        await using var h = WalletTestData.Harness(fixture);
        await h.Buy.ExecuteAsync(ktv.UserId, package.Id, quậnMua.Id, Key("vip"));

        var ởTỉnhKhác = await new SearchService(fixture.CreateContext())
            .SearchAsync(new SearchQueryDto(
                AreaSlug: slugTrùng, ProvinceSlug: tỉnhKhác.Slug, Size: 50));

        ởTỉnhKhác.Items.Single(i => i.Id == ktv.KtvId).BoostPoints.Should().Be(0,
            "gói bán theo từng khu vực với giá của khu vực đó — trùng tên quận không phải là cùng một khu vực");

        var ởTỉnhMua = await new SearchService(fixture.CreateContext())
            .SearchAsync(new SearchQueryDto(
                AreaSlug: slugTrùng, ProvinceSlug: tỉnhMua.Slug, Size: 50));

        ởTỉnhMua.Items.Single(i => i.Id == ktv.KtvId).BoostPoints.Should().Be(500,
            "còn ở đúng khu vực đã mua thì phải nhận đủ điểm boost");
    }

    [Fact]
    public async Task Boost_mua_ở_quận_không_ăn_sang_trang_tỉnh()
    {
        await using var setup = fixture.CreateContext();
        var tỉnh = await TestData.CreateAreaAsync(setup, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(setup, AreaLevels.District, tỉnh.Id);
        var package = await WalletTestData.SeedPackageAsync(setup, PackageTypes.VipPin, price: 500_000);

        var ktv = await KtvInAreaAsync(quận.Id, 4.5m, 10);

        await using var h = WalletTestData.Harness(fixture);
        await h.Buy.ExecuteAsync(ktv.UserId, package.Id, quận.Id, Key("vip"));

        // Bộ lọc mở lên cấp tỉnh để trang tỉnh có danh sách, nhưng boost thì không:
        // gói mua ở một quận mà ăn thứ hạng trên trang tỉnh là phát không phần tồn kho
        // chưa bán. KTV vẫn xuất hiện, chỉ là với 0 điểm boost.
        var trangTỉnh = await new SearchService(fixture.CreateContext())
            .SearchAsync(new SearchQueryDto(AreaSlug: tỉnh.Slug, Size: 50));

        trangTỉnh.Items.Single(i => i.Id == ktv.KtvId).BoostPoints.Should().Be(0);
    }
}
