using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Wallets.Infrastructure;
using Massage.Promotion.Domain;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Tests;

/// <summary>
/// Test đồng thời cho vùng chạm tiền.
///
/// Race condition không xuất hiện trong test tuần tự, và đọc code bằng mắt không
/// thay thế được — mỗi test ở đây dựng nhiều <c>DbContext</c> riêng để mô phỏng
/// đúng nhiều HTTP request song song.
/// </summary>
[Collection(PostgresCollection.Name)]
public class WalletConcurrencyTests(PostgresFixture fixture)
{
    private sealed record Attempted(Guid UserId, bool Won, int SlotIndex, Exception? Error);

    /// <summary>
    /// Chạy một lần mua và <b>bắt</b> lỗi thay vì để nó làm hỏng Task.WhenAll — test
    /// cần xem cả người thắng lẫn người thua, không phải chỉ ngoại lệ đầu tiên.
    /// </summary>
    private static async Task<Attempted> Attempt(
        WalletHarness h, Guid userId, Guid packageId, Guid areaId, string key)
    {
        try
        {
            var r = await h.Buy.ExecuteAsync(userId, packageId, areaId, key);
            return new Attempted(userId, true, r.SlotIndex, null);
        }
        catch (Exception ex)
        {
            return new Attempted(userId, false, -1, ex);
        }
    }

    // Khoá chống lặp phải duy nhất theo từng lần chạy: fixture dùng chung một
    // database cho cả collection, nên khoá cố định sẽ đụng bản ghi của test trước
    // và test sau nhận nhầm kết quả cũ.
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
    public async Task Hai_KTV_tranh_slot_cuối_cùng_thì_đúng_một_người_thắng()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        // maxSlots = 1: khu vực này chỉ còn đúng một chỗ.
        var package = await WalletTestData.SeedPackageAsync(setup, maxSlots: 1, price: 500_000);

        var a = await VerifiedKtvAsync(1_000_000);
        var b = await VerifiedKtvAsync(1_000_000);

        await using var ha = WalletTestData.Harness(fixture);
        await using var hb = WalletTestData.Harness(fixture);

        var results = await Task.WhenAll(
            Attempt(ha, a.UserId, package.Id, area.Id, Key("key-a")),
            Attempt(hb, b.UserId, package.Id, area.Id, Key("key-b")));

        results.Count(r => r.Won).Should().Be(1, "một slot chỉ bán được cho một người");
        results.Count(r => r.Error is SlotExhaustedException).Should().Be(1);

        await using var check = fixture.CreateContext();

        // Người thua phải được hoàn nguyên: không giữ đồng nào, số dư không đổi.
        var loserUserId = results.Single(r => !r.Won).UserId;
        var loserWallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == loserUserId);
        loserWallet.Held.Should().Be(0, "thua tranh slot thì tiền phải được nhả hết");
        loserWallet.Balance.Should().Be(1_000_000, "chưa bao giờ được trừ tiền vì slot chưa xác nhận");

        // Và không để lại hold treo nào.
        var danglingHolds = await check.WalletHolds
            .CountAsync(h => h.WalletId == loserWallet.Id && h.Status == "ACTIVE");
        danglingHolds.Should().Be(0);

        // Người thắng bị trừ đúng một lần.
        var winnerUserId = results.Single(r => r.Won).UserId;
        var winnerWallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == winnerUserId);
        winnerWallet.Balance.Should().Be(500_000);
        winnerWallet.Held.Should().Be(0);

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Còn_chỗ_thì_không_ai_bị_báo_hết_slot_oan()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(setup, maxSlots: 2, price: 500_000);

        var a = await VerifiedKtvAsync(1_000_000);
        var b = await VerifiedKtvAsync(1_000_000);

        await using var ha = WalletTestData.Harness(fixture);
        await using var hb = WalletTestData.Harness(fixture);

        var results = await Task.WhenAll(
            Attempt(ha, a.UserId, package.Id, area.Id, Key("key-a")),
            Attempt(hb, b.UserId, package.Id, area.Id, Key("key-b")));

        // Cả hai cùng nhắm chỉ số 0 vì không thấy dòng chưa commit của nhau. Người
        // thứ hai bị chặn ở khoá unique, rồi thử chỉ số 1 — nếu không có vòng thử
        // lại thì đây là chỗ khách bị từ chối trong khi hàng vẫn còn.
        results.Should().OnlyContain(r => r.Won);
        results.Select(r => r.SlotIndex).Should().BeEquivalentTo(new[] { 0, 1 });

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Cùng_một_Idempotency_Key_chỉ_trừ_tiền_một_lần()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(setup, maxSlots: 5, price: 300_000);
        var ktv = await VerifiedKtvAsync(1_000_000);

        await using var h1 = WalletTestData.Harness(fixture);
        await using var h2 = WalletTestData.Harness(fixture);
        var sameKey = Key("same");

        var first = await h1.Buy.ExecuteAsync(ktv.UserId, package.Id, area.Id, sameKey);
        var second = await h2.Buy.ExecuteAsync(ktv.UserId, package.Id, area.Id, sameKey);

        second.AlreadyProcessed.Should().BeTrue();
        second.CampaignId.Should().Be(first.CampaignId, "cùng một ý định thì phải ra cùng một campaign");

        await using var check = fixture.CreateContext();
        var wallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == ktv.UserId);
        wallet.Balance.Should().Be(700_000, "double-click không được trừ tiền hai lần");

        var campaignCount = await check.Campaigns.CountAsync(c => c.KtvId == ktv.KtvId);
        campaignCount.Should().Be(1);

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Số_dư_không_đủ_thì_không_tạo_campaign_và_không_để_lại_hold_treo()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(setup, price: 500_000);
        var ktv = await VerifiedKtvAsync(100_000);

        await using var h = WalletTestData.Harness(fixture);

        var thử = async () => await h.Buy.ExecuteAsync(ktv.UserId, package.Id, area.Id, Key("key-poor"));
        await thử.Should().ThrowAsync<Massage.Wallet.Domain.InsufficientBalanceException>();

        await using var check = fixture.CreateContext();
        (await check.Campaigns.CountAsync(c => c.KtvId == ktv.KtvId)).Should().Be(0);

        var wallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == ktv.UserId);
        wallet.Balance.Should().Be(100_000);
        wallet.Held.Should().Be(0);

        (await check.WalletHolds.CountAsync(x => x.WalletId == wallet.Id)).Should().Be(0);
    }

    [Fact]
    public async Task Webhook_nạp_tiền_bắn_hai_lần_chỉ_cộng_tiền_một_lần()
    {
        await using var setup = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(setup, lat, lon);
        await WalletTestData.SeedWalletAsync(setup, ktv.UserId, 0);

        var intent = new Massage.Api.Modules.Wallets.Entities.PaymentIntentRow
        {
            UserId = ktv.UserId,
            Amount = 500_000,
            Provider = "VNPAY",
            ProviderRef = $"ref-{Guid.NewGuid():N}"[..20],
            Status = Massage.Api.Modules.Wallets.Entities.PaymentIntentStatuses.Pending,
        };
        setup.PaymentIntents.Add(intent);
        await setup.SaveChangesAsync();

        // Cùng một payload, đúng như cổng thanh toán retry khi không nhận được 200.
        var callback = new PaymentCallback(intent.ProviderRef, "vnp-txn-123", 500_000, Succeeded: true);

        await using var h1 = WalletTestData.Harness(fixture);
        await using var h2 = WalletTestData.Harness(fixture);

        var first = await h1.ConfirmTopUp.ExecuteAsync("VNPAY", callback, "raw");
        var second = await h2.ConfirmTopUp.ExecuteAsync("VNPAY", callback, "raw");

        first.Credited.Should().BeTrue();
        second.Credited.Should().BeFalse("lần thứ hai là trùng, không phải lỗi");

        await using var check = fixture.CreateContext();
        var wallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == ktv.UserId);
        wallet.Balance.Should().Be(500_000);

        var topups = await check.WalletTransactions.CountAsync(
            t => t.WalletId == wallet.Id && t.Type == "TOPUP" && t.IdempotencyKey == "VNPAY:vnp-txn-123");
        topups.Should().Be(1);

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Số_tiền_cổng_báo_khác_phiên_đã_mở_thì_không_cộng_gì()
    {
        await using var setup = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(setup, lat, lon);
        await WalletTestData.SeedWalletAsync(setup, ktv.UserId, 0);

        var intent = new Massage.Api.Modules.Wallets.Entities.PaymentIntentRow
        {
            UserId = ktv.UserId,
            Amount = 500_000,
            Provider = "VNPAY",
            ProviderRef = $"ref-{Guid.NewGuid():N}"[..20],
            Status = Massage.Api.Modules.Wallets.Entities.PaymentIntentStatuses.Pending,
        };
        setup.PaymentIntents.Add(intent);
        await setup.SaveChangesAsync();

        await using var h = WalletTestData.Harness(fixture);
        var result = await h.ConfirmTopUp.ExecuteAsync(
            "VNPAY",
            new PaymentCallback(intent.ProviderRef, "vnp-txn-999", 50_000_000, Succeeded: true),
            "raw");

        result.Credited.Should().BeFalse();

        await using var check = fixture.CreateContext();
        var wallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == ktv.UserId);
        wallet.Balance.Should().Be(0);
    }

    /// <summary>
    /// Phiên mở rồi không ai trả tiền phải được đánh dấu bỏ dở, nếu không KTV nhìn
    /// thấy một dòng "đang chờ thanh toán" vĩnh viễn — và nó làm nhiễu đúng câu hỏi
    /// cần trả lời khi có tranh chấp: phiên nào thật sự còn treo?
    /// </summary>
    [Fact]
    public async Task Phiên_nạp_tiền_quá_hạn_mà_cổng_chưa_gọi_về_bị_đánh_dấu_bỏ_dở()
    {
        await using var setup = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(setup, lat, lon);

        var stale = new Massage.Api.Modules.Wallets.Entities.PaymentIntentRow
        {
            UserId = ktv.UserId,
            Amount = 500_000,
            Provider = "VNPAY",
            ProviderRef = $"stale-{Guid.NewGuid():N}"[..20],
            Status = Massage.Api.Modules.Wallets.Entities.PaymentIntentStatuses.Pending,
        };
        setup.PaymentIntents.Add(stale);
        await setup.SaveChangesAsync();

        // created_at do DB đặt mặc định now(), nên đẩy lùi bằng SQL để giả lập phiên cũ.
        await setup.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE payment_intents SET created_at = now() - interval '48 hours' WHERE id = {stale.Id}");

        await using var h = WalletTestData.Harness(fixture);
        (await h.Maintenance.AbandonStaleIntentsAsync()).Should().BeGreaterThan(0);

        await using var check = fixture.CreateContext();
        var after = await check.PaymentIntents.AsNoTracking().FirstAsync(i => i.Id == stale.Id);
        after.Status.Should().Be(
            Massage.Api.Modules.Wallets.Entities.PaymentIntentStatuses.Abandoned);
    }

    /// <summary>
    /// Ràng buộc quan trọng nhất của job dọn: <b>không đụng vào phiên mà cổng đã gọi
    /// về</b>. Có callback nghĩa là cổng đã nói chuyện với ta, và trạng thái phải do
    /// đường IPN quyết định — một job đoán thay sẽ ghi đè lên kết quả thật, đúng vào
    /// những giao dịch đang tranh chấp.
    /// </summary>
    [Fact]
    public async Task Job_dọn_không_đụng_tới_phiên_cổng_đã_gọi_về()
    {
        await using var setup = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(setup, lat, lon);
        await WalletTestData.SeedWalletAsync(setup, ktv.UserId, 0);

        var intent = new Massage.Api.Modules.Wallets.Entities.PaymentIntentRow
        {
            UserId = ktv.UserId,
            Amount = 500_000,
            Provider = "VNPAY",
            ProviderRef = $"paid-{Guid.NewGuid():N}"[..20],
            Status = Massage.Api.Modules.Wallets.Entities.PaymentIntentStatuses.Pending,
        };
        setup.PaymentIntents.Add(intent);
        await setup.SaveChangesAsync();

        // Cổng đã gọi về và tiền đã vào ví — nhưng hàng vẫn cũ hơn ngưỡng dọn.
        await using var confirm = WalletTestData.Harness(fixture);
        var result = await confirm.ConfirmTopUp.ExecuteAsync(
            "VNPAY",
            new PaymentCallback(intent.ProviderRef, $"txn-{Guid.NewGuid():N}"[..16], 500_000, true),
            "raw");
        result.Credited.Should().BeTrue();

        await setup.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE payment_intents SET created_at = now() - interval '48 hours' WHERE id = {intent.Id}");

        await using var h = WalletTestData.Harness(fixture);
        await h.Maintenance.AbandonStaleIntentsAsync();

        await using var check = fixture.CreateContext();
        var after = await check.PaymentIntents.AsNoTracking().FirstAsync(i => i.Id == intent.Id);
        after.Status.Should().Be(
            Massage.Api.Modules.Wallets.Entities.PaymentIntentStatuses.Succeeded,
            "job dọn không được ghi đè kết luận của đường IPN");

        // Và tuyệt đối không chạm vào tiền: dọn phiên không phải là hoàn tiền.
        var wallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == ktv.UserId);
        wallet.Balance.Should().Be(500_000);
        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }
}
