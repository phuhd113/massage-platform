using FluentAssertions;
using Massage.Api.Common;
using Massage.Api.Modules.Auth;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.Auth.Sms;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Massage.Api.Tests;

/// <summary>
/// Đường đăng nhập bằng mật khẩu — lối vào đang dùng ở giai đoạn đầu, khi chưa có
/// giấy phép kinh doanh để bật Zalo ZNS.
/// </summary>
[Collection(PostgresCollection.Name)]
public class PasswordAuthServiceTests(PostgresFixture fixture)
{
    // Như OtpServiceTests: mỗi test một số riêng nên chúng không giẫm lên nhau.
    private static string NewPhone() => "09" + Random.Shared.Next(10_000_000, 99_999_999);

    private const string GoodPassword = "matkhau-du-dai";

    /// <summary>
    /// Mỗi lần gọi trả một <c>DbContext</c> mới, giống hệt việc mỗi HTTP request có
    /// context riêng — xem <c>.claude/rules/testing-postgres.md</c>.
    /// </summary>
    private AuthService Create() => new(
        fixture.CreateContext(),
        new OtpService(
            fixture.CreateContext(),
            new StubOtpSender(NullLogger<StubOtpSender>.Instance),
            Options.Create(new OtpOptions { StubEnabled = true, TtlSeconds = 300, MaxAttempts = 5 }),
            NullLogger<OtpService>.Instance),
        Options.Create(new JwtOptions
        {
            Secret = "test-only-secret-at-least-32-characters-long",
            Issuer = "massage-platform",
            Audience = "massage-platform",
            ExpiresDays = 7,
        }));

    private async Task<User> LoadUserAsync(string phone)
    {
        await using var db = fixture.CreateContext();
        return await db.Users.AsNoTracking().SingleAsync(u => u.Phone == phone);
    }

    [Fact]
    public async Task Đăng_ký_tạo_tài_khoản_và_cấp_token()
    {
        var phone = NewPhone();

        var result = await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        result.AccessToken.Should().NotBeNullOrWhiteSpace();
        result.User.Phone.Should().Be(phone);
        result.User.Role.Should().Be(UserRoles.Customer);
    }

    [Fact]
    public async Task Mật_khẩu_lưu_dưới_dạng_hash_không_phải_chữ_thô()
    {
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        var user = await LoadUserAsync(phone);

        user.PasswordHash.Should().NotBe(GoodPassword);
        user.PasswordHash.Should().StartWith("$2");
    }

    [Fact]
    public async Task Đăng_ký_không_đánh_dấu_số_điện_thoại_đã_xác_thực()
    {
        // Chưa có kênh gửi mã nào chạy thật, nên đánh dấu đã xác thực là ghi vào DB
        // một điều chưa ai kiểm — và về sau không phân biệt được số nào thật sự đã
        // qua OTP.
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        (await LoadUserAsync(phone)).PhoneVerifiedAt.Should().BeNull();
    }

    [Fact]
    public async Task Đăng_ký_trùng_số_bị_từ_chối()
    {
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        var act = () => Create().RegisterWithPasswordAsync(phone, "mat-khau-khac", UserRoles.Customer);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Đăng_ký_trùng_số_bị_từ_chối_cả_khi_tài_khoản_cũ_chưa_có_mật_khẩu()
    {
        // Tài khoản tạo bằng OTP có PasswordHash = NULL. Cho "đăng ký" ghi đè lên nó
        // là biến trang đăng ký thành đường chiếm tài khoản người khác chỉ bằng việc
        // biết số điện thoại của họ.
        var phone = NewPhone();
        await using (var db = fixture.CreateContext())
        {
            db.Users.Add(new User { Phone = phone, Role = UserRoles.Ktv });
            await db.SaveChangesAsync();
        }

        var act = () => Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        await act.Should().ThrowAsync<ConflictException>();

        // Và vai trò cũ phải còn nguyên — không bị hạ xuống CUSTOMER.
        (await LoadUserAsync(phone)).Role.Should().Be(UserRoles.Ktv);
    }

    [Fact]
    public async Task Đăng_nhập_đúng_mật_khẩu_thì_cấp_token()
    {
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Ktv);

        var result = await Create().LoginWithPasswordAsync(phone, GoodPassword);

        result.AccessToken.Should().NotBeNullOrWhiteSpace();
        result.User.Role.Should().Be(UserRoles.Ktv);
    }

    [Fact]
    public async Task Số_chấp_nhận_cả_dạng_84_lẫn_dạng_0()
    {
        // NormalizePhone dùng chung với đường OTP: một người chỉ có một tài khoản dù
        // gõ số theo dạng nào.
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        var result = await Create().LoginWithPasswordAsync("+84" + phone[1..], GoodPassword);

        result.User.Phone.Should().Be(phone);
    }

    [Fact]
    public async Task Sai_mật_khẩu_và_số_không_tồn_tại_trả_về_cùng_một_loại_lỗi()
    {
        // Phân biệt hai trường hợp là mở đường dò xem số nào đã có tài khoản.
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        var saiMatKhau = await Record.ExceptionAsync(
            () => Create().LoginWithPasswordAsync(phone, "sai-mat-khau-roi"));
        var khongCoTaiKhoan = await Record.ExceptionAsync(
            () => Create().LoginWithPasswordAsync(NewPhone(), GoodPassword));

        saiMatKhau.Should().BeOfType<InvalidLoginException>();
        khongCoTaiKhoan.Should().BeOfType<InvalidLoginException>();
        khongCoTaiKhoan!.Message.Should().Be(saiMatKhau!.Message);
    }

    [Fact]
    public async Task Tài_khoản_chưa_đặt_mật_khẩu_không_đăng_nhập_được_bằng_mật_khẩu_rỗng()
    {
        // PasswordHash = NULL không được coi là "khớp với mọi thứ".
        var phone = NewPhone();
        await using (var db = fixture.CreateContext())
        {
            db.Users.Add(new User { Phone = phone, Role = UserRoles.Customer });
            await db.SaveChangesAsync();
        }

        var act = () => Create().LoginWithPasswordAsync(phone, "");

        await act.Should().ThrowAsync<InvalidLoginException>();
    }

    [Fact]
    public async Task Sai_năm_lần_thì_khoá_tài_khoản_dù_lần_sau_gõ_đúng()
    {
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        for (var i = 0; i < AuthService.MaxFailedLogins; i++)
        {
            await Record.ExceptionAsync(() => Create().LoginWithPasswordAsync(phone, "sai-mat-khau-roi"));
        }

        (await LoadUserAsync(phone)).LockedUntil.Should().NotBeNull();

        // Đúng mật khẩu vẫn bị chặn: nếu không thì khoá chỉ làm phiền người thật mà
        // không cản được kịch bản dò.
        var act = () => Create().LoginWithPasswordAsync(phone, GoodPassword);
        await act.Should().ThrowAsync<TooManyAttemptsException>();
    }

    [Fact]
    public async Task Đăng_nhập_thành_công_xoá_bộ_đếm_sai()
    {
        // Nếu không reset thì bốn lần gõ nhầm rải rác qua nhiều tháng cộng dồn lại
        // thành một lần khoá không liên quan gì tới việc bị tấn công.
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        await Record.ExceptionAsync(() => Create().LoginWithPasswordAsync(phone, "sai-mat-khau-roi"));
        (await LoadUserAsync(phone)).FailedLoginAttempts.Should().Be(1);

        await Create().LoginWithPasswordAsync(phone, GoodPassword);

        (await LoadUserAsync(phone)).FailedLoginAttempts.Should().Be(0);
    }

    [Fact]
    public async Task Hết_hạn_khoá_thì_đăng_nhập_lại_được()
    {
        var phone = NewPhone();
        await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        await using (var db = fixture.CreateContext())
        {
            var user = await db.Users.SingleAsync(u => u.Phone == phone);
            user.LockedUntil = DateTimeOffset.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }

        var result = await Create().LoginWithPasswordAsync(phone, GoodPassword);

        result.AccessToken.Should().NotBeNullOrWhiteSpace();
        (await LoadUserAsync(phone)).LockedUntil.Should().BeNull();
    }

    [Fact]
    public async Task Đổi_mật_khẩu_phải_gửi_đúng_mật_khẩu_hiện_tại()
    {
        var phone = NewPhone();
        var created = await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        var act = () => Create().SetPasswordAsync(created.User.Id, "khong-phai-mat-khau", "mat-khau-moi-123");

        await act.Should().ThrowAsync<InvalidLoginException>();
    }

    [Fact]
    public async Task Đổi_mật_khẩu_thành_công_thì_mật_khẩu_cũ_hết_dùng_được()
    {
        var phone = NewPhone();
        var created = await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        await Create().SetPasswordAsync(created.User.Id, GoodPassword, "mat-khau-moi-123");

        await Create().Invoking(a => a.LoginWithPasswordAsync(phone, "mat-khau-moi-123"))
            .Should().NotThrowAsync();
        await Create().Invoking(a => a.LoginWithPasswordAsync(phone, GoodPassword))
            .Should().ThrowAsync<InvalidLoginException>();
    }

    [Fact]
    public async Task Tài_khoản_tạo_bằng_OTP_đặt_được_mật_khẩu_mà_không_cần_mật_khẩu_cũ()
    {
        // Đây là đường duy nhất để tài khoản OTP có mật khẩu — bắt nó gửi "mật khẩu
        // hiện tại" là khoá luôn lối đó, vì nó không có cái nào.
        var phone = NewPhone();
        Guid userId;
        await using (var db = fixture.CreateContext())
        {
            var user = new User { Phone = phone, Role = UserRoles.Customer };
            db.Users.Add(user);
            await db.SaveChangesAsync();
            userId = user.Id;
        }

        await Create().SetPasswordAsync(userId, currentPassword: null, "mat-khau-moi-123");

        await Create().Invoking(a => a.LoginWithPasswordAsync(phone, "mat-khau-moi-123"))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task Đổi_mật_khẩu_mở_khoá_tài_khoản_đang_bị_khoá()
    {
        // Người bị khoá vì quên mật khẩu mà vẫn còn phiên đăng nhập trên máy khác
        // phải tự thoát ra được, thay vì ngồi chờ hết 15 phút.
        var phone = NewPhone();
        var created = await Create().RegisterWithPasswordAsync(phone, GoodPassword, UserRoles.Customer);

        await using (var db = fixture.CreateContext())
        {
            var user = await db.Users.SingleAsync(u => u.Phone == phone);
            user.LockedUntil = DateTimeOffset.UtcNow.AddMinutes(15);
            await db.SaveChangesAsync();
        }

        await Create().SetPasswordAsync(created.User.Id, GoodPassword, "mat-khau-moi-123");

        (await LoadUserAsync(phone)).LockedUntil.Should().BeNull();
    }
}
