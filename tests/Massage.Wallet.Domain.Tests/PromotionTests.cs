using FluentAssertions;
using Massage.Promotion.Domain;

namespace Massage.Wallet.Domain.Tests;

public class PackageTypeTests
{
    [Theory]
    [InlineData(PackageTypes.VipPin, 500)]
    [InlineData(PackageTypes.InstantBoost, 300)]
    [InlineData(PackageTypes.FeaturedBadge, 150)]
    public void Điểm_boost_đúng_như_bảng_giá_đang_bán(string type, int expected) =>
        PackageTypes.BoostPointsFor(type).Should().Be(expected);

    [Theory]
    [InlineData(PackageTypes.VipPin)]
    [InlineData(PackageTypes.InstantBoost)]
    [InlineData(PackageTypes.FeaturedBadge)]
    public void Cả_ba_hạng_đều_đảm_bảo_đứng_trên_KTV_miễn_phí(string type) =>
        PackageTypes.GuaranteesTopPlacement(type).Should().BeTrue(
            "điểm boost phải lớn hơn BaseScore tối đa (100) thì cam kết bán hàng mới giữ được");

    [Fact]
    public void Khoảng_cách_giữa_mọi_hạng_liền_kề_lớn_hơn_dải_BaseScore()
    {
        // Bất biến thật sự của mô hình doanh thu, và là thứ dễ phá nhất khi ai đó
        // chỉnh giá một gói: chỉ cần một khoảng cách tụt xuống ≤ 100 là một KTV mua
        // gói đắt hơn có thể đứng dưới người mua gói rẻ hơn.
        //
        // Kiểm cả chuỗi chứ không chỉ hạng vừa đổi — đó chính là chỗ lần trước bị
        // bỏ sót: Badge +50 lọt qua vì không ai kiểm bậc từ hạng thấp nhất xuống 0.
        PackageTypes.TierGapsAreValid().Should().BeTrue();
    }

    [Fact]
    public void Nâng_Badge_lên_200_sẽ_phá_khoảng_cách_với_Instant()
    {
        // Ghi lại vì sao chọn 150 chứ không phải một số tròn hơn: với 200 thì
        // khoảng cách Badge→Instant còn đúng 100, tức bằng chứ không lớn hơn dải
        // BaseScore, và một Badge điểm nền tối đa sẽ hoà với một Instant điểm nền 0.
        const int badgeAt200 = 200;
        var instant = PackageTypes.BoostPointsFor(PackageTypes.InstantBoost);

        // Khoảng cách phải LỚN HƠN 100, không phải bằng.
        (instant - badgeAt200).Should().Be(PackageTypes.MaxBaseScore);

        // Còn 150 thì thoả: dư ra đúng nửa dải BaseScore ở cả hai bậc.
        var badge = PackageTypes.BoostPointsFor(PackageTypes.FeaturedBadge);
        (instant - badge).Should().BeGreaterThan(PackageTypes.MaxBaseScore);
        badge.Should().BeGreaterThan(PackageTypes.MaxBaseScore);
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

/// <summary>
/// Instant Boost bán theo khung giờ. Đây là những quy tắc mà một lỗi im lặng biến
/// thành bán sai thứ đã thu tiền — chúng chạy không cần DB nên không có lý do gì
/// để không canh.
/// </summary>
public class HourlySlotTests
{
    private static PromotionPackage InstantBoost(int hours = 3, decimal price = 150_000) =>
        new(Guid.NewGuid(), "instant-boost-1d", "Instant Boost", PackageTypes.InstantBoost,
            price, DurationDays: 1, MaxSlotsPerArea: 5, IsActive: true, DurationHours: hours);

    [Fact]
    public void Instant_Boost_dùng_khung_giờ_còn_hai_gói_kia_dùng_khung_ngày()
    {
        SlotGranularities.For(PackageTypes.InstantBoost).Should().Be(SlotGranularity.Hour);
        SlotGranularities.For(PackageTypes.VipPin).Should().Be(SlotGranularity.Day);
        SlotGranularities.For(PackageTypes.FeaturedBadge).Should().Be(SlotGranularity.Day);
    }

    [Fact]
    public void Mua_giữa_giờ_thì_tính_từ_giờ_kế_tiếp()
    {
        // 20h05 → khung đầu tiên là 21h. Giờ đang chạy đã trôi mất một phần, bán
        // trọn giá cho phần còn lại là bán thiếu thứ đã hứa.
        var windows = InstantBoost(hours: 3)
            .WindowsFrom(new DateTimeOffset(2026, 9, 1, 20, 5, 0, TimeSpan.Zero));

        windows.Should().HaveCount(3);
        windows[0].Should().Be(new DateTimeOffset(2026, 9, 1, 21, 0, 0, TimeSpan.Zero));
        windows[2].Should().Be(new DateTimeOffset(2026, 9, 1, 23, 0, 0, TimeSpan.Zero));
    }

    [Fact]
    public void Mua_đúng_đầu_giờ_thì_tính_luôn_giờ_đó()
    {
        var windows = InstantBoost(hours: 2)
            .WindowsFrom(new DateTimeOffset(2026, 9, 1, 20, 0, 0, TimeSpan.Zero));

        windows[0].Should().Be(new DateTimeOffset(2026, 9, 1, 20, 0, 0, TimeSpan.Zero));
    }

    [Fact]
    public void Khung_giờ_bắc_qua_nửa_đêm_vẫn_liên_tục()
    {
        // 23h05 mua 3 giờ → 0h, 1h, 2h ngày hôm sau. Nếu ai đó "sửa" cho khung giờ
        // bị kẹp trong một ngày thì gói khung giờ vàng buổi tối sẽ hụt mất phần
        // đắt giá nhất của nó.
        var windows = InstantBoost(hours: 3)
            .WindowsFrom(new DateTimeOffset(2026, 9, 1, 23, 5, 0, TimeSpan.Zero));

        windows[0].Should().Be(new DateTimeOffset(2026, 9, 2, 0, 0, 0, TimeSpan.Zero));
        windows[2].Should().Be(new DateTimeOffset(2026, 9, 2, 2, 0, 0, TimeSpan.Zero));
    }

    [Fact]
    public void Campaign_theo_giờ_chạy_đúng_bằng_các_khung_nó_chiếm()
    {
        var now = new DateTimeOffset(2026, 9, 1, 20, 5, 0, TimeSpan.Zero);
        var package = InstantBoost(hours: 3);

        var campaign = Campaign.Start(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), package, now);

        var windows = package.WindowsFrom(now);

        // StartAt phải trùng khung đầu, EndAt phải là hết khung cuối — lệch một đầu
        // nào cũng nghĩa là campaign được coi là đang chạy trong lúc không giữ slot.
        campaign.StartAt.Should().Be(windows[0]);
        campaign.EndAt.Should().Be(windows[^1].AddHours(1));

        campaign.IsRunning(now).Should().BeFalse("chưa tới khung đầu tiên");
        campaign.IsRunning(windows[0]).Should().BeTrue();
        campaign.IsRunning(campaign.EndAt).Should().BeFalse("hết khung cuối là hết hạn");
    }

    [Fact]
    public void Huỷ_gói_theo_giờ_hoàn_theo_số_giờ_trọn_vẹn_còn_lại()
    {
        // Đây là hồi quy cho một lỗi im lặng thật: khi hoàn tiền tính theo "số ngày
        // trọn vẹn còn lại", một campaign 3 giờ luôn ra 0 ngày, nên KTV huỷ ngay sau
        // khi mua vẫn không được hoàn đồng nào — hàm vẫn chạy, vẫn trả về số.
        var now = new DateTimeOffset(2026, 9, 1, 20, 0, 0, TimeSpan.Zero);
        var campaign = Campaign.Start(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            InstantBoost(hours: 3, price: 150_000), now);

        // Huỷ sau 1 giờ: còn đúng 2 trên 3 khung.
        var refund = campaign.Cancel(now.AddHours(1));

        refund.Should().Be(100_000);
    }

    [Fact]
    public void Gói_theo_giờ_thiếu_khai_báo_số_giờ_thì_ném_chứ_không_lặng_lẽ_lấy_số_ngày()
    {
        // Nếu chỗ này âm thầm rơi về DurationDays, một gói khai 1 sẽ bán 1 giờ với
        // giá của 1 ngày — hoặc ngược lại, tuỳ hướng đọc nhầm.
        var broken = new PromotionPackage(
            Guid.NewGuid(), "broken", "Hỏng", PackageTypes.InstantBoost,
            150_000m, DurationDays: 1, MaxSlotsPerArea: 5, IsActive: true, DurationHours: null);

        FluentActions.Invoking(() => broken.Duration)
            .Should().Throw<PromotionArgumentException>();
    }

    [Fact]
    public void Gói_theo_ngày_không_đổi_hành_vi()
    {
        // Hồi quy: thêm khung giờ không được làm xê dịch gói bán theo ngày.
        var vip = new PromotionPackage(
            Guid.NewGuid(), "vip-7d", "VIP", PackageTypes.VipPin,
            1_000_000m, DurationDays: 7, MaxSlotsPerArea: 3, IsActive: true);

        var now = new DateTimeOffset(2026, 9, 1, 18, 30, 0, TimeSpan.FromHours(7));

        vip.Duration.Should().Be(7);
        vip.WindowsFrom(now).Should().HaveCount(7);
        vip.WindowsFrom(now)[0].Should().Be(SlotWindow.DayBucket(now));
        vip.EndAtFrom(now).Should().Be(SlotWindow.EndOfDays(now, 7));
    }
}
