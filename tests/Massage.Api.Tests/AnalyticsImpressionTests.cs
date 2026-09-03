using FluentAssertions;
using Massage.Api.Modules.Analytics.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Search;

namespace Massage.Api.Tests;

/// <summary>
/// Impression là bậc đầu của phễu và là thứ gói đẩy tin trực tiếp bán, nên nó phải được
/// ghi đúng — nhưng cũng phải <b>không</b> làm chậm đường đọc mà cả sàn sống nhờ.
/// </summary>
[Collection(PostgresCollection.Name)]
public class AnalyticsImpressionTests(PostgresFixture fixture)
{
    [Fact]
    public async Task Mỗi_kết_quả_tìm_kiếm_sinh_một_impression_kèm_thứ_hạng()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();
        var queue = new FakeAnalyticsQueue();

        for (var i = 0; i < 3; i++) await TestData.CreateKtvAsync(db, lat, lon);

        var result = await new SearchService(fixture.CreateContext(), queue)
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 5));

        var impressions = queue.OfType(AnalyticsEventTypes.Impression);
        impressions.Should().HaveCount(result.Items.Count);

        // Thứ hạng phải khớp đúng thứ tự trả về: đây là con số đo hiệu quả gói đẩy tin,
        // mà gói bán chính là thứ hạng.
        impressions.Select(e => e.Position).Should().Equal(
            Enumerable.Range(1, result.Items.Count).Cast<int?>());
        impressions.Select(e => e.KtvId).Should().Equal(result.Items.Select(i => i.Id));
    }

    [Fact]
    public async Task Thứ_hạng_ở_trang_sau_tiếp_nối_trang_trước()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();
        var queue = new FakeAnalyticsQueue();

        for (var i = 0; i < 4; i++) await TestData.CreateKtvAsync(db, lat, lon);

        await new SearchService(fixture.CreateContext(), queue)
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 5, Page: 2, Size: 2));

        // Không cộng phần bù trang thì mọi trang đều báo hạng 1..N, và "hạng trung bình"
        // của một KTV luôn đẹp bất kể họ thực sự nằm ở đâu.
        queue.OfType(AnalyticsEventTypes.Impression)
            .Select(e => e.Position)
            .Should().Equal([3, 4]);
    }

    [Fact]
    public async Task Tìm_theo_toạ_độ_không_gán_khu_vực_cho_impression()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();
        var queue = new FakeAnalyticsQueue();

        await TestData.CreateKtvAsync(db, lat, lon);

        await new SearchService(fixture.CreateContext(), queue)
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 5));

        // Chưa xác định được khu vực hành chính của khách khi tìm theo toạ độ. Gán bừa
        // một khu vực sẽ làm báo cáo "hiệu quả gói ở Quận 7" tính cả lượt của người ở
        // quận khác — tức là bán một con số sai cho chính người trả tiền.
        queue.OfType(AnalyticsEventTypes.Impression)
            .Should().OnlyContain(e => e.AreaId == null);
    }

    [Fact]
    public async Task Tìm_theo_khu_vực_gán_đúng_khu_vực_đã_tìm()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();
        var queue = new FakeAnalyticsQueue();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktv.Id, quận.Id);

        await new SearchService(fixture.CreateContext(), queue)
            .SearchAsync(new SearchQueryDto(AreaSlug: quận.Slug, ProvinceSlug: tỉnh.Slug));

        queue.OfType(AnalyticsEventTypes.Impression)
            .Should().OnlyContain(e => e.AreaId == quận.Id);
    }

    [Fact]
    public async Task Kết_quả_rỗng_không_sinh_impression_nào()
    {
        var (lat, lon) = TestData.RandomOrigin();
        var queue = new FakeAnalyticsQueue();

        // Bán kính quanh một điểm ngẫu nhiên không có KTV nào.
        await new SearchService(fixture.CreateContext(), queue)
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 1));

        queue.Events.Should().BeEmpty();
    }

    [Fact]
    public async Task Lead_bị_gộp_không_được_đếm_lần_hai_vào_phễu()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var queue = new FakeAnalyticsQueue();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var service = new Massage.Api.Modules.Leads.LeadService(fixture.CreateContext(), queue);
        var dto = new Massage.Api.Modules.Leads.CreateLeadDto(ktv.Id, "CALL", null, null);

        var lần1 = await service.CreateAsync(dto, null, "203.0.113.7", "UA/1.0");
        var lần2 = await service.CreateAsync(dto, null, "203.0.113.7", "UA/1.0");

        lần1.Deduplicated.Should().BeFalse();
        lần2.Deduplicated.Should().BeTrue();

        // Một người bấm gọi hai lần trong cửa sổ gộp là một ý định, không phải hai. Đếm
        // cả lượt gộp sẽ làm tỉ lệ chuyển đổi trên dashboard cao hơn sự thật — đúng con
        // số KTV dùng để quyết định có gia hạn gói hay không.
        queue.OfType(AnalyticsEventTypes.Lead).Should().HaveCount(1);
    }
}
