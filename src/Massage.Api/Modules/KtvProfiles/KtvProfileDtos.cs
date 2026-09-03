using FluentValidation;

namespace Massage.Api.Modules.KtvProfiles;

public record CreateKtvProfileDto(
    string FullName,
    string? Bio,
    short? YearsExperience,
    double Lat,
    double Lon,
    string? BaseAddress,
    Guid? BaseWardId,
    string? BaseStreet,
    short ServiceRadiusKm,
    List<Guid>? CoverageAreaIds);

public record UpdateKtvProfileDto(
    string? FullName,
    string? Bio,
    short? YearsExperience,
    double? Lat,
    double? Lon,
    string? BaseAddress,
    Guid? BaseWardId,
    string? BaseStreet,
    short? ServiceRadiusKm,
    List<Guid>? CoverageAreaIds);

public record CreateCertificationDto(string Name, string? IssuingOrg, DateOnly? IssuedAt);

public record SitemapEntryDto(Guid Id, string Slug, DateTimeOffset LastModified);

public record PublicCertificationDto(Guid Id, string Name, string? IssuingOrg, DateOnly? IssuedAt);

public record PublicAreaDto(Guid Id, string Name, string Slug, string Level, string? ProvinceSlug);

/// <summary>
/// Địa chỉ hành chính của KTV, suy từ phường đã lưu. Chỉ trả ở đường "hồ sơ của tôi" —
/// trang công khai không bao giờ hiện địa chỉ, chỉ hiện khu vực nhận phục vụ.
/// </summary>
public record BaseAreaDto(
    Guid WardId, string WardName, string WardSlug,
    Guid DistrictId, string DistrictName, string DistrictSlug,
    Guid ProvinceId, string ProvinceName, string ProvinceSlug);

public record PublicKtvServiceDto(Guid ServiceId, string Name, string Slug, decimal PriceFrom, short DurationMin);

/// <summary>
/// Hồ sơ hiển thị cho khách và cho Googlebot.
///
/// Khác với DTO nội bộ ở ba điểm, cả ba đều có chủ ý:
/// không có <c>RejectionReason</c> (ghi chú nội bộ giữa admin và KTV),
/// chỉ chứng chỉ đã duyệt, và không có địa chỉ nhà — thay vào đó là danh sách
/// khu vực nhận phục vụ.
/// </summary>
/// <param name="Lat">Toạ độ đã làm tròn ~100m, đủ để đặt ghim bản đồ.</param>
public record PublicKtvProfileDto(
    Guid Id,
    string FullName,
    string Slug,
    string? Bio,
    short YearsExperience,
    double Lat,
    double Lon,
    short ServiceRadiusKm,
    decimal RatingAvg,
    int RatingCount,
    bool IsOnline,
    DateTimeOffset CreatedAt,
    List<PublicCertificationDto> Certifications,
    List<PublicAreaDto> CoverageAreas,
    List<PublicKtvServiceDto> Services);

public class CreateKtvProfileDtoValidator : AbstractValidator<CreateKtvProfileDto>
{
    public CreateKtvProfileDtoValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().Length(2, 120);
        RuleFor(x => x.Bio).MaximumLength(2000);
        RuleFor(x => x.YearsExperience).InclusiveBetween((short)0, (short)60).When(x => x.YearsExperience.HasValue);
        RuleFor(x => x.Lat).InclusiveBetween(-90, 90).WithMessage("Vĩ độ không hợp lệ");
        RuleFor(x => x.Lon).InclusiveBetween(-180, 180).WithMessage("Kinh độ không hợp lệ");
        RuleFor(x => x.BaseAddress).MaximumLength(255);
        RuleFor(x => x.BaseStreet).MaximumLength(255);
        RuleFor(x => x.ServiceRadiusKm).InclusiveBetween((short)1, (short)50);
        RuleFor(x => x.CoverageAreaIds).Must(ids => ids is null || ids.Count <= 30)
            .WithMessage("Tối đa 30 khu vực hoạt động");
    }
}

public class UpdateKtvProfileDtoValidator : AbstractValidator<UpdateKtvProfileDto>
{
    public UpdateKtvProfileDtoValidator()
    {
        RuleFor(x => x.FullName).Length(2, 120).When(x => x.FullName is not null);
        RuleFor(x => x.Bio).MaximumLength(2000);
        RuleFor(x => x.YearsExperience).InclusiveBetween((short)0, (short)60).When(x => x.YearsExperience.HasValue);
        RuleFor(x => x.Lat).InclusiveBetween(-90, 90).When(x => x.Lat.HasValue);
        RuleFor(x => x.Lon).InclusiveBetween(-180, 180).When(x => x.Lon.HasValue);
        RuleFor(x => x.BaseAddress).MaximumLength(255);
        RuleFor(x => x.BaseStreet).MaximumLength(255);
        RuleFor(x => x.ServiceRadiusKm).InclusiveBetween((short)1, (short)50).When(x => x.ServiceRadiusKm.HasValue);
        // Đổi vị trí phải gửi đủ cả hai toạ độ, nếu không sẽ ghép nửa cũ nửa mới
        // thành một điểm không có thật.
        RuleFor(x => x).Must(x => x.Lat.HasValue == x.Lon.HasValue)
            .WithMessage("Phải gửi đồng thời cả lat và lon khi đổi vị trí");
        RuleFor(x => x.CoverageAreaIds).Must(ids => ids is null || ids.Count <= 30)
            .WithMessage("Tối đa 30 khu vực hoạt động");
    }
}

public class CreateCertificationDtoValidator : AbstractValidator<CreateCertificationDto>
{
    public CreateCertificationDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Length(2, 150);
        RuleFor(x => x.IssuingOrg).MaximumLength(150);
    }
}
