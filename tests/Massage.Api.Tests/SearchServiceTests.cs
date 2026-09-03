using FluentAssertions;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Search;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class SearchServiceTests(PostgresFixture fixture)
{
    private SearchService Service() => Service(new FakeAnalyticsQueue());

    private SearchService Service(FakeAnalyticsQueue queue) => new(fixture.CreateContext(), queue);

    [Fact]
    public async Task Chỉ_trả_KTV_nằm_trong_bán_kính_khách_yêu_cầu()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();

        var gần = await TestData.CreateKtvAsync(db, TestData.LatOffsetKm(lat, 4.9), lon);
        var xa = await TestData.CreateKtvAsync(db, TestData.LatOffsetKm(lat, 5.1), lon);

        var result = await Service().SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 5));

        var ids = result.Items.Select(i => i.Id).ToList();
        ids.Should().Contain(gần.Id);
        ids.Should().NotContain(xa.Id);
    }

    [Fact]
    public async Task Hồ_sơ_chưa_duyệt_không_lọt_vào_kết_quả()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();

        var duyệt = await TestData.CreateKtvAsync(db, lat, lon);
        var chờ = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);
        var từChối = await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Rejected);

        var result = await Service().SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        var ids = result.Items.Select(i => i.Id).ToList();
        ids.Should().Contain(duyệt.Id);
        ids.Should().NotContain(chờ.Id).And.NotContain(từChối.Id);
    }

    [Fact]
    public async Task KTV_không_nhận_đi_xa_thì_không_hiện_dù_khách_tìm_bán_kính_rộng()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();

        // Cả hai đều cách khách 8km. Người thứ hai chỉ nhận đi trong 5km nên không
        // phục vụ được — hiện lên chỉ tạo cuộc gọi hỏng cho cả hai bên.
        var nhậnĐiXa = await TestData.CreateKtvAsync(db, TestData.LatOffsetKm(lat, 8), lon, serviceRadiusKm: 20);
        var chỉNhậnGần = await TestData.CreateKtvAsync(db, TestData.LatOffsetKm(lat, 8), lon, serviceRadiusKm: 5);

        var result = await Service().SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 30));

        var ids = result.Items.Select(i => i.Id).ToList();
        ids.Should().Contain(nhậnĐiXa.Id);
        ids.Should().NotContain(chỉNhậnGần.Id);
    }

    [Fact]
    public async Task Lọc_theo_dịch_vụ_chỉ_giữ_KTV_có_cung_cấp_dịch_vụ_đó()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();

        var service = await TestData.CreateServiceAsync(db);
        var có = await TestData.CreateKtvAsync(db, lat, lon);
        var không = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.LinkServiceAsync(db, có.Id, service.Id);

        var result = await Service().SearchAsync(
            new SearchQueryDto(lat, lon, RadiusKm: 10, Service: service.Slug));

        result.Items.Select(i => i.Id).Should().Contain(có.Id).And.NotContain(không.Id);
    }

    [Fact]
    public async Task Tìm_theo_khu_vực_không_cần_toạ_độ()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var area = await TestData.CreateAreaAsync(db, AreaLevels.District);
        var trongKhuVực = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, trongKhuVực.Id, area.Id);

        // Trang landing khu vực render ở server, không có GPS của khách — nếu chế độ
        // này không chạy thì toàn bộ kênh SEO không có dữ liệu để hiển thị.
        // Slug quận chỉ duy nhất trong phạm vi tỉnh nên phải gửi kèm tỉnh.
        var result = await Service().SearchAsync(new SearchQueryDto(
            AreaSlug: area.Slug, ProvinceSlug: await TestData.ProvinceSlugOfAsync(db, area.Id)));

        result.Items.Should().ContainSingle().Which.Id.Should().Be(trongKhuVực.Id);
        result.Items[0].DistanceM.Should().BeNull("không có toạ độ khách thì không có khoảng cách để tính");
    }

    [Fact]
    public async Task Phase_1_chưa_bán_gói_nên_BoostPoints_luôn_bằng_0()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();
        await TestData.CreateKtvAsync(db, lat, lon);

        var result = await Service().SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        var item = result.Items.Should().ContainSingle().Subject;
        item.BoostPoints.Should().Be(0);
        // Boost và Base là hai thành phần tách rời; nếu chúng bị trộn vào nhau thì
        // Phase 2 sẽ không còn chỗ để cắm điểm gói trả phí vào.
        item.Score.Should().Be(item.BoostPoints + item.BaseScore);
        item.BaseScore.Should().BeInRange(0, 100);
    }

    [Fact]
    public async Task Toạ_độ_công_khai_được_làm_tròn_về_khoảng_100m()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();
        await TestData.CreateKtvAsync(db, lat, lon);

        var result = await Service().SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        var item = result.Items.Should().ContainSingle().Subject;
        item.Lat.Should().Be(Math.Round(lat, 3));
        item.Lon.Should().Be(Math.Round(lon, 3));
    }

    [Fact]
    public async Task Phân_trang_trả_về_tổng_số_đúng_của_toàn_bộ_kết_quả()
    {
        var (lat, lon) = TestData.RandomOrigin();
        await using var db = fixture.CreateContext();
        for (var i = 0; i < 3; i++)
            await TestData.CreateKtvAsync(db, TestData.LatOffsetKm(lat, i * 0.5), lon);

        var page1 = await Service().SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10, Page: 1, Size: 2));

        page1.Items.Should().HaveCount(2);
        page1.Total.Should().Be(3, "tổng phải là số kết quả trước khi phân trang");
    }

    [Fact]
    public async Task AreaSlug_không_lẫn_KTV_giữa_hai_tỉnh_trùng_slug_quận()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        // Cả nước có 10 tỉnh cùng chứa "Huyện Châu Thành". Khớp bằng slug trần sẽ gộp
        // KTV của cả mười vào một trang — test này đỏ với bản khớp slug cũ.
        var slugTrùng = $"huyen-chau-thanh-{Guid.NewGuid().ToString("N")[..8]}";

        var tỉnhA = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var tỉnhB = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quậnA = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnhA.Id, slug: slugTrùng);
        var quậnB = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnhB.Id, slug: slugTrùng);

        var ktvA = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktvA.Id, quậnA.Id);
        var ktvB = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktvB.Id, quậnB.Id);

        // Phải kiểm CẢ HAI chiều. Chỉ kiểm một chiều thì bản khớp slug trần vẫn xanh:
        // FirstOrDefault trả về hàng nào Postgres đưa ra trước, và thường trúng ngay
        // tỉnh tạo trước — tức test đúng vì may, không phải vì code đúng.
        var ởA = await Service().SearchAsync(new SearchQueryDto(
            AreaSlug: slugTrùng, ProvinceSlug: tỉnhA.Slug, Size: 50));
        var ởB = await Service().SearchAsync(new SearchQueryDto(
            AreaSlug: slugTrùng, ProvinceSlug: tỉnhB.Slug, Size: 50));

        ởA.Items.Should().ContainSingle().Which.Id.Should().Be(ktvA.Id);
        ởB.Items.Should().ContainSingle().Which.Id.Should().Be(ktvB.Id);
    }

    [Fact]
    public async Task Tìm_theo_slug_tỉnh_trả_về_KTV_của_các_quận_trực_thuộc()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktv.Id, quận.Id);

        // KTV chỉ khai coverage ở mức quận, nên so thẳng area_id với id tỉnh luôn rỗng:
        // trang tỉnh hiện danh sách trắng ngay dưới dòng "N kỹ thuật viên đang nhận khách".
        var kếtQuả = await Service().SearchAsync(new SearchQueryDto(AreaSlug: tỉnh.Slug, Size: 50));

        kếtQuả.Items.Select(i => i.Id).Should().Contain(ktv.Id);
    }

    [Fact]
    public async Task Slug_khu_vực_không_tồn_tại_trả_rỗng_chứ_không_trả_cả_nước()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var tỉnh = await TestData.CreateAreaAsync(db, AreaLevels.Province);
        var quận = await TestData.CreateAreaAsync(db, AreaLevels.District, tỉnh.Id);
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CoverAsync(db, ktv.Id, quận.Id);

        // Rơi về "không giới hạn khu vực" ở đây nghĩa là một URL gõ sai trả về toàn bộ
        // KTV cả nước — im lặng và rất khó phát hiện.
        var kếtQuả = await Service().SearchAsync(
            new SearchQueryDto(AreaSlug: $"khong-ton-tai-{Guid.NewGuid():N}", Size: 50));

        kếtQuả.Items.Should().BeEmpty();
        kếtQuả.Total.Should().Be(0);
    }
}

[Collection(PostgresCollection.Name)]
public class SearchRankingTests(PostgresFixture fixture)
{
    [Fact]
    public async Task Một_review_5_sao_không_vượt_được_hai_trăm_review_4_8_sao()
    {
        await using var db = fixture.CreateContext();
        await db.KtvProfiles.ExecuteDeleteAsync();

        var (lat, lon) = TestData.RandomOrigin();

        // Nền dữ liệu có cả hồ sơ tầm trung, giống một hệ thống đang chạy thật.
        // Tiên nghiệm Bayesian là trung bình toàn hệ thống, nên nếu chỉ có đúng hai
        // hồ sơ trong bảng thì tiên nghiệm bị chính hai hồ sơ đó kéo lên và làm mượt
        // không còn tác dụng — xem ghi chú ở SearchService về giới hạn này.
        await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.20m, ratingCount: 40);
        await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.00m, ratingCount: 25);

        // Hai hồ sơ so sánh đặt cùng một điểm để thành phần khoảng cách bằng nhau,
        // chỉ còn rating quyết định thứ tự.
        var mớiToanh = await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 5.00m, ratingCount: 1);
        var lâuNăm = await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.80m, ratingCount: 200);

        var result = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        var thứTự = result.Items.Select(i => i.Id).ToList();
        thứTự.IndexOf(lâuNăm.Id).Should().BeLessThan(thứTự.IndexOf(mớiToanh.Id),
            "làm mượt Bayesian phải giữ KTV có nhiều đánh giá tốt đứng trên KTV mới có đúng một đánh giá 5 sao");
    }

    [Fact]
    public async Task Làm_mượt_kéo_điểm_hồ_sơ_một_review_về_gần_mặt_bằng_chung()
    {
        await using var db = fixture.CreateContext();
        await db.KtvProfiles.ExecuteDeleteAsync();

        var (lat, lon) = TestData.RandomOrigin();
        await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.20m, ratingCount: 40);
        var mớiToanh = await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 5.00m, ratingCount: 1);

        var result = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        // Không làm mượt, hồ sơ một review đóng góp trọn 0.40 × 100 = 40 điểm rating.
        // Đây là phần bảo vệ thật sự mà làm mượt mang lại, độc lập với mặt bằng chung.
        var item = result.Items.Single(i => i.Id == mớiToanh.Id);
        var điểmRating = item.BaseScore - 35.0 - 10.0;  // trừ phần khoảng cách và độ mới
        điểmRating.Should().BeLessThan(38.0, "một đánh giá 5 sao không được tính như 200 đánh giá 5 sao");
    }

    [Fact]
    public async Task KTV_gần_hơn_đứng_trên_khi_rating_ngang_nhau()
    {
        await using var db = fixture.CreateContext();
        await db.KtvProfiles.ExecuteDeleteAsync();

        var (lat, lon) = TestData.RandomOrigin();
        var gần = await TestData.CreateKtvAsync(db, TestData.LatOffsetKm(lat, 1), lon, ratingAvg: 4.50m, ratingCount: 20);
        var xa = await TestData.CreateKtvAsync(db, TestData.LatOffsetKm(lat, 9), lon, ratingAvg: 4.50m, ratingCount: 20);

        var result = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        result.Items[0].Id.Should().Be(gần.Id);
        result.Items[1].Id.Should().Be(xa.Id);
    }

    [Fact]
    public async Task Lọc_đang_nhận_khách_loại_KTV_đang_bận()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var rảnh = await TestData.CreateKtvAsync(db, lat, lon, isOnline: true);
        var bận = await TestData.CreateKtvAsync(db, lat, lon, isOnline: false);

        var lọc = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10, IsOnline: true));

        var ids = lọc.Items.Select(i => i.Id).ToList();
        ids.Should().Contain(rảnh.Id).And.NotContain(bận.Id);

        // Không truyền cờ thì không lọc — `false` và `null` phải cho cùng kết quả,
        // nếu không thì "bỏ chọn bộ lọc" lại biến thành "chỉ hiện KTV đang bận".
        var khôngLọc = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));
        var khôngLọcIds = khôngLọc.Items.Select(i => i.Id).ToList();
        khôngLọcIds.Should().Contain(rảnh.Id).And.Contain(bận.Id);

        var tắtCờ = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10, IsOnline: false));
        tắtCờ.Items.Select(i => i.Id).Should().Contain(bận.Id);
    }

    [Fact]
    public async Task Chỉ_đếm_chứng_chỉ_đã_duyệt_trên_thẻ_listing()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        await TestData.AddCertificationAsync(db, ktv.Id);
        await TestData.AddCertificationAsync(db, ktv.Id);
        await TestData.AddCertificationAsync(db, ktv.Id, VerificationStatuses.Pending);
        await TestData.AddCertificationAsync(db, ktv.Id, VerificationStatuses.Rejected);

        var result = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        var item = result.Items.Single(i => i.Id == ktv.Id);
        item.VerifiedCertCount.Should().Be(
            2,
            "thẻ hiển thị con số này kèm chữ 'đã duyệt' — đếm cả hồ sơ chờ xét hoặc bị " +
            "từ chối là nói với khách rằng KTV đã được xác minh nhiều hơn thực tế");
    }

    [Fact]
    public async Task Thẻ_listing_lấy_tối_đa_hai_dịch_vụ_rẻ_nhất()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var đắt = await TestData.CreateServiceAsync(db);
        var rẻ = await TestData.CreateServiceAsync(db);
        var vừa = await TestData.CreateServiceAsync(db);
        await TestData.LinkServiceAsync(db, ktv.Id, đắt.Id, priceFrom: 480_000m, durationMin: 90);
        await TestData.LinkServiceAsync(db, ktv.Id, rẻ.Id, priceFrom: 280_000m, durationMin: 45);
        await TestData.LinkServiceAsync(db, ktv.Id, vừa.Id, priceFrom: 350_000m, durationMin: 60);

        var result = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        var item = result.Items.Single(i => i.Id == ktv.Id);

        // Giá thấp nhất là thứ khách dùng để so sánh nhanh giữa các thẻ, nên thứ tự
        // này là nội dung chứ không phải trang trí.
        item.Services.Should().HaveCount(2, "thẻ chỉ có chỗ cho hai dòng giá");
        item.Services.Select(s => s.PriceFrom).Should().ContainInOrder(280_000m, 350_000m);
        item.Services[0].DurationMin.Should().Be((short)45);
    }

    [Fact]
    public async Task KTV_chưa_khai_dịch_vụ_trả_về_danh_sách_rỗng_chứ_không_phải_null()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var result = await new SearchService(fixture.CreateContext(), new FakeAnalyticsQueue())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        var item = result.Items.Single(i => i.Id == ktv.Id);

        // Hồ sơ mới chưa khai gì vẫn phải hiện được trên thẻ. Trả null ở đây buộc mọi
        // chỗ đọc phải tự phòng thủ, và chỗ nào quên thì vỡ đúng lúc có KTV mới.
        item.Services.Should().BeEmpty();
        item.VerifiedCertCount.Should().Be(0);
    }
}


/// <summary>
/// Canh chi phí của đường search — thứ không nhìn thấy được bằng test chức năng.
/// </summary>
public class SearchQueryShapeTests
{
    /// <summary>
    /// Hồi quy cho một lỗi hiệu năng thật, đo được ngày 2026-09-02.
    ///
    /// CTE <c>global</c> (tiên nghiệm Bayesian) từng không có <c>MATERIALIZED</c>,
    /// nên Postgres inline nó vào nested loop và tính lại **một lần cho mỗi ứng
    /// viên** — mỗi lần là một seq scan toàn bảng <c>ktv_profiles</c>. Đo trên 5.000
    /// hồ sơ / 1.117 ứng viên: p50 của API là 2,59 giây; thêm một từ khoá còn 29ms.
    ///
    /// Vì sao canh bằng chuỗi SQL chứ không bằng EXPLAIN hay đồng hồ — đã thử cả hai
    /// và cả hai đều không dùng được:
    ///
    /// <list type="bullet">
    /// <item>EXPLAIN trên database test (vài chục hồ sơ) cho kế hoạch hoàn toàn
    /// khác: planner không chọn nested loop nên seq scan lặp không xuất hiện, và
    /// test vẫn xanh kể cả khi đã bỏ MATERIALIZED. Đã kiểm chứng đúng như vậy.</item>
    /// <item>Đo thời gian thì phụ thuộc tốc độ máy CI, ngưỡng chặt sẽ đỏ vu vơ còn
    /// ngưỡng lỏng thì không bắt được gì.</item>
    /// </list>
    ///
    /// Chuỗi SQL là thứ duy nhất tất định ở đây. Test này yếu — nó không chứng minh
    /// kế hoạch thực thi tốt — nhưng nó chặn đúng thao tác đã gây ra lỗi: ai đó xoá
    /// từ khoá này mà không biết vì sao nó ở đó.
    /// </summary>
    [Fact]
    public void CTE_tiên_nghiệm_rating_phải_là_MATERIALIZED()
    {
        SearchService.SqlForDiagnostics.Should().Contain("global AS MATERIALIZED",
            "thiếu MATERIALIZED thì Postgres tính lại tiên nghiệm cho từng ứng viên — " +
            "mỗi lần một seq scan toàn bảng ktv_profiles (đo được: chậm hơn 55 lần " +
            "trên 5.000 hồ sơ). Xem ghi chú trong SearchService.");
    }

    /// <summary>
    /// Dữ liệu cho thẻ (chứng chỉ, dịch vụ) phải đọc SAU khi đã phân trang.
    ///
    /// Cùng một loại lỗi với MATERIALIZED và cũng vô hình trên dữ liệu test nhỏ: nếu
    /// hai subquery này nằm trên CTE <c>paged</c>, chúng chạy một lần cho mỗi *ứng
    /// viên* thay vì mỗi *dòng của trang* — ở 5.000 hồ sơ là 1.064 lần thay vì 20.
    /// Đo được sau khi làm đúng thứ tự: <c>loops=20</c>, p50 28ms.
    ///
    /// Canh bằng vị trí chuỗi vì đó là thứ tất định duy nhất ở đây — xem lý do đầy đủ
    /// ở test MATERIALIZED bên trên.
    /// </summary>
    [Fact]
    public void Dữ_liệu_thẻ_phải_đọc_sau_khi_phân_trang()
    {
        var sql = SearchService.SqlForDiagnostics;

        var vịTríPhânTrang = sql.IndexOf("paged AS (", StringComparison.Ordinal);
        var vịTríĐếmChứngChỉ = sql.IndexOf("FROM certifications", StringComparison.Ordinal);
        var vịTríDịchVụ = sql.IndexOf("FROM ktv_services ks", StringComparison.Ordinal);

        vịTríPhânTrang.Should().BeGreaterThan(0, "CTE phân trang phải tồn tại");

        vịTríĐếmChứngChỉ.Should().BeGreaterThan(vịTríPhânTrang,
            "đếm chứng chỉ phải nằm sau CTE phân trang, nếu không nó chạy cho từng ứng " +
            "viên chứ không phải từng dòng của trang");

        // Lọc dịch vụ theo `sv.slug` vẫn nằm trong `candidates` (đó là bộ lọc tìm kiếm,
        // phải chạy trước phân trang); phần lấy giá hiển thị mới là phần bị canh ở đây.
        sql.IndexOf("FROM ktv_services ks", vịTríPhânTrang, StringComparison.Ordinal)
            .Should().BeGreaterThan(vịTríPhânTrang,
                "phần lấy giá dịch vụ cho thẻ phải nằm sau CTE phân trang");

        vịTríDịchVụ.Should().BeGreaterThan(0);
    }
}
