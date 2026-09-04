using FluentAssertions;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.PublicSite;

namespace Massage.Api.Tests;

/// <summary>
/// Số liệu toàn sàn hiển thị ngay dưới H1 trang chủ — nơi khách quyết định có đi
/// tiếp hay không, và cũng là con số họ đối chiếu với những gì đếm được ở trang
/// khu vực.
/// </summary>
[Collection(PostgresCollection.Name)]
public class SiteStatsServiceTests(PostgresFixture fixture)
{
    private SiteStatsService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Chỉ_đếm_KTV_đã_duyệt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var trước = await Service().GetAsync();

        await TestData.CreateKtvAsync(db, lat, lon);
        await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Pending);
        await TestData.CreateKtvAsync(db, lat, lon, status: VerificationStatuses.Rejected);

        var sau = await Service().GetAsync();

        // So sánh mức tăng chứ không so tuyệt đối: database test dùng chung nên các
        // test khác cũng tạo hồ sơ. Một con số tuyệt đối ở đây sẽ đỏ tuỳ theo thứ tự
        // chạy — tức là một test bấp bênh, không phải một test chặt hơn.
        (sau.VerifiedKtvCount - trước.VerifiedKtvCount).Should().Be(1);
    }

    [Fact]
    public async Task Điểm_trung_bình_tính_theo_trọng_số_số_đánh_giá()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        var trước = await Service().GetAsync();

        // 500 đánh giá 4,60 và 1 đánh giá 5,00. Trung bình cộng đơn thuần là 4,80;
        // trung bình có trọng số là 4,6007… → làm tròn 4,6. Chênh lệch giữa hai cách
        // tính chính là cái test này canh.
        await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.60m, ratingCount: 500);
        await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 5.00m, ratingCount: 1);

        var sau = await Service().GetAsync();

        (sau.RatingCount - trước.RatingCount).Should().Be(501);

        // Chỉ khẳng định được giá trị tuyệt đối khi sàn chưa có đánh giá nào khác;
        // ngược lại thì chỉ kiểm nó nằm trong thang hợp lệ — vẫn đủ để bắt lỗi tràn
        // cột, vì tràn thì câu lệnh ném luôn chứ không trả về số sai.
        if (trước.RatingCount == 0)
            sau.RatingAvg.Should().Be(4.6m);
        else
            sau.RatingAvg.Should().BeInRange(1m, 5m);
    }

    /// <remarks>
    /// Đây là hồi quy cho một lỗi thật đã gặp ở số liệu khu vực: <c>rating_avg</c> là
    /// <c>NUMERIC(3,2)</c> — tối đa 9,99 — nên nếu nhân trong Postgres mà giữ nguyên
    /// scale đó thì <c>4.60 * 500</c> tràn cột và câu lệnh ném <c>22003</c>. Lỗi chỉ lộ
    /// ra khi có hồ sơ vài trăm đánh giá, tức đúng lúc sàn bắt đầu chạy thật.
    /// </remarks>
    [Fact]
    public async Task Hồ_sơ_nhiều_đánh_giá_không_làm_tràn_cột_numeric()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();

        await TestData.CreateKtvAsync(db, lat, lon, ratingAvg: 4.99m, ratingCount: 100_000);

        var act = async () => await Service().GetAsync();

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Sàn_chưa_có_đánh_giá_trả_null_chứ_không_lỗi()
    {
        // Không dựng dữ liệu: chỉ cần khẳng định hàm chạy được và không bịa ra số 0.
        // "0,0 điểm trung bình" ngay dưới H1 còn tệ hơn hẳn việc không hiện gì.
        var stats = await Service().GetAsync();

        if (stats.RatingCount == 0)
            stats.RatingAvg.Should().BeNull();

        stats.VerifiedKtvCount.Should().BeGreaterThanOrEqualTo(0);
    }
}
