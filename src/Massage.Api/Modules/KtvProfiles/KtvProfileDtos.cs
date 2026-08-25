using FluentValidation;

namespace Massage.Api.Modules.KtvProfiles;

public record CreateKtvProfileDto(
    string FullName,
    string? Bio,
    short? YearsExperience,
    double Lat,
    double Lon,
    string? BaseAddress,
    short ServiceRadiusKm,
    List<Guid>? CoverageAreaIds);

public record UpdateKtvProfileDto(
    string? FullName,
    string? Bio,
    short? YearsExperience,
    double? Lat,
    double? Lon,
    string? BaseAddress,
    short? ServiceRadiusKm,
    List<Guid>? CoverageAreaIds);

public record CreateCertificationDto(string Name, string? IssuingOrg, DateOnly? IssuedAt);

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
