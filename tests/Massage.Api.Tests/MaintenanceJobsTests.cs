using FluentAssertions;
using Massage.Api.Modules.Analytics;
using Massage.Api.Modules.Jobs;
using Massage.Api.Modules.Wallets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace Massage.Api.Tests;

/// <summary>
/// Tầng job chỉ mỏng một lớp trên <see cref="WalletMaintenance"/>, nên các test ở đây cố
/// ý **không** lặp lại nghiệp vụ ví (đã có ở <c>WalletLifecycleTests</c>). Chúng canh đúng
/// phần mà tầng job tự quyết định: khi nào thì báo hỏng, và chạy lại có an toàn không.
/// </summary>
[Collection(PostgresCollection.Name)]
public class MaintenanceJobsTests(PostgresFixture fixture)
{
    private MaintenanceJobs Jobs(WalletHarness harness) =>
        new(harness.Maintenance,
            new AnalyticsPartitionMaintenance(
                fixture.CreateContext(),
                NullLogger<AnalyticsPartitionMaintenance>.Instance),
            NullLogger<MaintenanceJobs>.Instance);

    [Fact]
    public async Task Đối_soát_ném_lỗi_khi_ví_lệch_sổ_để_job_hiện_đỏ_trên_dashboard()
    {
        await using var db = fixture.CreateContext();
        var harness = WalletTestData.Harness(fixture);
        var userId = (await TestData.CreateUserAsync(db)).Id;
        await WalletTestData.SeedWalletAsync(db, userId, 500_000);

        // Cắm thẳng số dư mà không ghi bút toán — mô phỏng đúng thứ đối soát sinh ra để
        // bắt: một đường ghi số dư nào đó không đi qua sổ cái.
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE wallets SET balance = balance + 250000 WHERE user_id = {userId}");

        try
        {
            var chạy = async () =>
                await Jobs(harness).ReconcileWalletsAsync(CancellationToken.None);

            // Ghi log rồi trả về bình thường là chưa đủ: một dòng Error lúc 3 giờ sáng
            // không ai thấy, còn một job Failed nằm trong dashboard thì có. Đây cũng là
            // cùng lựa chọn với lệnh CLI — nó thoát khác 0 thay vì chỉ in ra.
            (await chạy.Should().ThrowAsync<InvalidOperationException>())
                .WithMessage("*lệch sổ*");
        }
        finally
        {
            // Trả ví về khớp sổ. Fixture dùng chung một database cho cả collection, nên
            // để lại một ví lệch ở đây sẽ làm mọi test khác có kiểm bất biến
            // `SUM(sổ cái) = số dư` đỏ theo — và đỏ vì test này, không vì lỗi của chúng.
            await db.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE wallets SET balance = balance - 250000 WHERE user_id = {userId}");
        }
    }

    [Fact]
    public async Task Đối_soát_không_ném_lỗi_khi_mọi_ví_khớp_sổ()
    {
        await using var db = fixture.CreateContext();
        var harness = WalletTestData.Harness(fixture);
        var userId = (await TestData.CreateUserAsync(db)).Id;

        // SeedWalletAsync ghi cả bút toán lẫn số dư nên bất biến vẫn đúng.
        await WalletTestData.SeedWalletAsync(db, userId, 500_000);

        // Chỉ có nghĩa khi DB đang sạch; ví lệch do test khác để lại sẽ làm test này đỏ
        // vì lý do không liên quan, nên nói rõ điều kiện đó ra.
        var drifting = await WalletTestData.CountDriftingWalletsAsync(fixture);
        if (drifting > 0) return;

        var chạy = async () => await Jobs(harness).ReconcileWalletsAsync(CancellationToken.None);

        await chạy.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Nhả_hold_quá_hạn_chạy_lại_được_mà_không_nhả_trùng()
    {
        await using var db = fixture.CreateContext();
        var clock = new FakeClock(DateTimeOffset.UtcNow);
        var harness = WalletTestData.Harness(fixture, clock);
        var userId = (await TestData.CreateUserAsync(db)).Id;
        await WalletTestData.SeedWalletAsync(db, userId, 1_000_000);

        await using (var tx = await harness.Uow.BeginAsync())
        {
            var wallet = await harness.Wallets.GetForUpdateAsync(userId);
            var hold = wallet.Hold(
                Guid.NewGuid(), Massage.Wallet.Domain.Money.Of(300_000),
                clock.UtcNow, TimeSpan.FromMinutes(5));
            await harness.Wallets.AddHoldAsync(hold);
            await harness.Wallets.PersistAmountsAsync(wallet);
            await tx.CommitAsync();
        }

        // Vượt qua thời điểm hết hạn.
        clock.Advance(TimeSpan.FromMinutes(6));

        var jobs = Jobs(harness);
        await jobs.ReleaseExpiredHoldsAsync(CancellationToken.None);

        await using (var check = fixture.CreateContext())
        {
            var held = await check.Wallets.AsNoTracking()
                .Where(w => w.UserId == userId).Select(w => w.Held).FirstAsync();
            held.Should().Be(0, "hold quá hạn phải được nhả");
        }

        // Hangfire chạy lại job khi worker chết giữa chừng, và lịch 5 phút có thể chồng
        // lượt khi một lượt chạy lâu. Lượt thứ hai phải là no-op chứ không được cộng
        // tiền lần nữa — nếu nó không idempotent thì số dư sẽ tự phồng lên.
        await jobs.ReleaseExpiredHoldsAsync(CancellationToken.None);

        await using var sau = fixture.CreateContext();
        var ví = await sau.Wallets.AsNoTracking().FirstAsync(w => w.UserId == userId);
        ví.Held.Should().Be(0);
        ví.Balance.Should().Be(1_000_000, "nhả hold không làm đổi số dư, chạy mấy lần cũng vậy");

        (await WalletTestData.CountDriftingWalletsAsync(fixture))
            .Should().Be(0, "sổ cái vẫn phải khớp số dư sau khi job chạy");
    }

    [Fact]
    public void Tên_job_khớp_với_tên_trong_roadmap()
    {
        // Tên job là khoá định danh trong Hangfire: đổi nó ở code mà quên là sinh ra một
        // job mồ côi vẫn chạy theo lịch cũ, cạnh một job mới cùng nhiệm vụ. Ghim lại đây
        // để việc đổi tên phải là một quyết định có ý thức.
        MaintenanceJobs.HoldCleanup.Should().Be("hold:cleanup");
        MaintenanceJobs.PromotionExpireSweep.Should().Be("promotion:expire-sweep");
        MaintenanceJobs.WalletReconcile.Should().Be("wallet:reconcile");
    }
}
