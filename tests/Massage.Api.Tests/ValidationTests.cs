using FluentAssertions;
using Massage.Api.Modules.Admin;
using Massage.Api.Modules.Auth;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;

namespace Massage.Api.Tests;

public class PhoneNormalizationTests
{
    [Theory]
    [InlineData("+84901234567", "0901234567")]
    [InlineData("0901234567", "0901234567")]
    public void Chuẩn_hoá_số_về_một_dạng_để_không_tạo_hai_tài_khoản(string input, string expected) =>
        AuthService.NormalizePhone(input).Should().Be(expected);
}

public class VerifyDecisionValidatorTests
{
    private readonly VerifyDecisionDtoValidator _validator = new();

    [Fact]
    public void Từ_chối_mà_không_nêu_lý_do_thì_không_hợp_lệ()
    {
        var result = _validator.Validate(new VerifyDecisionDto(VerificationStatuses.Rejected, null));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Duyệt_thì_không_cần_lý_do()
    {
        var result = _validator.Validate(new VerifyDecisionDto(VerificationStatuses.Verified, null));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Quyết_định_lạ_bị_từ_chối()
    {
        var result = _validator.Validate(new VerifyDecisionDto("MAYBE", null));

        result.IsValid.Should().BeFalse();
    }
}

public class VerifyOtpDtoValidatorTests
{
    private readonly VerifyOtpDtoValidator _validator = new();

    [Fact]
    public void Không_cho_client_tự_phong_quyền_ADMIN()
    {
        var result = _validator.Validate(new VerifyOtpDto("0901234567", "123456", null, "ADMIN"));

        result.IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("12345")]
    [InlineData("0201234567")]
    public void Từ_chối_số_điện_thoại_sai_định_dạng(string phone)
    {
        var result = _validator.Validate(new VerifyOtpDto(phone, "123456", null, null));

        result.IsValid.Should().BeFalse();
    }
}

public class UpdateKtvProfileDtoValidatorTests
{
    private readonly UpdateKtvProfileDtoValidator _validator = new();

    [Fact]
    public void Gửi_mỗi_lat_mà_thiếu_lon_bị_từ_chối()
    {
        // Ghép nửa toạ độ mới với nửa cũ sẽ tạo ra một điểm không có thật.
        var result = _validator.Validate(new UpdateKtvProfileDto(
            null, null, null, Lat: 10.77, Lon: null, null, null, null));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Gửi_đủ_cả_hai_toạ_độ_thì_hợp_lệ()
    {
        var result = _validator.Validate(new UpdateKtvProfileDto(
            null, null, null, Lat: 10.77, Lon: 106.7, null, null, null));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Toạ_độ_ngoài_dải_hợp_lệ_bị_từ_chối()
    {
        var result = _validator.Validate(new UpdateKtvProfileDto(
            null, null, null, Lat: 999, Lon: 106.7, null, null, null));

        result.IsValid.Should().BeFalse();
    }
}
