using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Auth;
using Massage.Api.Modules.Auth.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Massage.Api.Tests;

[Collection(PostgresCollection.Name)]
public class OtpServiceTests(PostgresFixture fixture)
{
    // Mỗi test dùng một số điện thoại riêng nên chúng không giẫm lên nhau và
    // không cần dọn bảng giữa các lần chạy.
    private static string NewPhone() => "09" + Random.Shared.Next(10_000_000, 99_999_999);

    private (OtpService Service, Massage.Api.Data.AppDbContext Db) Create(OtpOptions? options = null)
    {
        var db = fixture.CreateContext();
        var service = new OtpService(
            db,
            Options.Create(options ?? new OtpOptions { StubEnabled = true, TtlSeconds = 300, MaxAttempts = 5 }),
            NullLogger<OtpService>.Instance);

        return (service, db);
    }

    [Fact]
    public async Task Mã_đúng_thì_xác_thực_thành_công()
    {
        var (service, _) = Create();
        var phone = NewPhone();
        var issued = await service.IssueAsync(phone, OtpPurposes.Register);

        var result = await service.VerifyAsync(phone, OtpPurposes.Register, issued.DebugCode!);

        result.Ok.Should().BeTrue();
    }

    [Fact]
    public async Task Mã_chỉ_dùng_được_một_lần()
    {
        var (service, _) = Create();
        var phone = NewPhone();
        var issued = await service.IssueAsync(phone, OtpPurposes.Register);
        await service.VerifyAsync(phone, OtpPurposes.Register, issued.DebugCode!);

        var second = await service.VerifyAsync(phone, OtpPurposes.Register, issued.DebugCode!);

        second.Ok.Should().BeFalse();
        second.Reason.Should().Be(OtpFailure.NotFound);
    }

    [Fact]
    public async Task Xin_mã_mới_làm_mã_cũ_hết_hiệu_lực()
    {
        // Nếu mã cũ vẫn sống, kẻ tấn công có thể tích nhiều mã hợp lệ rồi thử song song.
        var (service, _) = Create();
        var phone = NewPhone();
        var first = await service.IssueAsync(phone, OtpPurposes.Register);
        await service.IssueAsync(phone, OtpPurposes.Register);

        var result = await service.VerifyAsync(phone, OtpPurposes.Register, first.DebugCode!);

        result.Ok.Should().BeFalse();
    }

    [Fact]
    public async Task Mã_hết_hạn_bị_từ_chối()
    {
        var (issuer, db) = Create();
        var phone = NewPhone();
        var issued = await issuer.IssueAsync(phone, OtpPurposes.Register);

        await db.OtpCodes.Where(o => o.Phone == phone)
            .ExecuteUpdateAsync(s => s.SetProperty(o => o.ExpiresAt, DateTimeOffset.UtcNow.AddSeconds(-1)));

        // Xác thực bằng service mới (context mới) đúng như thực tế: mỗi HTTP request
        // có DbContext riêng. Dùng lại context cũ sẽ đọc trúng entity còn trong
        // change tracker và không thấy thay đổi mà ExecuteUpdate vừa ghi thẳng xuống DB.
        var (verifier, _) = Create();
        var result = await verifier.VerifyAsync(phone, OtpPurposes.Register, issued.DebugCode!);

        result.Reason.Should().Be(OtpFailure.Expired);
    }

    [Fact]
    public async Task Khoá_sau_khi_thử_sai_quá_số_lần_cho_phép()
    {
        var (service, _) = Create(new OtpOptions { StubEnabled = true, TtlSeconds = 300, MaxAttempts = 3 });
        var phone = NewPhone();
        var issued = await service.IssueAsync(phone, OtpPurposes.Register);

        for (var i = 0; i < 3; i++)
            await service.VerifyAsync(phone, OtpPurposes.Register, "000000");

        // Kể cả khi gửi đúng mã, đã vượt ngưỡng thì vẫn phải bị chặn.
        var result = await service.VerifyAsync(phone, OtpPurposes.Register, issued.DebugCode!);

        result.Reason.Should().Be(OtpFailure.TooManyAttempts);
    }

    [Fact]
    public async Task Mã_được_lưu_dạng_hash_chứ_không_phải_mã_trần()
    {
        var (service, db) = Create();
        var phone = NewPhone();
        var issued = await service.IssueAsync(phone, OtpPurposes.Register);

        var stored = await db.OtpCodes.FirstAsync(o => o.Phone == phone);

        stored.CodeHash.Should().NotBe(issued.DebugCode);
        stored.CodeHash.Should().StartWith("$2");
    }

    [Fact]
    public async Task Tắt_stub_mà_chưa_cắm_SMS_thì_báo_lỗi_rõ_ràng()
    {
        // Thà nổ ngay còn hơn âm thầm không gửi gì rồi để người dùng chờ mã không tồn tại.
        var (service, _) = Create(new OtpOptions { StubEnabled = false, TtlSeconds = 300, MaxAttempts = 5 });

        var act = () => service.IssueAsync(NewPhone(), OtpPurposes.Register);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Chưa cấu hình nhà cung cấp SMS*");
    }
}
