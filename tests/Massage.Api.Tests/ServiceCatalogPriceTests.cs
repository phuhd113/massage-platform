using FluentAssertions;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.ServiceCatalog;

namespace Massage.Api.Tests;

/// <summary>
/// Giá khởi điểm hiển thị trên thẻ dịch vụ ở trang chủ ("từ 300.000 ₫").
///
/// Đây là con số công khai đầu tiên khách nhìn thấy về giá, nên nó phải khớp với
/// thứ họ thật sự tìm được khi bấm vào — tức chỉ tính KTV đã duyệt, vì hồ sơ chưa
/// duyệt không xuất hiện trong bất kỳ kết quả tìm kiếm nào.
/// </summary>
[Collection(PostgresCollection.Name)]
public class ServiceCatalogPriceTests(PostgresFixture fixture)
{
    private ServiceCatalogService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Lấy_giá_thấp_nhất_trong_số_KTV_đã_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var dịchVụ = await TestData.CreateServiceAsync(db);

        var rẻ = await TestData.CreateKtvAsync(db, lat, lon);
        var đắt = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.LinkServiceAsync(db, rẻ.Id, dịchVụ.Id, priceFrom: 250_000m);
        await TestData.LinkServiceAsync(db, đắt.Id, dịchVụ.Id, priceFrom: 480_000m);

        var giá = await Service().GetPriceFloorAsync(dịchVụ.Id);

        giá.Should().Be(250_000m);
    }

    [Fact]
    public async Task Bỏ_qua_KTV_chưa_duyệt_dù_họ_chào_giá_rẻ_hơn()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var dịchVụ = await TestData.CreateServiceAsync(db);

        var đãDuyệt = await TestData.CreateKtvAsync(db, lat, lon);
        var chờDuyệt = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);
        await TestData.LinkServiceAsync(db, đãDuyệt.Id, dịchVụ.Id, priceFrom: 400_000m);
        await TestData.LinkServiceAsync(db, chờDuyệt.Id, dịchVụ.Id, priceFrom: 100_000m);

        var giá = await Service().GetPriceFloorAsync(dịchVụ.Id);

        // Lấy cả hồ sơ chưa duyệt thì trang chủ quảng cáo 100.000đ trong khi mọi kết
        // quả tìm kiếm đều từ 400.000đ — đúng nghĩa mồi chài, và không ai phát hiện
        // được vì cả hai con số đều "có thật" trong DB.
        giá.Should().Be(400_000m);
    }

    [Fact]
    public async Task Chưa_ai_chào_dịch_vụ_thì_không_có_giá()
    {
        await using var db = fixture.CreateContext();
        var dịchVụ = await TestData.CreateServiceAsync(db);

        var giá = await Service().GetPriceFloorAsync(dịchVụ.Id);

        // null chứ không phải 0: "từ 0 ₫" đọc như dịch vụ miễn phí.
        giá.Should().BeNull();
    }

    [Fact]
    public async Task Giá_bằng_0_không_được_coi_là_giá_thấp_nhất()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var dịchVụ = await TestData.CreateServiceAsync(db);

        var khaiThiếu = await TestData.CreateKtvAsync(db, lat, lon);
        var khaiĐủ = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.LinkServiceAsync(db, khaiThiếu.Id, dịchVụ.Id, priceFrom: 0m);
        await TestData.LinkServiceAsync(db, khaiĐủ.Id, dịchVụ.Id, priceFrom: 320_000m);

        var giá = await Service().GetPriceFloorAsync(dịchVụ.Id);

        giá.Should().Be(320_000m);
    }

    /// <remarks>
    /// Bản gộp và bản một dịch vụ phải cho cùng kết quả. Hai câu truy vấn riêng cho
    /// cùng một khái niệm là chỗ lệch nhau được: trang chủ và trang chi tiết sẽ hiện
    /// hai mức giá khác nhau cho đúng một dịch vụ mà không ai thấy sai ở đâu.
    /// </remarks>
    [Fact]
    public async Task Bản_gộp_và_bản_lẻ_cho_cùng_một_giá()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var dịchVụ = await TestData.CreateServiceAsync(db);
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.LinkServiceAsync(db, ktv.Id, dịchVụ.Id, priceFrom: 275_000m);

        var gộp = await Service().GetPriceFloorsAsync();
        var lẻ = await Service().GetPriceFloorAsync(dịchVụ.Id);

        gộp.GetValueOrDefault(dịchVụ.Id).Should().Be(275_000m);
        lẻ.Should().Be(275_000m);
    }
}
