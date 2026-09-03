using FluentValidation;

namespace Massage.Api.Modules.Search;

/// <param name="Lat">Vĩ độ khách. Bỏ trống khi tìm theo khu vực (trang landing render ở server, không có GPS).</param>
/// <param name="RadiusKm">Bán kính tìm kiếm; chỉ có ý nghĩa khi có toạ độ.</param>
/// <param name="AreaSlug">
/// Slug khu vực. Đứng một mình là slug **tỉnh/thành**; đi kèm <paramref name="ProvinceSlug"/>
/// thì là slug **quận/huyện** trong tỉnh đó.
/// </param>
/// <param name="ProvinceSlug">
/// Tỉnh chứa <paramref name="AreaSlug"/>. Bắt buộc khi tìm theo quận, vì slug quận chỉ
/// duy nhất trong phạm vi tỉnh — riêng "huyen-chau-thanh" đã có ở 10 tỉnh, nên thiếu vế
/// này là trộn KTV của cả mười vào một trang.
/// </param>
/// <param name="IsOnline">Lọc "đang nhận khách". Bỏ trống = không lọc; chỉ nhận giá trị
/// true có nghĩa, vì "chỉ hiện KTV đang bận" không phải nhu cầu có thật của khách.</param>
public record SearchQueryDto(
    double? Lat = null,
    double? Lon = null,
    int RadiusKm = 10,
    string? Service = null,
    string? AreaSlug = null,
    string? ProvinceSlug = null,
    bool? IsOnline = null,
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

        // provinceSlug chỉ có nghĩa khi đi kèm areaSlug: đứng một mình nó không giới
        // hạn phạm vi nào, và im lặng bỏ qua sẽ trả về cả nước cho một truy vấn trông
        // như đã lọc theo tỉnh.
        RuleFor(x => x).Must(x => string.IsNullOrWhiteSpace(x.ProvinceSlug) || !string.IsNullOrWhiteSpace(x.AreaSlug))
            .WithMessage("provinceSlug phải đi kèm areaSlug");

        RuleFor(x => x.RadiusKm).InclusiveBetween(1, 50)
            .WithMessage("Bán kính phải trong khoảng 1 – 50km");
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.Size).InclusiveBetween(1, 50);
    }
}

/// <summary>
/// Một dịch vụ tiêu biểu hiện trên thẻ listing. Giá là <c>price_from</c> — giá khởi
/// điểm KTV công bố, không phải giá chốt.
/// </summary>
public record SearchItemServiceDto(string Name, short DurationMin, decimal PriceFrom);

/// <param name="Lat">Toạ độ đã làm tròn ~100m — đủ để đặt ghim bản đồ, không đủ để lần ra nhà KTV.</param>
/// <param name="Bio">Giới thiệu ngắn. Thẻ tự cắt bớt khi dài — cắt ở server sẽ chặn mất
/// trang hồ sơ dùng lại cùng DTO này về sau.</param>
/// <param name="VerifiedCertCount">Số chứng chỉ **đã duyệt**. Hồ sơ đang chờ xét không được
/// tính: thẻ hiển thị con số này kèm chữ "đã duyệt", nên đếm cả PENDING là nói sai với khách.</param>
/// <param name="Services">Tối đa 2 dịch vụ, giá thấp trước.</param>
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
    double Lon,
    string? Bio,
    int VerifiedCertCount,
    IReadOnlyList<SearchItemServiceDto> Services);

public record SearchResponseDto(
    IReadOnlyList<SearchItemDto> Items,
    int Page,
    int Size,
    long Total);
