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
    private SearchService Service() => new(fixture.CreateContext());

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
        var result = await Service().SearchAsync(new SearchQueryDto(AreaSlug: area.Slug));

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
}

/// <summary>
/// Test xếp hạng tách riêng vì công thức Bayesian dùng rating trung bình
/// <em>toàn hệ thống</em> làm tiên nghiệm. Dữ liệu sót lại từ test khác sẽ kéo giá
/// trị đó đi và làm kết quả dao động, nên ở đây phải dọn bảng — an toàn vì xUnit
/// chạy tuần tự các test trong cùng một collection.
/// </summary>
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

        var result = await new SearchService(fixture.CreateContext())
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

        var result = await new SearchService(fixture.CreateContext())
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

        var result = await new SearchService(fixture.CreateContext())
            .SearchAsync(new SearchQueryDto(lat, lon, RadiusKm: 10));

        result.Items[0].Id.Should().Be(gần.Id);
        result.Items[1].Id.Should().Be(xa.Id);
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
}
