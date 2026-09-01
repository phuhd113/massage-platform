using FluentAssertions;
using Massage.Api.Modules.Areas;
using Massage.Api.Modules.KtvProfiles.Entities;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class AreaServiceTests(PostgresFixture fixture)
{
    private AreaService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Khu_vực_dưới_ngưỡng_KTV_không_được_cho_index()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        for (var i = 0; i < AreaService.MinKtvForIndex - 1; i++)
        {
            var ktv = await TestData.CreateKtvAsync(db, lat, lon);
            await TestData.CoverAsync(db, ktv.Id, quận.Id);
        }

        var trướcNgưỡng = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        trướcNgưỡng.KtvCount.Should().Be(AreaService.MinKtvForIndex - 1);
        trướcNgưỡng.Indexable.Should().BeFalse(
            "trang gần rỗng lọt vào index sẽ bị Google xếp là doorway page và kéo cả tên miền xuống");

        var thêmMột = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, thêmMột.Id, quận.Id);

        var sauNgưỡng = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);
        sauNgưỡng.KtvCount.Should().Be(AreaService.MinKtvForIndex);
        sauNgưỡng.Indexable.Should().BeTrue();
    }

    [Fact]
    public async Task KTV_phủ_nhiều_quận_chỉ_được_đếm_một_lần_ở_cấp_tỉnh()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktv.Id, quậnA.Id);
        await TestData.CoverAsync(db, ktv.Id, quậnB.Id);

        var tỉnhDto = await Service().GetProvinceAsync(tỉnh.Slug);

        // Cộng dồn số liệu quận sẽ ra 2 và đẩy trang tỉnh vượt ngưỡng index bằng
        // một KTV duy nhất — đúng kiểu thin content mà ngưỡng này sinh ra để chặn.
        tỉnhDto.KtvCount.Should().Be(1);
    }

    [Fact]
    public async Task Hồ_sơ_chưa_duyệt_không_được_tính_vào_số_KTV_của_khu_vực()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var duyệt = await TestData.CreateKtvAsync(db, lat, lon);
        var chờ = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);
        await TestData.CoverAsync(db, duyệt.Id, quận.Id);
        await TestData.CoverAsync(db, chờ.Id, quận.Id);

        var dto = await Service().GetDistrictAsync(tỉnh.Slug, quận.Slug);

        dto.KtvCount.Should().Be(1);
    }

    [Fact]
    public async Task Quận_lân_cận_được_trả_về_để_liên_kết_chéo()
    {
        await using var db = fixture.CreateContext();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);

        var dto = await Service().GetDistrictAsync(tỉnh.Slug, quậnA.Slug);

        dto.Parent!.Slug.Should().Be(tỉnh.Slug);
        dto.Siblings.Select(s => s.Slug).Should().Contain(quậnB.Slug);
        dto.Siblings.Select(s => s.Slug).Should().NotContain(quậnA.Slug);
    }

    [Fact]
    public async Task Slug_quận_không_thuộc_tỉnh_thì_báo_không_tìm_thấy()
    {
        await using var db = fixture.CreateContext();
        var tỉnh1 = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var tỉnh2 = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnCủaTỉnh2 = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh2.Id);

        var thử = async () => await Service().GetDistrictAsync(tỉnh1.Slug, quậnCủaTỉnh2.Slug);

        await thử.Should().ThrowAsync<Massage.Api.Common.NotFoundException>();
    }
}
