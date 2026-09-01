using FluentValidation;

namespace Massage.Api.Modules.Search;

/// <param name="Lat">Vĩ độ khách. Bỏ trống khi tìm theo khu vực (trang landing render ở server, không có GPS).</param>
/// <param name="RadiusKm">Bán kính tìm kiếm; chỉ có ý nghĩa khi có toạ độ.</param>
public record SearchQueryDto(
    double? Lat = null,
    double? Lon = null,
    int RadiusKm = 10,
    string? Service = null,
    string? AreaSlug = null,
    int Page = 1,
    int Size = 20);

public class SearchQueryDtoValidator : AbstractValidator<SearchQueryDto>
{
    public SearchQueryDtoValidator()
    {
        RuleFor(x => x.Lat).InclusiveBetween(-90, 90).When(x => x.Lat.HasValue)
            .WithMessage("Vĩ độ không hợp lệ");
        RuleFor(x => x.Lon).InclusiveBetween(-180, 180).When(x => x.Lon.HasValue)
            .WithMessage("Kinh độ không hợp lệ");

        // Một nửa toạ độ là toạ độ sai, không phải toạ độ thiếu — chặn sớm thay vì
        // âm thầm rơi về chế độ tìm theo khu vực và trả kết quả không ai hiểu vì sao.
        RuleFor(x => x).Must(x => x.Lat.HasValue == x.Lon.HasValue)
            .WithMessage("Phải gửi đồng thời cả lat và lon");

        RuleFor(x => x).Must(x => x.Lat.HasValue || !string.IsNullOrWhiteSpace(x.AreaSlug))
            .WithMessage("Cần toạ độ (lat/lon) hoặc areaSlug để giới hạn phạm vi tìm kiếm");

        RuleFor(x => x.RadiusKm).InclusiveBetween(1, 50)
            .WithMessage("Bán kính phải trong khoảng 1 – 50km");
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.Size).InclusiveBetween(1, 50);
    }
}

/// <param name="Lat">Toạ độ đã làm tròn ~100m — đủ để đặt ghim bản đồ, không đủ để lần ra nhà KTV.</param>
public record SearchItemDto(
    Guid Id,
    string FullName,
    string Slug,
    short YearsExperience,
    decimal RatingAvg,
    int RatingCount,
    bool IsOnline,
    double? DistanceM,
    double BoostPoints,
    double BaseScore,
    double Score,
    double Lat,
    double Lon);

public record SearchResponseDto(
    IReadOnlyList<SearchItemDto> Items,
    int Page,
    int Size,
    long Total);
