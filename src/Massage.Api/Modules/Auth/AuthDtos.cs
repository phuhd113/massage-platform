using FluentValidation;
using Massage.Api.Modules.Auth.Entities;

namespace Massage.Api.Modules.Auth;

public record RequestOtpDto(string Phone, string? Purpose);
public record VerifyOtpDto(string Phone, string Code, string? Purpose, string? Role);

public static class PhoneRules
{
    // Chấp nhận cả 0xxxxxxxxx và +84xxxxxxxxx; chuẩn hoá về một dạng ở AuthService
    // để không tạo hai tài khoản cho cùng một số.
    public const string VnPhonePattern = @"^(0|\+84)(3|5|7|8|9)\d{8}$";
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
