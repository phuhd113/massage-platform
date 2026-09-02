using FluentAssertions;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Promotions.Infrastructure;
using Massage.Promotion.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;

namespace Massage.Api.Tests;

/// <summary>
/// Instant Boost chiếm slot theo <b>khung giờ</b>, khác hai gói còn lại.
///
/// Vùng này chạm tiền và chạm tồn kho, nên nó được canh ở tầng service với Postgres
/// thật: ràng buộc <c>UNIQUE (area_id, package_type, window_start, slot_index)</c>
/// mới là trọng tài chống bán trùng, và không có provider giả nào mô phỏng được nó.
/// </summary>
[Collection(PostgresCollection.Name)]
public class InstantBoostSlotTests(PostgresFixture fixture)
{
    private sealed record Attempted(Guid UserId, bool Won, Exception? Error);

    private static async Task<Attempted> Attempt(
        WalletHarness h, Guid userId, Guid packageId, Guid areaId, string key)
    {
        try
        {
            await h.Buy.ExecuteAsync(userId, packageId, areaId, key);
            return new Attempted(userId, true, null);
        }
        catch (Exception ex)
        {
            return new Attempted(userId, false, ex);
        }
    }

    private static string Key(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    private async Task<Guid> VerifiedKtvAsync(decimal balance)
    {
        await using var db = fixture.CreateContext();
        var (lat, lon) = TestData.RandomOrigin();
        var ktv = await TestData.CreateKtvAsync(db, lat, lon);
        await WalletTestData.SeedWalletAsync(db, ktv.UserId, balance);
        return ktv.UserId;
    }

    [Fact]
    public async Task Mua_Instant_Boost_chiếm_đúng_một_dòng_slot_cho_mỗi_khung_giờ()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(
            setup, type: PackageTypes.InstantBoost, price: 150_000, maxSlots: 5, durationHours: 3);

        var userId = await VerifiedKtvAsync(1_000_000);

        // Mua lúc 20h05 → boost chạy từ 21h, chiếm 21h/22h/23h.
        var now = new DateTimeOffset(2026, 9, 1, 20, 5, 0, TimeSpan.Zero);
        await using var h = WalletTestData.Harness(fixture, new FakeClock(now));

        var result = await h.Buy.ExecuteAsync(userId, package.Id, area.Id, Key("ib"));

        await using var check = fixture.CreateContext();
        var windows = await check.SlotAllocations
            .Where(s => s.CampaignId == result.CampaignId)
            .Select(s => s.WindowStart)
            .OrderBy(w => w)
            .ToListAsync();

        windows.Should().HaveCount(3, "gói 3 giờ chiếm đúng 3 khung");
        windows[0].Should().Be(new DateTimeOffset(2026, 9, 1, 21, 0, 0, TimeSpan.Zero));
        windows[2].Should().Be(new DateTimeOffset(2026, 9, 1, 23, 0, 0, TimeSpan.Zero));

        // Campaign phải chạy đúng bằng các khung nó giữ chỗ — lệch một đầu nghĩa là
        // được đẩy hạng trong lúc không giữ slot nào.
        result.StartAt.Should().Be(windows[0]);
        result.EndAt.Should().Be(windows[2].AddHours(1));

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Hai_KTV_tranh_khung_giờ_cuối_cùng_thì_đúng_một_người_thắng()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        // maxSlots = 1: khung giờ này chỉ còn đúng một chỗ.
        var package = await WalletTestData.SeedPackageAsync(
            setup, type: PackageTypes.InstantBoost, price: 150_000, maxSlots: 1, durationHours: 2);

        var a = await VerifiedKtvAsync(1_000_000);
        var b = await VerifiedKtvAsync(1_000_000);

        // Cùng một mốc thời gian nên cả hai nhắm đúng cùng khung giờ.
        var now = new DateTimeOffset(2026, 9, 1, 19, 30, 0, TimeSpan.Zero);
        await using var ha = WalletTestData.Harness(fixture, new FakeClock(now));
        await using var hb = WalletTestData.Harness(fixture, new FakeClock(now));

        var results = await Task.WhenAll(
            Attempt(ha, a, package.Id, area.Id, Key("ib-a")),
            Attempt(hb, b, package.Id, area.Id, Key("ib-b")));

        results.Count(r => r.Won).Should().Be(1, "một khung giờ chỉ bán được cho một người");
        results.Count(r => r.Error is SlotExhaustedException).Should().Be(1);

        await using var check = fixture.CreateContext();

        // Người thua phải được hoàn nguyên hoàn toàn.
        var loser = results.Single(r => !r.Won).UserId;
        var loserWallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == loser);
        loserWallet.Balance.Should().Be(1_000_000, "chưa bao giờ bị trừ vì slot chưa xác nhận");
        loserWallet.Held.Should().Be(0, "thua tranh slot thì tiền phải được nhả hết");

        var dangling = await check.WalletHolds
            .CountAsync(x => x.WalletId == loserWallet.Id && x.Status == "ACTIVE");
        dangling.Should().Be(0);

        var winner = results.Single(r => r.Won).UserId;
        var winnerWallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == winner);
        winnerWallet.Balance.Should().Be(850_000);
        winnerWallet.Held.Should().Be(0);

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Khung_giờ_không_giao_nhau_thì_cả_hai_cùng_mua_được()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(
            setup, type: PackageTypes.InstantBoost, price: 150_000, maxSlots: 1, durationHours: 1);

        var a = await VerifiedKtvAsync(1_000_000);
        var b = await VerifiedKtvAsync(1_000_000);

        // Cách nhau một giờ nên chiếm hai khung khác nhau: khan hiếm là theo *khung*,
        // không phải theo khu vực. Nếu ai đó vô tình đưa khung về lại độ mịn ngày,
        // test này đỏ vì người thứ hai sẽ bị báo hết slot.
        await using var ha = WalletTestData.Harness(
            fixture, new FakeClock(new DateTimeOffset(2026, 9, 1, 20, 0, 0, TimeSpan.Zero)));
        await using var hb = WalletTestData.Harness(
            fixture, new FakeClock(new DateTimeOffset(2026, 9, 1, 21, 0, 0, TimeSpan.Zero)));

        var first = await Attempt(ha, a, package.Id, area.Id, Key("ib-1"));
        var second = await Attempt(hb, b, package.Id, area.Id, Key("ib-2"));

        first.Won.Should().BeTrue();
        second.Won.Should().BeTrue("khung giờ khác nhau thì không tranh nhau slot");

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Gói_theo_giờ_và_gói_theo_ngày_không_tranh_slot_của_nhau()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);

        // Cùng khu vực, cùng maxSlots = 1, nhưng khác loại gói. `package_type` nằm
        // trong khoá UNIQUE nên hai loại không bao giờ đụng nhau dù ghi chung bảng —
        // đó chính là lý do không cần bảng slot riêng cho khung giờ.
        var hourly = await WalletTestData.SeedPackageAsync(
            setup, type: PackageTypes.InstantBoost, price: 150_000, maxSlots: 1, durationHours: 3);
        var daily = await WalletTestData.SeedPackageAsync(
            setup, type: PackageTypes.VipPin, price: 500_000, maxSlots: 1, durationDays: 1);

        var a = await VerifiedKtvAsync(1_000_000);
        var b = await VerifiedKtvAsync(1_000_000);

        var now = new DateTimeOffset(2026, 9, 1, 20, 0, 0, TimeSpan.Zero);
        await using var ha = WalletTestData.Harness(fixture, new FakeClock(now));
        await using var hb = WalletTestData.Harness(fixture, new FakeClock(now));

        var first = await Attempt(ha, a, hourly.Id, area.Id, Key("mix-h"));
        var second = await Attempt(hb, b, daily.Id, area.Id, Key("mix-d"));

        first.Won.Should().BeTrue();
        second.Won.Should().BeTrue("khác package_type thì khác dòng slot");

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Huỷ_gói_theo_giờ_được_hoàn_theo_số_giờ_còn_lại()
    {
        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(
            setup, type: PackageTypes.InstantBoost, price: 150_000, maxSlots: 5, durationHours: 3);

        var userId = await VerifiedKtvAsync(1_000_000);

        var now = new DateTimeOffset(2026, 9, 1, 20, 0, 0, TimeSpan.Zero);
        var clock = new FakeClock(now);
        await using var h = WalletTestData.Harness(fixture, clock);

        var bought = await h.Buy.ExecuteAsync(userId, package.Id, area.Id, Key("ib-cancel"));

        // Huỷ sau đúng một khung: còn 2 trên 3 giờ. Tính theo ngày thì con số này
        // luôn ra 0 và KTV mất trắng — đó là lỗi im lặng mà test này canh.
        clock.Advance(TimeSpan.FromHours(1));
        await h.Cancel.ExecuteAsync(userId, bought.CampaignId);

        await using var check = fixture.CreateContext();
        var wallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == userId);

        // 1.000.000 − 150.000 + 100.000 hoàn lại.
        wallet.Balance.Should().Be(950_000);
        wallet.Held.Should().Be(0);

        // Huỷ rồi thì slot phải được nhả để người khác mua được.
        var remaining = await check.SlotAllocations
            .CountAsync(s => s.CampaignId == bought.CampaignId);
        remaining.Should().Be(0);

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    [Fact]
    public async Task Có_khoá_Redis_thật_thì_vẫn_đúng_một_người_thắng()
    {
        // Các test tranh slot khác cố ý chạy KHÔNG có khoá, để chứng minh ràng buộc
        // DB tự mình chặn được. Test này đi đường ngược lại: bật khoá thật lên và
        // khẳng định nó không làm hỏng kết quả — thêm fast-path không được đổi ai
        // thắng, cũng không được làm người thua mất tiền.
        var redis = await TryConnectRedisAsync();
        if (redis is null) return; // Redis không chạy — phần này là tối ưu, bỏ qua.
        await using var _ = redis;

        await using var setup = fixture.CreateContext();
        var area = await TestData.CreateAreaAsync(setup, AreaLevels.District);
        var package = await WalletTestData.SeedPackageAsync(
            setup, type: PackageTypes.InstantBoost, price: 150_000, maxSlots: 1, durationHours: 2);

        var a = await VerifiedKtvAsync(1_000_000);
        var b = await VerifiedKtvAsync(1_000_000);

        var now = new DateTimeOffset(2026, 9, 3, 19, 30, 0, TimeSpan.Zero);
        var slotLock = new RedisSlotLock(
            new RedisConnection(redis), NullLogger<RedisSlotLock>.Instance);

        await using var ha = WalletTestData.Harness(fixture, new FakeClock(now), slotLock);
        await using var hb = WalletTestData.Harness(fixture, new FakeClock(now), slotLock);

        var results = await Task.WhenAll(
            Attempt(ha, a, package.Id, area.Id, Key("lock-a")),
            Attempt(hb, b, package.Id, area.Id, Key("lock-b")));

        results.Count(r => r.Won).Should().Be(1, "khoá là fast-path, kết quả vẫn phải đúng như không có nó");

        await using var check = fixture.CreateContext();
        var loser = results.Single(r => !r.Won).UserId;
        var loserWallet = await check.Wallets.AsNoTracking().FirstAsync(w => w.UserId == loser);
        loserWallet.Balance.Should().Be(1_000_000);
        loserWallet.Held.Should().Be(0);

        (await WalletTestData.CountDriftingWalletsAsync(fixture)).Should().Be(0);
    }

    /// <summary>
    /// Kết nối Redis cho test, hoặc null khi môi trường không có Redis.
    ///
    /// Khi <c>TEST_REDIS</c> được đặt tường minh thì không kết nối được là lỗi thật,
    /// không phải lý do bỏ qua — bỏ qua im lặng ở đó che mất chính thứ đang canh.
    /// </summary>
    private static async Task<IConnectionMultiplexer?> TryConnectRedisAsync()
    {
        var configured = Environment.GetEnvironmentVariable("TEST_REDIS");

        try
        {
            var redis = await ConnectionMultiplexer.ConnectAsync(new ConfigurationOptions
            {
                EndPoints = { configured ?? "localhost:6380" },
                AbortOnConnectFail = false,
                ConnectTimeout = 2000,
            });

            if (redis.IsConnected) return redis;
        }
        catch when (string.IsNullOrWhiteSpace(configured))
        {
            return null;
        }

        if (!string.IsNullOrWhiteSpace(configured))
        {
            throw new InvalidOperationException(
                "TEST_REDIS được đặt nhưng không kết nối được — test sẽ bỏ qua im lặng " +
                "và che mất lỗi thật. Kiểm tra Redis trước khi chạy lại.");
        }

        return null;
    }
}
