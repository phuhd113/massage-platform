using FluentAssertions;
using Massage.Promotion.Domain;

namespace Massage.Wallet.Domain.Tests;

public class PackageTypeTests
{
    [Theory]
    [InlineData(PackageTypes.VipPin, 500)]
    [InlineData(PackageTypes.InstantBoost, 300)]
    [InlineData(PackageTypes.FeaturedBadge, 50)]
    public void Điểm_boost_đúng_như_tài_liệu_dự_án(string type, int expected) =>
        PackageTypes.BoostPointsFor(type).Should().Be(expected);

    [Theory]
    [InlineData(PackageTypes.VipPin)]
    [InlineData(PackageTypes.InstantBoost)]
    public void VIP_và_Instant_đảm_bảo_đứng_trên_mọi_KTV_miễn_phí(string type) =>
        PackageTypes.GuaranteesTopPlacement(type).Should().BeTrue(
            "điểm boost phải lớn hơn BaseScore tối đa (100) thì cam kết bán hàng mới giữ được");

    [Fact]
    public void Featured_Badge_KHÔNG_đảm_bảo_thứ_hạng_và_đó_là_điều_phải_nói_rõ()
    {
        // Đây không phải lỗi cài đặt mà là mâu thuẫn có sẵn giữa hai câu trong tài
        // liệu: cùng chỗ ghi "khoảng cách giữa các mức boost lớn hơn dải BaseScore"
        // lại đặt Badge ở +50, nhỏ hơn dải BaseScore (0–100).
        //
        // Test này khoá hành vi thật lại để nó không bị hiểu nhầm thành đảm bảo, và
        // để nếu ai đó đổi số thì phải đổi cả test — tức phải quyết định có ý thức.
        PackageTypes.BoostPointsFor(PackageTypes.FeaturedBadge)
            .Should().BeLessThan(PackageTypes.MaxBaseScore);

        PackageTypes.GuaranteesTopPlacement(PackageTypes.FeaturedBadge).Should().BeFalse();
    }

    [Fact]
    public void Loại_gói_lạ_bị_từ_chối() =>
        FluentActions.Invoking(() => PackageTypes.BoostPointsFor("SUPER_VIP"))
            .Should().Throw<UnknownPackageTypeException>();
}

public class SlotWindowTests
{
    [Fact]
    public void Khung_ngày_cắt_theo_giờ_Việt_Nam_chứ_không_theo_UTC()
    {
        // 22h ngày 1/9 giờ Việt Nam = 15h UTC cùng ngày.
        var muaLucToi = new DateTimeOffset(2026, 9, 1, 22, 0, 0, TimeSpan.FromHours(7));

        var bucket = SlotWindow.DayBucket(muaLucToi);

        // Cắt theo UTC sẽ ra ngày 1/9 nhưng bắt đầu lúc 7h sáng — KTV mua buổi tối
        // sẽ thấy gói hết hạn giữa buổi sáng làm việc.
        bucket.Should().Be(new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.FromHours(7)));
    }

    [Fact]
    public void Mua_lúc_nào_trong_ngày_cũng_được_tính_trọn_ngày_đó()
    {
        var muaLucToi = new DateTimeOffset(2026, 9, 1, 22, 0, 0, TimeSpan.FromHours(7));

        var windows = SlotWindow.DayWindows(muaLucToi, 7);

        windows.Should().HaveCount(7);
        windows[0].Should().Be(new DateTimeOffset(2026, 9, 1, 0, 0, 0, TimeSpan.FromHours(7)));
        windows[6].Should().Be(new DateTimeOffset(2026, 9, 7, 0, 0, 0, TimeSpan.FromHours(7)));
    }

    [Fact]
    public void Gói_bảy_ngày_chiếm_đúng_bảy_suất_tồn_kho()
    {
        // Nếu kéo dài tới đúng giờ mua của ngày thứ 8, campaign sẽ đè lên 8 khung
        // mà chỉ trả tiền cho 7 — hụt một suất tồn kho không ai bù.
        var windows = SlotWindow.DayWindows(DateTimeOffset.UtcNow, 7);
        windows.Should().HaveCount(7);
        windows.Should().OnlyHaveUniqueItems();
    }
}

public class CampaignTests
{
    private static readonly DateTimeOffset Start = new(2026, 9, 1, 0, 0, 0, TimeSpan.FromHours(7));

    private static PromotionPackage Package(int days = 10, decimal price = 1_000_000) =>
        new(Guid.NewGuid(), "vip", "VIP", PackageTypes.VipPin, price, days, 3, true);

    private static Campaign Running(int days = 10, decimal price = 1_000_000) =>
        Campaign.Start(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Package(days, price), Start);

    [Fact]
    public void Huỷ_giữa_chừng_hoàn_theo_số_ngày_trọn_vẹn_còn_lại()
    {
        var campaign = Running(days: 10, price: 1_000_000);

        // Huỷ sau 3 ngày: còn 7 ngày trọn vẹn trên tổng 10.
        var refund = campaign.Cancel(Start.AddDays(3));

        refund.Should().Be(700_000);
        campaign.Status.Should().Be(CampaignStatuses.Cancelled);
        campaign.RefundedAmount.Should().Be(700_000);
    }

    [Fact]
    public void Ngày_đang_dùng_dở_không_được_hoàn()
    {
        var campaign = Running(days: 10, price: 1_000_000);

        // Huỷ sau 3 ngày rưỡi: còn 6.5 ngày, chỉ hoàn 6 ngày trọn vẹn. KTV đã nhận
        // hiển thị của nửa ngày đang dùng.
        var refund = campaign.Cancel(Start.AddDays(3).AddHours(12));

        refund.Should().Be(600_000);
    }

    [Fact]
    public void Huỷ_sau_khi_hết_hạn_không_hoàn_đồng_nào()
    {
        var campaign = Running(days: 10);

        campaign.Cancel(Start.AddDays(20)).Should().Be(0);
    }

    [Fact]
    public void Không_bao_giờ_hoàn_nhiều_hơn_số_đã_thu()
    {
        // Làm tròn xuống ở mọi trường hợp: giá lẻ chia cho số ngày lẻ vẫn không được
        // tạo ra tiền từ phép chia.
        var campaign = Running(days: 7, price: 999_999);

        var refund = campaign.Cancel(Start.AddHours(1));

        refund.Should().BeLessThanOrEqualTo(999_999);
        refund.Should().Be(decimal.Truncate(refund), "VND không có phần lẻ");
    }

    [Fact]
    public void Huỷ_hai_lần_bị_chặn()
    {
        var campaign = Running();
        campaign.Cancel(Start.AddDays(1));

        FluentActions.Invoking(() => campaign.Cancel(Start.AddDays(2)))
            .Should().Throw<InvalidCampaignTransitionException>();
    }

    [Fact]
    public void Không_đóng_được_campaign_chưa_tới_hạn()
    {
        var campaign = Running(days: 10);

        FluentActions.Invoking(() => campaign.Expire(Start.AddDays(3)))
            .Should().Throw<InvalidCampaignTransitionException>();
    }

    [Fact]
    public void Campaign_chỉ_được_coi_là_đang_chạy_trong_đúng_khoảng_thời_gian_của_nó()
    {
        var campaign = Running(days: 10);

        campaign.IsRunning(Start.AddDays(-1)).Should().BeFalse();
        campaign.IsRunning(Start.AddDays(5)).Should().BeTrue();
        campaign.IsRunning(Start.AddDays(11)).Should().BeFalse();
    }
}
