using FluentAssertions;
using Massage.Api.Modules.Analytics;
using Massage.Api.Modules.Analytics.Entities;
using Massage.Api.Modules.Leads.Entities;

namespace Massage.Api.Tests;

/// <summary>
/// Số liệu 7 ngày trên dashboard KTV.
///
/// Đây là con số KTV dùng để quyết định có mua tiếp gói đẩy tin hay không, nên sai
/// số ở đây không phải lỗi hiển thị mà là lỗi dẫn tới quyết định chi tiền sai.
/// </summary>
[Collection(PostgresCollection.Name)]
public class AnalyticsServiceTests(PostgresFixture fixture)
{
    private AnalyticsService Service() => new(fixture.CreateContext());

    [Fact]
    public async Task Cùng_người_xem_tải_lại_trang_chỉ_tính_một_lượt()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var ghi1 = await Service().RecordViewAsync(ktv.Id, "203.0.113.7", "Firefox/130");
        var ghi2 = await Service().RecordViewAsync(ktv.Id, "203.0.113.7", "Firefox/130");

        ghi1.Should().BeTrue();
        ghi2.Should().BeFalse("F5 trong cùng một phiên không phải một lượt xem mới");

        var stats = await Service().GetKtvStatsAsync(ktv.Id);
        stats.ProfileViews.Should().Be(1);
    }

    [Fact]
    public async Task Người_xem_khác_nhau_được_tính_riêng()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        await Service().RecordViewAsync(ktv.Id, "203.0.113.7", "Firefox/130");
        await Service().RecordViewAsync(ktv.Id, "198.51.100.4", "Firefox/130");
        await Service().RecordViewAsync(ktv.Id, "203.0.113.7", "Chrome/141");

        var stats = await Service().GetKtvStatsAsync(ktv.Id);

        // Khác IP hoặc khác trình duyệt đều là người xem khác.
        stats.ProfileViews.Should().Be(3);
    }

    [Fact]
    public async Task Chỉ_đếm_lượt_xem_của_đúng_KTV_đó()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var mình = await TestData.CreateKtvAsync(db, lat, lon);
        var ngườiKhác = await TestData.CreateKtvAsync(db, lat, lon);

        await Service().RecordViewAsync(mình.Id, "203.0.113.7", "Firefox/130");
        await Service().RecordViewAsync(ngườiKhác.Id, "198.51.100.4", "Firefox/130");
        await Service().RecordViewAsync(ngườiKhác.Id, "198.51.100.5", "Firefox/130");

        (await Service().GetKtvStatsAsync(mình.Id)).ProfileViews.Should().Be(1);
        (await Service().GetKtvStatsAsync(ngườiKhác.Id)).ProfileViews.Should().Be(2);
    }

    [Fact]
    public async Task So_sánh_với_tuần_trước_tính_đúng_phần_trăm()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        // Ghi thẳng vào DB với mốc thời gian trong quá khứ: RecordViewAsync luôn
        // dùng now(), nên không dựng được tuần trước qua nó.
        await SeedViewsAsync(db, ktv.Id, count: 10, daysAgo: 9);  // tuần trước
        await SeedViewsAsync(db, ktv.Id, count: 12, daysAgo: 2);  // tuần này

        var stats = await Service().GetKtvStatsAsync(ktv.Id);

        stats.ProfileViews.Should().Be(12);
        stats.ProfileViewsChangePct.Should().Be(20m);
    }

    /// <remarks>
    /// Tuần đầu tiên của **mọi** KTV đều rơi vào trường hợp này, nên đây là đường đi
    /// phổ biến chứ không phải ngoại lệ hiếm. Chia cho 0 sẽ ném lỗi hoặc trả về
    /// Infinity, và cả hai đều biến ô số liệu thành lỗi ngay trong tuần KTV mới vào.
    /// </remarks>
    [Fact]
    public async Task Tuần_trước_bằng_0_thì_không_bịa_ra_phần_trăm()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        await SeedViewsAsync(db, ktv.Id, count: 5, daysAgo: 1);

        var stats = await Service().GetKtvStatsAsync(ktv.Id);

        stats.ProfileViews.Should().Be(5);
        stats.ProfileViewsChangePct.Should().BeNull();
    }

    [Fact]
    public async Task Lượt_xem_ngoài_cửa_sổ_7_ngày_không_được_tính()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        await SeedViewsAsync(db, ktv.Id, count: 3, daysAgo: 2);
        await SeedViewsAsync(db, ktv.Id, count: 99, daysAgo: 40);

        var stats = await Service().GetKtvStatsAsync(ktv.Id);

        // 40 ngày trước nằm ngoài cả tuần này lẫn tuần trước, nên không được lọt vào
        // đâu cả — kể cả vào mẫu số của phép so sánh.
        stats.ProfileViews.Should().Be(3);
        stats.ProfileViewsChangePct.Should().BeNull();
    }

    [Fact]
    public async Task Tỉ_lệ_bấm_liên_hệ_tính_trên_số_lượt_xem()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        await SeedViewsAsync(db, ktv.Id, count: 40, daysAgo: 3);
        await SeedLeadsAsync(db, ktv.Id, count: 5, daysAgo: 3);

        var stats = await Service().GetKtvStatsAsync(ktv.Id);

        stats.Leads.Should().Be(5);
        stats.LeadRatePct.Should().Be(12.5m);
    }

    [Fact]
    public async Task Chưa_có_lượt_xem_nào_thì_không_chia_cho_0()
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);

        var stats = await Service().GetKtvStatsAsync(ktv.Id);

        stats.ProfileViews.Should().Be(0);
        stats.Leads.Should().Be(0);
        stats.LeadRatePct.Should().BeNull();
        stats.ProfileViewsChangePct.Should().BeNull();
    }

    /// <remarks>
    /// Hàm này chạy trên đường đọc của trang hồ sơ công khai. Ném lỗi ở đây là làm
    /// hỏng trang khách đang xem chỉ vì một dòng thống kê không ghi được — đánh đổi
    /// sai hướng, nên nó cố ý im lặng.
    /// </remarks>
    [Fact]
    public async Task Ghi_lượt_xem_cho_KTV_không_tồn_tại_không_làm_hỏng_trang()
    {
        var act = async () => await Service().RecordViewAsync(Guid.NewGuid(), "203.0.113.7", "Firefox");

        await act.Should().NotThrowAsync();
    }

    private static async Task SeedViewsAsync(
        Massage.Api.Data.AppDbContext db, Guid ktvId, int count, int daysAgo)
    {
        var at = DateTimeOffset.UtcNow.AddDays(-daysAgo);
        for (var i = 0; i < count; i++)
            db.AnalyticsEvents.Add(new AnalyticsEvent
            {
                Type = AnalyticsEventTypes.View,
                KtvId = ktvId,
                ViewerHash = Guid.NewGuid().ToString("N"),
                CreatedAt = at,
            });

        await db.SaveChangesAsync();
    }

    private static async Task SeedLeadsAsync(
        Massage.Api.Data.AppDbContext db, Guid ktvId, int count, int daysAgo)
    {
        var at = DateTimeOffset.UtcNow.AddDays(-daysAgo);
        for (var i = 0; i < count; i++)
            db.Leads.Add(new Lead
            {
                KtvId = ktvId,
                Channel = LeadChannels.Call,
                DeviceHash = Guid.NewGuid().ToString("N"),
                CreatedAt = at,
            });

        await db.SaveChangesAsync();
    }
}
