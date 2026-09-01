using FluentAssertions;
using Massage.Wallet.Domain;

namespace Massage.Wallet.Domain.Tests;

public class MoneyTests
{
    [Fact]
    public void Không_nhận_số_tiền_âm() =>
        FluentActions.Invoking(() => Money.Of(-1)).Should().Throw<InvalidAmountException>();

    [Fact]
    public void Không_nhận_phần_lẻ_vì_VND_không_có_xu() =>
        FluentActions.Invoking(() => Money.Of(1000.5m)).Should().Throw<InvalidAmountException>();

    [Fact]
    public void Nạp_0_đồng_là_lỗi_gọi_hàm_chứ_không_phải_giao_dịch_hợp_lệ() =>
        FluentActions.Invoking(() => Money.Positive(0)).Should().Throw<InvalidAmountException>();

    [Fact]
    public void Trừ_ra_số_âm_nổ_ngay_tại_chỗ_thay_vì_tạo_số_dư_âm() =>
        FluentActions.Invoking(() => Money.Of(100) - Money.Of(200))
            .Should().Throw<InvalidAmountException>();
}

public class WalletTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 1, 10, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

    private static Wallet WalletWith(decimal balance, decimal held = 0) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Money.Of(balance), Money.Of(held), 0);

    [Fact]
    public void Giữ_tiền_không_làm_giảm_số_dư_mà_chỉ_giảm_phần_khả_dụng()
    {
        var wallet = WalletWith(1_000_000);

        wallet.Hold(Guid.NewGuid(), Money.Of(300_000), Now, Ttl);

        // Đây là bất biến quan trọng nhất của luồng mua: nếu Hold trừ thẳng số dư,
        // KTV thua cuộc tranh slot sẽ thấy tiền biến mất rồi mới được hoàn lại.
        wallet.Balance.Amount.Should().Be(1_000_000);
        wallet.Held.Amount.Should().Be(300_000);
        wallet.Available.Amount.Should().Be(700_000);
    }

    [Fact]
    public void Không_giữ_được_quá_phần_khả_dụng()
    {
        var wallet = WalletWith(1_000_000, held: 800_000);

        FluentActions.Invoking(() => wallet.Hold(Guid.NewGuid(), Money.Of(300_000), Now, Ttl))
            .Should().Throw<InsufficientBalanceException>();
    }

    [Fact]
    public void Chốt_giao_dịch_mới_trừ_tiền_và_ghi_đúng_số_dư_sau()
    {
        var wallet = WalletWith(1_000_000);
        var hold = wallet.Hold(Guid.NewGuid(), Money.Of(300_000), Now, Ttl);

        var entry = wallet.Capture(hold, Now, "key-1", Guid.NewGuid());

        wallet.Balance.Amount.Should().Be(700_000);
        wallet.Held.Amount.Should().Be(0);
        entry.Amount.Should().Be(-300_000, "tiền ra mang dấu âm để tổng sổ cái bằng số dư");
        entry.BalanceAfter.Amount.Should().Be(700_000);
    }

    [Fact]
    public void Nhả_tiền_trả_lại_phần_khả_dụng_và_không_sinh_bút_toán()
    {
        var wallet = WalletWith(1_000_000);
        var hold = wallet.Hold(Guid.NewGuid(), Money.Of(300_000), Now, Ttl);

        wallet.Release(hold);

        wallet.Balance.Amount.Should().Be(1_000_000);
        wallet.Available.Amount.Should().Be(1_000_000);
        hold.Status.Should().Be(HoldStatuses.Released);
    }

    [Fact]
    public void Chốt_hai_lần_cùng_một_hold_bị_chặn()
    {
        var wallet = WalletWith(1_000_000);
        var hold = wallet.Hold(Guid.NewGuid(), Money.Of(300_000), Now, Ttl);
        wallet.Capture(hold, Now, "key-1", Guid.NewGuid());

        // Không chặn thì cùng một lần mua bị trừ tiền hai lần.
        FluentActions.Invoking(() => wallet.Capture(hold, Now, "key-2", Guid.NewGuid()))
            .Should().Throw<HoldNotActiveException>();
    }

    [Fact]
    public void Chốt_một_hold_đã_hết_hạn_bị_chặn()
    {
        var wallet = WalletWith(1_000_000);
        var hold = wallet.Hold(Guid.NewGuid(), Money.Of(300_000), Now, Ttl);

        FluentActions.Invoking(() => wallet.Capture(hold, Now.AddMinutes(6), "key-1", Guid.NewGuid()))
            .Should().Throw<HoldNotActiveException>();
    }

    [Fact]
    public void Không_chốt_được_hold_của_ví_khác()
    {
        var mine = WalletWith(1_000_000);
        var other = WalletWith(1_000_000);
        var holdOfOther = other.Hold(Guid.NewGuid(), Money.Of(100_000), Now, Ttl);

        FluentActions.Invoking(() => mine.Capture(holdOfOther, Now, "key-1", Guid.NewGuid()))
            .Should().Throw<HoldNotActiveException>();
    }

    [Fact]
    public void Nạp_tiền_cộng_số_dư_và_ghi_bút_toán_dương()
    {
        var wallet = WalletWith(0);

        var entry = wallet.TopUp(Money.Of(500_000), "VNPAY:12345");

        wallet.Balance.Amount.Should().Be(500_000);
        entry.Amount.Should().Be(500_000);
        entry.IdempotencyKey.Should().Be("VNPAY:12345");
    }

    [Fact]
    public void Tổng_bút_toán_luôn_bằng_số_dư_sau_một_chuỗi_thao_tác()
    {
        var wallet = WalletWith(0);
        var entries = new List<LedgerEntry> { wallet.TopUp(Money.Of(1_000_000), "top-1") };

        var hold = wallet.Hold(Guid.NewGuid(), Money.Of(300_000), Now, Ttl);
        entries.Add(wallet.Capture(hold, Now, "buy-1", Guid.NewGuid()));
        entries.Add(wallet.Refund(Money.Of(100_000), "refund-1", Guid.NewGuid()));

        // Bất biến mà job đối soát kiểm mỗi đêm. Giữ/nhả tiền không xuất hiện trong
        // sổ vì chúng không đổi số dư — đó là lý do phép cộng này đúng theo nghĩa đen.
        entries.Sum(e => e.Amount).Should().Be(wallet.Balance.Amount);
        wallet.Balance.Amount.Should().Be(800_000);
    }
}

public class ArchitectureBoundaryTests
{
    [Fact]
    public void Domain_ví_không_được_tham_chiếu_EF_hay_Npgsql()
    {
        var referenced = typeof(Money).Assembly.GetReferencedAssemblies()
            .Select(a => a.Name ?? "")
            .ToList();

        // Ranh giới Hexagonal ở đây do trình biên dịch ép, nhưng chỉ khi không ai
        // thêm package reference vào csproj. Test này là thứ canh điều đó — nếu nó
        // đỏ thì tầng hạ tầng đã rò vào domain, và test nghiệp vụ tiền bạc sẽ bắt
        // đầu cần một database để chạy.
        referenced.Should().NotContain(n =>
            n.Contains("EntityFrameworkCore", StringComparison.OrdinalIgnoreCase)
            || n.Contains("Npgsql", StringComparison.OrdinalIgnoreCase)
            || n.StartsWith("Microsoft.AspNetCore", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Domain_gói_quảng_cáo_cũng_vậy()
    {
        var referenced = typeof(Promotion.Domain.PromotionPackage).Assembly
            .GetReferencedAssemblies().Select(a => a.Name ?? "").ToList();

        referenced.Should().NotContain(n =>
            n.Contains("EntityFrameworkCore", StringComparison.OrdinalIgnoreCase)
            || n.Contains("Npgsql", StringComparison.OrdinalIgnoreCase)
            || n.StartsWith("Microsoft.AspNetCore", StringComparison.OrdinalIgnoreCase));
    }
}
