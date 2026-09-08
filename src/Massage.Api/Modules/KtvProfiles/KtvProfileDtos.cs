using FluentValidation;
using Massage.Api.Modules.KtvProfiles.Entities;

namespace Massage.Api.Modules.KtvProfiles;

/// <param name="ReferralCode">
/// Mã của cộng tác viên đã mời KTV này. Tuỳ chọn — phần lớn hồ sơ tự đến qua SEO và
/// không có mã nào, nên bắt buộc sẽ chặn đúng nhóm đến miễn phí.
///
/// Có gửi thì <b>phải đúng</b>: mã không tồn tại hoặc đã ngừng hoạt động sẽ bị từ chối
/// ngay, thay vì lưu một chuỗi không ai sở hữu và chỉ vỡ ra lúc đối soát hoa hồng.
///
/// Cố ý <b>không</b> có trong <see cref="UpdateKtvProfileDto"/>: đây là dữ liệu tính
/// tiền, chốt lúc tạo. Sửa sai thì đi qua admin.
/// </param>
/// <param name="Gender">
/// <c>MALE</c> hoặc <c>FEMALE</c> — xem <see cref="Genders"/>. <b>Bắt buộc ở đường tạo.</b>
///
/// Đây là tiêu chí lọc khách dùng nhiều nhất trong ngành này, và hồ sơ không khai sẽ
/// không xuất hiện ở bất kỳ lượt lọc theo giới tính nào — để nó tuỳ chọn lúc tạo nghĩa
/// là mời KTV mới tự loại mình khỏi kết quả tìm kiếm mà không biết.
/// </param>
public record CreateKtvProfileDto(
    string FullName,
    string Gender,
    short? YearsExperience,
    double Lat,
    double Lon,
    string? BaseAddress,
    Guid? BaseWardId,
    string? BaseStreet,
    short ServiceRadiusKm,
    List<Guid>? CoverageAreaIds,
    string? ReferralCode = null);

/// <param name="Gender">
/// Sửa được, khác <c>ReferralCode</c>: đây là dữ liệu mô tả bản thân KTV chứ không phải
/// cơ sở tính tiền, và hồ sơ cũ (tạo trước 2026-09-08, cột NULL) chỉ có đúng đường này
/// để khai lần đầu.
///
/// Nullable ở đây nghĩa là "không đổi", theo đúng quy ước của mọi trường khác trong DTO
/// này — <b>không</b> phải "xoá về chưa khai". Không có đường nào đưa một hồ sơ đã khai
/// về lại NULL: giá trị đó chỉ dành cho hồ sơ chưa từng được hỏi.
/// </param>
public record UpdateKtvProfileDto(
    string? FullName,
    string? Gender,
    short? YearsExperience,
    double? Lat,
    double? Lon,
    string? BaseAddress,
    Guid? BaseWardId,
    string? BaseStreet,
    short? ServiceRadiusKm,
    List<Guid>? CoverageAreaIds);

public record CreateCertificationDto(string Name, string? IssuingOrg, DateOnly? IssuedAt);

/// <summary>
/// Chấp nhận bản cam kết KTV.
///
/// Client gửi **số phiên bản mình vừa đọc**, không gửi một cờ "đã đồng ý". Người dùng
/// có thể đang mở tab cũ trong lúc nội dung cam kết được cập nhật, và một cờ boolean sẽ
/// ghi nhận họ đồng ý với bản mới trong khi màn hình họ nhìn là bản cũ — backend từ
/// chối khi số không khớp bản đang có hiệu lực.
/// </summary>
public record AcceptCommitmentsDto(int Version);

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

/// <param name="Url">URL công khai, không ký hạn — nó nằm trong HTML của trang ISR.</param>
/// <param name="Caption">Đi vào thuộc tính <c>alt</c>. Null thì frontend dựng từ tên KTV.</param>
public record PublicKtvPhotoDto(Guid Id, string Url, string? Caption);

/// <summary>
/// Hồ sơ hiển thị cho khách và cho Googlebot.
///
/// Khác với DTO nội bộ ở ba điểm, cả ba đều có chủ ý:
/// không có <c>RejectionReason</c> (ghi chú nội bộ giữa admin và KTV),
/// chỉ chứng chỉ đã duyệt, và không có địa chỉ nhà — thay vào đó là danh sách
/// khu vực nhận phục vụ.
/// </summary>
/// <param name="Lat">Toạ độ đã làm tròn ~100m, đủ để đặt ghim bản đồ.</param>
/// <param name="AvatarUrl">Null khi KTV chưa đặt ảnh — frontend hiện ảnh thay thế, không để trống ô.</param>
/// <param name="Photos">Chỉ ảnh đã duyệt. Ảnh chờ duyệt không bao giờ ra trang công khai.</param>
/// <param name="Gender">
/// Null cho hồ sơ tạo trước 2026-09-08 chưa khai lại. Frontend phải xử lý null bằng
/// cách <b>không hiện gì</b> — đừng hiện "Chưa rõ", đó là một dòng thông tin trống chiếm
/// chỗ trên chính trang bán hàng của KTV.
/// </param>
public record PublicKtvProfileDto(
    Guid Id,
    string FullName,
    string Slug,
    string? Gender,
    short YearsExperience,
    double Lat,
    double Lon,
    short ServiceRadiusKm,
    decimal RatingAvg,
    int RatingCount,
    bool IsOnline,
    DateTimeOffset CreatedAt,
    string? AvatarUrl,
    List<PublicKtvPhotoDto> Photos,
    List<PublicCertificationDto> Certifications,
    List<PublicAreaDto> CoverageAreas,
    List<PublicKtvServiceDto> Services);

public class CreateKtvProfileDtoValidator : AbstractValidator<CreateKtvProfileDto>
{
    public CreateKtvProfileDtoValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().Length(2, 120);
        // Kiểm bằng Genders.IsValid chứ không bằng danh sách chuỗi viết lại ở đây: hai
        // bản sao sẽ trôi khỏi nhau, và bản lệch chỉ lộ ra khi CHECK ở tầng DB từ chối
        // một giá trị mà validator đã cho qua — tức lỗi 500 thay vì lỗi 400 có câu chữ.
        RuleFor(x => x.Gender).Must(Genders.IsValid)
            .WithMessage("Giới tính phải là MALE hoặc FEMALE");
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
        // `null` = không đổi (quy ước chung của DTO này), nên chỉ kiểm khi có gửi.
        RuleFor(x => x.Gender).Must(Genders.IsValid).When(x => x.Gender is not null)
            .WithMessage("Giới tính phải là MALE hoặc FEMALE");
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
