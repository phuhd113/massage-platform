using Massage.Api.Data;
using Massage.Api.Modules.Promotions.Entities;
using Massage.Api.Modules.Promotions.Infrastructure;
using Massage.Api.Modules.Promotions.UseCases;
using Massage.Api.Modules.Wallets;
using Massage.Api.Modules.Wallets.Infrastructure;
using Massage.Api.Modules.Wallets.UseCases;
using Massage.Promotion.Domain;
using Massage.Promotion.Domain.Ports;
using Massage.Wallet.Domain.Ports;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Massage.Api.Tests;

/// <summary>
/// Khoá slot không làm gì — mô phỏng đúng tình huống Redis chết hoặc chưa cấu hình.
///
/// Đây là trạng thái mặc định của test có chủ ý: luồng mua gói phải <b>đúng</b> khi
/// không có khoá nào cả, và mọi test tranh slot hiện có đang chứng minh chính điều
/// đó — trọng tài thật là ràng buộc UNIQUE ở DB.
/// </summary>
public sealed class NoSlotLock : ISlotLock
{
    public static readonly NoSlotLock Instance = new();

    public Task<ISlotLockHandle?> TryAcquireAsync(
        Guid areaId, string packageType, DateTimeOffset window, TimeSpan ttl,
        CancellationToken ct = default) => Task.FromResult<ISlotLockHandle?>(null);
}

/// <summary>Đồng hồ điều khiển được, để test hạn hold không phải chờ thời gian thật.</summary>
public class FakeClock(DateTimeOffset now) : IClock
{
    public DateTimeOffset UtcNow { get; set; } = now;

    public void Advance(TimeSpan by) => UtcNow = UtcNow.Add(by);
}

/// <summary>
/// Dựng use case của vùng chạm tiền quanh <b>một</b> <c>DbContext</c>.
///
/// Mỗi harness = một "request". Test đồng thời phải dựng nhiều harness, mỗi cái
/// một context riêng — đúng như thực tế mỗi HTTP request có DbContext riêng. Dùng
/// chung một context sẽ dùng chung một connection và mọi thứ hoá tuần tự, khiến
/// test race condition không test gì cả.
/// </summary>
public sealed class WalletHarness(AppDbContext db, IClock clock) : IAsyncDisposable
{
    public AppDbContext Db { get; } = db;
    public IClock Clock { get; } = clock;

    public WalletRepository Wallets { get; } = new(db);
    public SlotAllocator Slots { get; } = new(db);
    public CampaignRepository Campaigns { get; } = new(db);
    public PromotionCatalog Catalog { get; } = new(db);
    public WalletUnitOfWork Uow { get; } = new(db);

    /// <summary>
    /// Khoá slot dùng trong test. Mặc định là bản không khoá gì:
    /// <b>test tranh slot phải chứng minh ràng buộc DB tự mình chặn được</b>, chứ
    /// không phải chứng minh Redis chặn được. Nếu để khoá thật ở đây thì test vẫn
    /// xanh ngay cả khi ai đó xoá mất ràng buộc UNIQUE — tức là canh nhầm chỗ.
    /// </summary>
    public ISlotLock SlotLock { get; init; } = NoSlotLock.Instance;

    public BuyPromotionUseCase Buy =>
        new(Db, Wallets, Uow, Catalog, Campaigns, Slots, SlotLock, Clock);

    public CancelCampaignUseCase Cancel =>
        new(Db, Wallets, Uow, Campaigns, Slots, Clock);

    public ConfirmTopUpUseCase ConfirmTopUp =>
        new(Db, Wallets, Uow, Clock, NullLogger<ConfirmTopUpUseCase>.Instance);

    public WalletMaintenance Maintenance =>
        new(Db, Wallets, Uow, Campaigns, Slots, Clock, NullLogger<WalletMaintenance>.Instance);

    public ValueTask DisposeAsync() => Db.DisposeAsync();
}

public static class WalletTestData
{
    /// <param name="slotLock">
    /// Bỏ trống để chạy <b>không có khoá</b> — mặc định có chủ ý, xem <see cref="NoSlotLock"/>.
    /// Chỉ truyền khoá thật khi test muốn kiểm chính hành vi của khoá.
    /// </param>
    public static WalletHarness Harness(
        PostgresFixture fixture, IClock? clock = null, ISlotLock? slotLock = null) =>
        new(fixture.CreateContext(), clock ?? new FakeClock(DateTimeOffset.UtcNow))
        {
            SlotLock = slotLock ?? NoSlotLock.Instance,
        };

    /// <summary>
    /// Nạp sẵn tiền cho ví, ghi <b>cả</b> bút toán tương ứng.
    ///
    /// Cố ý không cắm thẳng số dư vào bảng ví: làm vậy sẽ phá bất biến
    /// <c>SUM(sổ cái) = số dư</c> ngay từ lúc dựng dữ liệu, và test đối soát sẽ báo
    /// lệch vì lỗi của chính test chứ không phải của code.
    /// </summary>
    public static async Task SeedWalletAsync(AppDbContext db, Guid userId, decimal balance)
    {
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"INSERT INTO wallets (user_id) VALUES ({userId}) ON CONFLICT (user_id) DO NOTHING");

        var walletId = await db.Wallets.AsNoTracking()
            .Where(w => w.UserId == userId).Select(w => w.Id).FirstAsync();

        if (balance <= 0) return;

        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO wallet_transactions
                (wallet_id, type, amount, balance_after, idempotency_key)
            VALUES ({walletId}, 'TOPUP', {balance}, {balance}, {$"seed:{Guid.NewGuid()}"})
            """);

        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE wallets SET balance = {balance}, version = version + 1 WHERE id = {walletId}");
    }

    /// <param name="durationHours">
    /// Bắt buộc với gói theo giờ (Instant Boost) và phải để null với gói theo ngày —
    /// ràng buộc <c>chk_package_duration_unit</c> ở DB sẽ từ chối tổ hợp sai. Mặc
    /// định suy từ <paramref name="type"/> để test không phải nhớ quy tắc này.
    /// </param>
    public static async Task<PromotionPackageRow> SeedPackageAsync(
        AppDbContext db,
        string type = PackageTypes.VipPin,
        decimal price = 500_000,
        int durationDays = 7,
        int maxSlots = 3,
        int? durationHours = null)
    {
        var package = new PromotionPackageRow
        {
            Code = $"pkg-{Guid.NewGuid():N}"[..20],
            Name = "Gói test",
            Type = type,
            Price = price,
            DurationDays = durationDays,
            DurationHours = SlotGranularities.For(type) == SlotGranularity.Hour
                ? durationHours ?? 3
                : null,
            MaxSlotsPerArea = maxSlots,
            IsActive = true,
        };

        db.PromotionPackages.Add(package);
        await db.SaveChangesAsync();
        return package;
    }

    /// <summary>
    /// Bất biến phải đúng sau <b>mọi</b> test chạm tiền: tổng có dấu của sổ cái
    /// bằng số dư đang lưu, trên toàn bộ ví.
    /// </summary>
    public static async Task<int> CountDriftingWalletsAsync(PostgresFixture fixture)
    {
        await using var db = fixture.CreateContext();
        var drift = await new WalletRepository(db).FindDriftAsync();
        return drift.Count;
    }
}
