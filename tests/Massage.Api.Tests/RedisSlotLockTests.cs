using FluentAssertions;
using Massage.Api.Modules.Promotions.Infrastructure;
using Massage.Promotion.Domain;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;

namespace Massage.Api.Tests;

/// <summary>
/// Khoá fast-path bằng Redis.
///
/// Chạy trên Redis thật vì thứ cần canh là ngữ nghĩa của chính Redis: <c>SET NX PX</c>
/// và lệnh nhả khoá có so khớp token. Một bản giả sẽ chỉ chứng minh code gọi đúng
/// hàm mình vừa viết.
///
/// Redis không chạy thì test tự bỏ qua thay vì đỏ: khoá này là tối ưu, không phải
/// điều kiện đúng sai, nên không được biến nó thành thứ chặn cả bộ test.
///
/// <b>Cảnh báo khi đọc kết quả:</b> vì bỏ qua trông y hệt vượt qua, một lần chạy
/// xanh ở đây <i>không</i> chứng minh khoá hoạt động — nó có thể chỉ nghĩa là không
/// ai kết nối được Redis. Đặt <c>TEST_REDIS</c> (mặc định <c>localhost:6380</c>) và
/// xem thời gian chạy: có Redis thật thì các test dùng TTL mất khoảng 3 giây, còn
/// bỏ qua thì cả nhóm xong trong vài chục mili giây.
/// </summary>
public class RedisSlotLockTests : IAsyncLifetime
{
    private IConnectionMultiplexer? redis;
    private RedisSlotLock sut = null!;

    public async Task InitializeAsync()
    {
        var host = Environment.GetEnvironmentVariable("TEST_REDIS") ?? "localhost:6380";
        try
        {
            redis = await ConnectionMultiplexer.ConnectAsync(new ConfigurationOptions
            {
                EndPoints = { host },
                AbortOnConnectFail = false,
                ConnectTimeout = 2000,
            });
        }
        catch
        {
            redis = null;
        }

        sut = new RedisSlotLock(
            new RedisConnection(redis?.IsConnected == true ? redis : null),
            NullLogger<RedisSlotLock>.Instance);
    }

    public async Task DisposeAsync()
    {
        if (redis is not null) await redis.DisposeAsync();
    }

    /// <summary>
    /// Redis có sẵn để chạy nhóm test này không.
    ///
    /// Khi <c>TEST_REDIS</c> được đặt tường minh (CI, và lệnh test trong CLAUDE.md),
    /// việc không kết nối được là <b>lỗi thật</b> chứ không phải lý do bỏ qua: bỏ
    /// qua im lặng ở đó nghĩa là khoá có thể hỏng hoàn toàn mà bộ test vẫn xanh.
    /// Chỉ môi trường không khai báo Redis mới được bỏ qua.
    /// </summary>
    private bool Available
    {
        get
        {
            if (redis?.IsConnected == true) return true;

            if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("TEST_REDIS")))
            {
                throw new InvalidOperationException(
                    "TEST_REDIS được đặt nhưng không kết nối được — test khoá slot sẽ " +
                    "bỏ qua im lặng và che mất lỗi thật. Kiểm tra Redis trước khi chạy lại.");
            }

            return false;
        }
    }

    private static readonly DateTimeOffset Window =
        new(2026, 9, 2, 20, 0, 0, TimeSpan.Zero);

    private static readonly TimeSpan Ttl = TimeSpan.FromSeconds(10);

    [Fact]
    public async Task Người_thứ_hai_không_lấy_được_khoá_đang_có_chủ()
    {
        if (!Available) return; // Redis không chạy — bỏ qua, xem ghi chú ở đầu class.
        var area = Guid.NewGuid();

        await using var first = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);
        var second = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);

        first.Should().NotBeNull();
        second.Should().BeNull("khoá đang có chủ thì người sau phải đi thẳng vào DB");
    }

    [Fact]
    public async Task Nhả_khoá_xong_thì_người_khác_lấy_được()
    {
        if (!Available) return; // Redis không chạy — bỏ qua, xem ghi chú ở đầu class.
        var area = Guid.NewGuid();

        var first = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);
        first.Should().NotBeNull();
        await first!.DisposeAsync();

        await using var second = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);
        second.Should().NotBeNull();
    }

    [Fact]
    public async Task Khoá_tách_biệt_theo_khu_vực_loại_gói_và_khung()
    {
        if (!Available) return; // Redis không chạy — bỏ qua, xem ghi chú ở đầu class.
        var area = Guid.NewGuid();

        // Giữ khoá của một (khu vực, loại gói, khung) không được chặn ba biến thể
        // còn lại — nếu chặn, một khu vực đông khách sẽ xếp hàng cả những người
        // đang tranh tồn kho hoàn toàn khác nhau.
        await using var held = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);
        held.Should().NotBeNull();

        await using var otherArea = await sut.TryAcquireAsync(
            Guid.NewGuid(), PackageTypes.VipPin, Window, Ttl);
        await using var otherType = await sut.TryAcquireAsync(
            area, PackageTypes.InstantBoost, Window, Ttl);
        await using var otherWindow = await sut.TryAcquireAsync(
            area, PackageTypes.VipPin, Window.AddHours(1), Ttl);

        otherArea.Should().NotBeNull("khác khu vực là khác tồn kho");
        otherType.Should().NotBeNull("khác loại gói là khác dòng slot");
        otherWindow.Should().NotBeNull("khác khung là khác tồn kho");
    }

    [Fact]
    public async Task Khoá_hết_hạn_thì_tự_nhả()
    {
        if (!Available) return; // Redis không chạy — bỏ qua, xem ghi chú ở đầu class.
        var area = Guid.NewGuid();

        // TTL là lưới an toàn chống process chết mà không nhả khoá. Không có nó,
        // một lần crash sẽ chặn cả khu vực vĩnh viễn.
        await using var first = await sut.TryAcquireAsync(
            area, PackageTypes.VipPin, Window, TimeSpan.FromMilliseconds(300));
        first.Should().NotBeNull();

        await Task.Delay(600);

        await using var second = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);
        second.Should().NotBeNull("hết TTL thì khoá phải tự rơi");
    }

    [Fact]
    public async Task Nhả_khoá_đã_hết_hạn_không_xoá_mất_khoá_của_người_khác()
    {
        if (!Available) return; // Redis không chạy — bỏ qua, xem ghi chú ở đầu class.
        var area = Guid.NewGuid();

        // Đây là lỗi kinh điển của khoá phân tán: A hết hạn giữa chừng, B chiếm được
        // khoá, rồi A xong việc và xoá mù — mở khoá đang thuộc về B. Lệnh nhả phải so
        // khớp token, nên A xoá không trúng gì cả.
        var a = await sut.TryAcquireAsync(
            area, PackageTypes.VipPin, Window, TimeSpan.FromMilliseconds(300));
        a.Should().NotBeNull();

        await Task.Delay(600);

        var b = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);
        b.Should().NotBeNull("khoá của A đã hết hạn");

        // A nhả muộn — không được chạm vào khoá của B.
        await a!.DisposeAsync();

        var c = await sut.TryAcquireAsync(area, PackageTypes.VipPin, Window, Ttl);
        c.Should().BeNull("khoá của B phải còn nguyên sau khi A nhả muộn");

        await b!.DisposeAsync();
    }

    [Fact]
    public async Task Không_có_Redis_thì_trả_null_chứ_không_ném()
    {
        // Redis chết phải làm luồng mua gói chậm hơn, không được làm nó hỏng.
        var offline = new RedisSlotLock(
            new RedisConnection(null), NullLogger<RedisSlotLock>.Instance);

        var handle = await offline.TryAcquireAsync(
            Guid.NewGuid(), PackageTypes.VipPin, Window, Ttl);

        handle.Should().BeNull();
    }
}
