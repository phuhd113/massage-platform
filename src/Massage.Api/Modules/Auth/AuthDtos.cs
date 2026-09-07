using FluentValidation;
using Massage.Api.Modules.Auth.Entities;

namespace Massage.Api.Modules.Auth;

public record RequestOtpDto(string Phone, string? Purpose);
public record VerifyOtpDto(string Phone, string Code, string? Purpose, string? Role);

public record RegisterPasswordDto(string Phone, string Password, string? Role);
public record LoginPasswordDto(string Phone, string Password);
public record ChangePasswordDto(string? CurrentPassword, string NewPassword);

public static class PhoneRules
{
    // Chấp nhận cả 0xxxxxxxxx và +84xxxxxxxxx; chuẩn hoá về một dạng ở AuthService
    // để không tạo hai tài khoản cho cùng một số.
    public const string VnPhonePattern = @"^(0|\+84)(3|5|7|8|9)\d{8}$";
}

public static class PasswordRules
{
    /// <summary>
    /// Chỉ ràng buộc độ dài, cố ý không ép chữ hoa / ký tự đặc biệt.
    ///
    /// Luật phức tạp đẩy người dùng sang đúng một nhúm mật khẩu dễ đoán có dạng
    /// <c>Abc@1234</c> — dài thêm vài ký tự thì entropy tăng thật, còn bắt thêm một
    /// loại ký tự thì phần lớn người ta giải quyết bằng cách thêm "!" vào cuối.
    /// </summary>
    public const int MinLength = 8;

    /// <summary>
    /// Chặn trên để một chuỗi rất dài không biến mỗi lượt đăng nhập thành một lượt
    /// băm tốn CPU — BCrypt vốn cố ý chậm, nên đây là đường DoS rẻ tiền.
    /// </summary>
    public const int MaxLength = 128;
}

public class RequestOtpDtoValidator : AbstractValidator<RequestOtpDto>
{
    public RequestOtpDtoValidator()
    {
        RuleFor(x => x.Phone).Matches(PhoneRules.VnPhonePattern)
            .WithMessage("Số điện thoại không hợp lệ");
        RuleFor(x => x.Purpose).Must(p => p is null or OtpPurposes.Register or OtpPurposes.Login)
            .WithMessage("Purpose phải là REGISTER hoặc LOGIN");
    }
}

public class VerifyOtpDtoValidator : AbstractValidator<VerifyOtpDto>
{
    public VerifyOtpDtoValidator()
    {
        RuleFor(x => x.Phone).Matches(PhoneRules.VnPhonePattern)
            .WithMessage("Số điện thoại không hợp lệ");
        RuleFor(x => x.Code).Matches(@"^\d{6}$").WithMessage("Mã OTP gồm 6 chữ số");
        RuleFor(x => x.Purpose).Must(p => p is null or OtpPurposes.Register or OtpPurposes.Login)
            .WithMessage("Purpose phải là REGISTER hoặc LOGIN");
        // Chỉ cho tự chọn CUSTOMER hoặc KTV — không bao giờ để client tự phong ADMIN.
        RuleFor(x => x.Role).Must(r => r is null or UserRoles.Customer or UserRoles.Ktv)
            .WithMessage("Role phải là CUSTOMER hoặc KTV");
    }
}

public class RegisterPasswordDtoValidator : AbstractValidator<RegisterPasswordDto>
{
    public RegisterPasswordDtoValidator()
    {
        RuleFor(x => x.Phone).Matches(PhoneRules.VnPhonePattern)
            .WithMessage("Số điện thoại không hợp lệ");
        RuleFor(x => x.Password)
            .MinimumLength(PasswordRules.MinLength)
            .WithMessage($"Mật khẩu phải có ít nhất {PasswordRules.MinLength} ký tự")
            .MaximumLength(PasswordRules.MaxLength)
            .WithMessage($"Mật khẩu tối đa {PasswordRules.MaxLength} ký tự");
        // Cùng danh sách trắng với VerifyOtpDtoValidator — đây là đường thứ hai tạo
        // được tài khoản, nên nó phải chặn ADMIN y hệt đường thứ nhất.
        RuleFor(x => x.Role).Must(r => r is null or UserRoles.Customer or UserRoles.Ktv)
            .WithMessage("Role phải là CUSTOMER hoặc KTV");
    }
}

public class LoginPasswordDtoValidator : AbstractValidator<LoginPasswordDto>
{
    public LoginPasswordDtoValidator()
    {
        RuleFor(x => x.Phone).Matches(PhoneRules.VnPhonePattern)
            .WithMessage("Số điện thoại không hợp lệ");
        // Chỉ chặn rỗng và chặn trên: ràng buộc độ dài tối thiểu ở đây sẽ trả lời
        // khác nhau cho "mật khẩu ngắn" và "mật khẩu sai", tức là lộ ra rằng tài
        // khoản có tồn tại. Mọi lượt sai phải trông giống hệt nhau.
        RuleFor(x => x.Password).NotEmpty().WithMessage("Vui lòng nhập mật khẩu")
            .MaximumLength(PasswordRules.MaxLength)
            .WithMessage($"Mật khẩu tối đa {PasswordRules.MaxLength} ký tự");
    }
}

public class ChangePasswordDtoValidator : AbstractValidator<ChangePasswordDto>
{
    public ChangePasswordDtoValidator()
    {
        RuleFor(x => x.NewPassword)
            .MinimumLength(PasswordRules.MinLength)
            .WithMessage($"Mật khẩu phải có ít nhất {PasswordRules.MinLength} ký tự")
            .MaximumLength(PasswordRules.MaxLength)
            .WithMessage($"Mật khẩu tối đa {PasswordRules.MaxLength} ký tự");
    }
}
