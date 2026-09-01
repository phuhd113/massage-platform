using FluentAssertions;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Promotion.Domain;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class WalletLifecycleTests(PostgresFixture fixture)
{
    private static string Key(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    private async Task<(Guid UserId, Guid KtvId)> VerifiedKtvAsync(decimal balance)
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await WalletTestData.SeedWalletAsync(db, ktv.UserId, balance);
        return (ktv.UserId, ktv.Id);
    }

    [Fact]
    public async Task Huỷ_giữa_chừng_hoàn_tiền_và_trả_slot_về_kho()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(
            setup, maxSlots: 1, price: 700_000, durationDays: 7);

        var first = await VerifiedKtvAsync(1_000_000);
        var second = await VerifiedKtvAsync(1_000_000);

        var start = new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.FromHours(7));
        var clock = new FakeClock(start);

        await using var h = WalletTestData.Harness(fixture, clock);
        var bought = await h.Buy.ExecuteAsync(first.UserId, package.Id, area.Id, Key("buy"));

        // Khu vực chỉ có 1 slot: người thứ hai phải bị từ chối lúc này.
        await using var blocked = WalletTestData.Harness(fixture, clock);
        var trước = async () => await blocked.Buy.ExecuteAsync(
            second.UserId, package.Id, area.Id, Key("blocked"));
        await trước.Should().ThrowAsync<SlotExhaustedException>();

        // Campaign chạy từ đầu ngày 1/9 tới đầu ngày 8/9 (giờ VN). Huỷ lúc 9h sáng
        // ngày 4/9 thì còn 3 ngày trọn vẹn trên tổng 7 — ngày 4 đang dùng dở không
        // được hoàn vì KTV đã nhận hiển thị của ngày đó.
        clock.Advance(TimeSpan.FromDays(3));
        await using var hc = WalletTestData.Harness(fixture, clock);
        var cancelled = await hc.Cancel.ExecuteAsync(first.UserId, bought.CampaignId);

        cancelled.RefundedAmount.Should().Be(300_000);
        cancelled.BalanceAfter.Should().Be(600_000, "700.000 đã trừ khi mua, 300.000 quay lại ví");

        await using var check = fixture.CreateContext();
        (await check.SlotAllocations.CountAsync(s => s.CampaignId == bought.CampaignId))
            .Should().Be(0, "giữ chỗ của campaign đã huỷ là tự chặn doanh thu của mình");

        // Và người thứ hai mua được ngay sau đó.
        await using var hs = WalletTestData.Harness(fixture, clock);
        var sau = await hs.Buy.ExecuteAsync(second.UserId, package.Id, area.Id, Key("after"));
        sau.CampaignId.Should().NotBeEmpty();

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Huỷ_hai_lần_không_hoàn_tiền_lần_thứ_hai()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(setup, price: 700_000, durationDays: 7);
        var ktv = await VerifiedKtvAsync(1_000_000);

        var clock = new FakeClock(new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.FromHours(7)));
        await using var h = WalletTestData.Harness(fixture, clock);
        var bought = await h.Buy.ExecuteAsync(ktv.UserId, package.Id, area.Id, Key("buy"));

        clock.Advance(TimeSpan.FromDays(1));
        await using var h1 = WalletTestData.Harness(fixture, clock);
        await h1.Cancel.ExecuteAsync(ktv.UserId, bought.CampaignId);

        await using var h2 = WalletTestData.Harness(fixture, clock);
        var lầnHai = async () => await h2.Cancel.ExecuteAsync(ktv.UserId, bought.CampaignId);
        await lầnHai.Should().ThrowAsync<InvalidCampaignTransitionException>();

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Không_huỷ_được_campaign_của_người_khác()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(setup, price: 300_000);
        var owner = await VerifiedKtvAsync(1_000_000);
        var stranger = await VerifiedKtvAsync(1_000_000);

        await using var h = WalletTestData.Harness(fixture);
        var bought = await h.Buy.ExecuteAsync(owner.UserId, package.Id, area.Id, Key("buy"));

        await using var h2 = WalletTestData.Harness(fixture);
        var thử = async () => await h2.Cancel.ExecuteAsync(stranger.UserId, bought.CampaignId);

        await thử.Should().ThrowAsync<Massage.Api.Common.NotFoundException>();
    }

    [Fact]
    public async Task Tác_vụ_bảo_trì_nhả_hold_quá_hạn_và_trả_tiền_về_khả_dụng()
    {
        await using var setup = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(setup, lat, lon);
        await WalletTestData.SeedWalletAsync(setup, ktv.UserId, 1_000_000);

        var clock = new FakeClock(DateTimeOffset.UtcNow);

        // Mô phỏng process chết giữa luồng mua: hold đã ghi, chưa ai chốt hay nhả.
        await using (var h = WalletTestData.Harness(fixture, clock))
        await using (var tx = await h.Uow.BeginAsync())
        {
            var wallet = await h.Wallets.GetForUpdateAsync(ktv.UserId);
            var hold = wallet.Hold(Guid.NewGuid(), Massage.Wallet.Domain.Money.Of(300_000),
                clock.UtcNow, TimeSpan.FromMinutes(5));
            await h.Wallets.AddHoldAsync(hold);
            await h.Wallets.PersistAmountsAsync(wallet);
            await tx.CommitAsync();
        }

        await using (var check = fixture.CreateContext())
        {
            var w = await check.Wallets.AsNoTracking().FirstAsync(x => x.UserId == ktv.UserId);
            w.Held.Should().Be(300_000, "tiền đang bị treo");
        }

        clock.Advance(TimeSpan.FromMinutes(6));
        await using var maint = WalletTestData.Harness(fixture, clock);
        var released = await maint.Maintenance.ReleaseExpiredHoldsAsync();

        released.Should().Be(1);

        await using var after = fixture.CreateContext();
        var wallet2 = await after.Wallets.AsNoTracking().FirstAsync(x => x.UserId == ktv.UserId);
        wallet2.Held.Should().Be(0, "tiền của KTV không được treo vĩnh viễn");
        wallet2.Balance.Should().Be(1_000_000, "nhả hold không đụng tới số dư");

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Campaign_hết_hạn_được_đóng_và_trả_slot()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(
            setup, maxSlots: 1, price: 300_000, durationDays: 3);
        var ktv = await VerifiedKtvAsync(1_000_000);

        var clock = new FakeClock(new DateTimeOffset(2026, 9, 1, 9, 0, 0, TimeSpan.FromHours(7)));
        await using var h = WalletTestData.Harness(fixture, clock);
        var bought = await h.Buy.ExecuteAsync(ktv.UserId, package.Id, area.Id, Key("buy"));

        clock.Advance(TimeSpan.FromDays(4));
        await using var maint = WalletTestData.Harness(fixture, clock);
        var expired = await maint.Maintenance.ExpireCampaignsAsync();

        expired.Should().Be(1);

        await using var check = fixture.CreateContext();
        var campaign = await check.Campaigns.AsNoTracking().FirstAsync(c => c.Id == bought.CampaignId);
        campaign.Status.Should().Be(CampaignStatuses.Expired);
        (await check.SlotAllocations.CountAsync(s => s.CampaignId == bought.CampaignId)).Should().Be(0);
    }

    [Fact]
    public async Task Đối_soát_phát_hiện_ví_bị_sửa_số_dư_ngoài_sổ_cái()
    {
        await using var setup = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(setup, lat, lon);
        await WalletTestData.SeedWalletAsync(setup, ktv.UserId, 500_000);

        await using var clean = WalletTestData.Harness(fixture);
        (await clean.Maintenance.ReconcileAsync()).Should().Be(0);

        // Sửa thẳng số dư không qua sổ — đúng kiểu lỗi mà đối soát sinh ra để bắt.
        await setup.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE wallets SET balance = balance + 1 WHERE user_id = {ktv.UserId}");

        await using var dirty = WalletTestData.Harness(fixture);
        (await dirty.Maintenance.ReconcileAsync()).Should().BeGreaterThan(0,
            "lệch một đồng cũng phải hiện ra, không được làm tròn cho qua");

        // Trả lại nguyên trạng để không làm hỏng các test khác dùng chung database.
        await setup.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE wallets SET balance = balance - 1 WHERE user_id = {ktv.UserId}");
    }
}
