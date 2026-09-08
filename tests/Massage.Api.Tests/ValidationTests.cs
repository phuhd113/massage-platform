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
            FullName: null, Gender: null, YearsExperience: null, Lat: 10.77, Lon: null,
            BaseAddress: null, BaseWardId: null, BaseStreet: null,
            ServiceRadiusKm: null, CoverageAreaIds: null));

        result.IsValid.Should().BeFalse();
    }

    [Fact]
    public void Gửi_đủ_cả_hai_toạ_độ_thì_hợp_lệ()
    {
        var result = _validator.Validate(new UpdateKtvProfileDto(
            FullName: null, Gender: null, YearsExperience: null, Lat: 10.77, Lon: 106.7,
            BaseAddress: null, BaseWardId: null, BaseStreet: null,
            ServiceRadiusKm: null, CoverageAreaIds: null));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Toạ_độ_ngoài_dải_hợp_lệ_bị_từ_chối()
    {
        var result = _validator.Validate(new UpdateKtvProfileDto(
            FullName: null, Gender: null, YearsExperience: null, Lat: 999, Lon: 106.7,
            BaseAddress: null, BaseWardId: null, BaseStreet: null,
            ServiceRadiusKm: null, CoverageAreaIds: null));

        result.IsValid.Should().BeFalse();
    }
}

/// <summary>
/// Giới tính là điều kiện bắt buộc ở đường TẠO hồ sơ và tuỳ chọn ở đường SỬA — hai
/// quy tắc khác nhau cho cùng một trường, nên cả hai đều cần test riêng.
/// </summary>
public class KtvGenderValidationTests
{
    private static CreateKtvProfileDto Create(string gender) => new(
        FullName: "Nguyễn Thị A",
        Gender: gender,
        YearsExperience: 3,
        Lat: 10.77,
        Lon: 106.7,
        BaseAddress: null,
        BaseWardId: null,
        BaseStreet: null,
        ServiceRadiusKm: 5,
        CoverageAreaIds: null);

    [Theory]
    [InlineData("MALE")]
    [InlineData("FEMALE")]
    public void Tạo_hồ_sơ_với_giới_tính_hợp_lệ(string gender) =>
        new CreateKtvProfileDtoValidator().Validate(Create(gender)).IsValid.Should().BeTrue();

    [Theory]
    [InlineData("")]
    [InlineData("OTHER")]
    [InlineData("nu")]
    [InlineData("Nữ")]
    public void Tạo_hồ_sơ_không_khai_hoặc_khai_lạ_đều_bị_từ_chối(string gender) =>
        new CreateKtvProfileDtoValidator().Validate(Create(gender)).IsValid.Should().BeFalse();

    [Fact]
    public void Sửa_hồ_sơ_không_gửi_giới_tính_là_hợp_lệ()
    {
        // null ở đường sửa nghĩa là "không đổi", không phải "xoá về chưa khai".
        var result = new UpdateKtvProfileDtoValidator().Validate(new UpdateKtvProfileDto(
            FullName: null, Gender: null, YearsExperience: null, Lat: null, Lon: null,
            BaseAddress: null, BaseWardId: null, BaseStreet: null,
            ServiceRadiusKm: null, CoverageAreaIds: null));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Sửa_hồ_sơ_với_giới_tính_lạ_bị_từ_chối()
    {
        var result = new UpdateKtvProfileDtoValidator().Validate(new UpdateKtvProfileDto(
            FullName: null, Gender: "OTHER", YearsExperience: null, Lat: null, Lon: null,
            BaseAddress: null, BaseWardId: null, BaseStreet: null,
            ServiceRadiusKm: null, CoverageAreaIds: null));

        result.IsValid.Should().BeFalse();
    }
}

/// <summary>
/// Bộ lọc mới của popup tìm kiếm. Giá trị lạ phải bị <b>từ chối</b> chứ không được im
/// lặng bỏ qua: bỏ qua nghĩa là giao diện hiện "đang lọc" trong khi kết quả không lọc gì.
/// </summary>
public class SearchFilterValidationTests
{
    private readonly Massage.Api.Modules.Search.SearchQueryDtoValidator _validator = new();

    private static Massage.Api.Modules.Search.SearchQueryDto Query(
        string? gender = null, short? minYears = null, decimal? minRating = null) =>
        new(AreaSlug: "tp-ho-chi-minh", Gender: gender,
            MinYearsExperience: minYears, MinRating: minRating);

    [Theory]
    [InlineData("MALE")]
    [InlineData("FEMALE")]
    public void Giới_tính_hợp_lệ_được_chấp_nhận(string gender) =>
        _validator.Validate(Query(gender: gender)).IsValid.Should().BeTrue();

    [Theory]
    [InlineData("OTHER")]
    [InlineData("male")]
    public void Giới_tính_lạ_bị_từ_chối(string gender) =>
        _validator.Validate(Query(gender: gender)).IsValid.Should().BeFalse();

    [Fact]
    public void Không_lọc_giới_tính_là_hợp_lệ() =>
        _validator.Validate(Query()).IsValid.Should().BeTrue();

    [Theory]
    [InlineData((short)-1)]
    [InlineData((short)61)]
    public void Kinh_nghiệm_ngoài_dải_bị_từ_chối(short years) =>
        _validator.Validate(Query(minYears: years)).IsValid.Should().BeFalse();

    [Theory]
    [InlineData(-0.5)]
    [InlineData(5.5)]
    public void Ngưỡng_sao_ngoài_dải_bị_từ_chối(double rating) =>
        _validator.Validate(Query(minRating: (decimal)rating)).IsValid.Should().BeFalse();
}
