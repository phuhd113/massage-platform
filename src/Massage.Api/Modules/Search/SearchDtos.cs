using FluentValidation;
using Massage.Api.Modules.KtvProfiles.Entities;

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
/// <param name="Gender">
/// <c>MALE</c> / <c>FEMALE</c>, bỏ trống = không lọc.
///
/// <b>Hồ sơ chưa khai giới tính (cột NULL) bị loại khi bộ lọc này bật.</b> Đó là hành vi
/// đúng chứ không phải thiếu sót: không biết giới tính thì không khẳng định được là khớp,
/// và với chính bộ lọc này thì đoán sai tệ hơn hẳn việc vắng mặt.
/// </param>
/// <param name="MinYearsExperience">
/// Số năm kinh nghiệm tối thiểu. Chỉ có cận dưới, cố ý không có cận trên: "KTV nhiều kinh
/// nghiệm nhất có thể" là nhu cầu thật, còn "KTV dưới 5 năm kinh nghiệm" thì không.
/// </param>
/// <param name="MinRating">
/// Điểm đánh giá tối thiểu, so với <c>rating_avg</c> thô chứ <b>không</b> với điểm đã làm
/// mượt Bayesian dùng để xếp hạng. Hai con số khác nhau và khách chỉ nhìn thấy con số thô
/// trên thẻ — lọc theo con số họ không thấy sẽ cho ra một danh sách mà chính bộ lọc trông
/// như đang sai.
///
/// Hồ sơ chưa có đánh giá nào (<c>rating_count = 0</c>) bị loại: <c>rating_avg</c> của
/// chúng là 0, nên để lọt qua thì phải coi "chưa ai chấm" là "đạt ngưỡng".
/// </param>
public record SearchQueryDto(
    double? Lat = null,
    double? Lon = null,
    int RadiusKm = 10,
    string? Service = null,
    string? AreaSlug = null,
    string? ProvinceSlug = null,
    bool? IsOnline = null,
    string? Gender = null,
    short? MinYearsExperience = null,
    decimal? MinRating = null,
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

        // Từ chối giá trị lạ thay vì im lặng bỏ qua bộ lọc: một `?gender=nu` viết sai
        // sẽ trả về cả nam lẫn nữ trong khi giao diện vẫn hiện là đang lọc.
        RuleFor(x => x.Gender).Must(Genders.IsValid).When(x => x.Gender is not null)
            .WithMessage("Giới tính phải là MALE hoặc FEMALE");

        RuleFor(x => x.MinYearsExperience).InclusiveBetween((short)0, (short)60)
            .When(x => x.MinYearsExperience.HasValue);
        RuleFor(x => x.MinRating).InclusiveBetween(0m, 5m).When(x => x.MinRating.HasValue);
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
/// <param name="AvatarUrl">Null khi KTV chưa đặt ảnh — thẻ hiện ảnh thay thế, không để trống ô.</param>
/// <param name="VerifiedCertCount">Số chứng chỉ **đã duyệt**. Hồ sơ đang chờ xét không được
/// tính: thẻ hiển thị con số này kèm chữ "đã duyệt", nên đếm cả PENDING là nói sai với khách.</param>
/// <param name="Services">Tối đa 2 dịch vụ, giá thấp trước.</param>
/// <param name="Gender">Null cho hồ sơ chưa khai — thẻ không hiện gì, không hiện "Chưa rõ".</param>
public record SearchItemDto(
    Guid Id,
    string FullName,
    string Slug,
    string? Gender,
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
    string? AvatarUrl,
    int VerifiedCertCount,
    IReadOnlyList<SearchItemServiceDto> Services);

public record SearchResponseDto(
    IReadOnlyList<SearchItemDto> Items,
    int Page,
    int Size,
    long Total);
