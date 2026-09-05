using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Auth;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Auth.Sms;
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

    private (OtpService Service, Massage.Api.Data.AppDbContext Db) Create(
        OtpOptions? options = null, IOtpSender? sender = null)
    {
        var db = fixture.CreateContext();
        var service = new OtpService(
            db,
            sender ?? new StubOtpSender(NullLogger<StubOtpSender>.Instance),
            Options.Create(options ?? new OtpOptions { StubEnabled = true, TtlSeconds = 300, MaxAttempts = 5 }),
            NullLogger<OtpService>.Instance);

        return (service, db);
    }

    /// <summary>Adapter luôn thất bại, để kiểm điều gì xảy ra với mã cũ khi không gửi được.</summary>
    private sealed class FailingSender : IOtpSender
    {
        public string Channel => "FAIL";
        public bool RevealsCode => false;
        public Task SendAsync(string phone, string code, int ttl, CancellationToken ct = default) =>
            throw new OtpDeliveryException("nhà cung cấp từ chối");
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
    public async Task Chưa_cắm_nhà_cung_cấp_thì_báo_lỗi_rõ_ràng()
    {
        // Thà nổ ngay còn hơn âm thầm không gửi gì rồi để người dùng chờ mã không tồn tại.
        var (service, _) = Create(sender: new UnconfiguredOtpSender());

        var act = () => service.IssueAsync(NewPhone(), OtpPurposes.Register);

        await act.Should().ThrowAsync<OtpDeliveryException>()
            .WithMessage("*Chưa cấu hình nhà cung cấp SMS*");
    }

    [Fact]
    public async Task Gửi_thất_bại_thì_KHÔNG_lưu_mã_mới()
    {
        // Lưu mã rồi mới phát hiện không gửi được là để lại một mã sống mà không ai
        // cầm được — vô hại nhưng vô nghĩa, và nó chiếm chỗ của mã hợp lệ tiếp theo.
        var (service, db) = Create(sender: new FailingSender());
        var phone = NewPhone();

        var act = () => service.IssueAsync(phone, OtpPurposes.Register);
        await act.Should().ThrowAsync<OtpDeliveryException>();

        var stored = await db.OtpCodes.CountAsync(o => o.Phone == phone);
        stored.Should().Be(0);
    }

    [Fact]
    public async Task Gửi_thất_bại_thì_mã_cũ_vẫn_dùng_được()
    {
        // Đây là lý do việc gửi phải đứng TRƯỚC khi ghi DB.
        //
        // Người dùng đã nhận mã, tin đến chậm nên họ bấm "gửi lại", và lượt gửi lại
        // hỏng. Nếu thứ tự đảo ngược thì mã họ đang cầm vừa bị vô hiệu để đổi lấy một
        // mã không bao giờ tới — biến một phiền toái thành đăng nhập hỏng hẳn.
        var phone = NewPhone();
        var (working, _) = Create();
        var first = await working.IssueAsync(phone, OtpPurposes.Register);

        var (failing, _) = Create(sender: new FailingSender());
        var act = () => failing.IssueAsync(phone, OtpPurposes.Register);
        await act.Should().ThrowAsync<OtpDeliveryException>();

        // DbContext riêng: ExecuteUpdate bỏ qua change tracker nên dùng lại context cũ
        // sẽ đọc trúng entity còn trong tracker chứ không phải trạng thái thật của DB.
        var (verifier, _) = Create();
        var result = await verifier.VerifyAsync(phone, OtpPurposes.Register, first.DebugCode!);

        result.Ok.Should().BeTrue();
    }

    [Fact]
    public async Task Adapter_không_lộ_mã_thì_response_không_chứa_mã()
    {
        // debugCode suy ra từ chính adapter, không từ cờ cấu hình — nên không còn tổ hợp
        // nào vừa gửi tin thật vừa trả mã ra response.
        var (service, _) = Create(sender: new RecordingSender());

        var issued = await service.IssueAsync(NewPhone(), OtpPurposes.Register);

        issued.DebugCode.Should().BeNull();
    }

    [Fact]
    public async Task Mã_gửi_đi_đúng_là_mã_xác_thực_được()
    {
        // Canh việc adapter nhận đúng mã đã lưu: gửi nhầm biến số khác (ví dụ hash) thì
        // mọi test dùng DebugCode vẫn xanh, còn người dùng thật không bao giờ đăng nhập được.
        var recorder = new RecordingSender();
        var (service, _) = Create(sender: recorder);
        var phone = NewPhone();

        await service.IssueAsync(phone, OtpPurposes.Register);

        recorder.LastCode.Should().MatchRegex(@"^\d{6}$");
        var (verifier, _) = Create();
        var result = await verifier.VerifyAsync(phone, OtpPurposes.Register, recorder.LastCode!);
        result.Ok.Should().BeTrue();
    }

    /// <summary>Adapter gửi thành công nhưng không lộ mã — giống ZNS thật.</summary>
    private sealed class RecordingSender : IOtpSender
    {
        public string? LastCode { get; private set; }
        public string? LastPhone { get; private set; }
        public string Channel => "RECORDING";
        public bool RevealsCode => false;

        public Task SendAsync(string phone, string code, int ttl, CancellationToken ct = default)
        {
            LastPhone = phone;
            LastCode = code;
            return Task.CompletedTask;
        }
    }
}
