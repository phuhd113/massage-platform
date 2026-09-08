using NetTopologySuite.Geometries;

namespace Massage.Api.Modules.KtvProfiles.Entities;

/// <summary>
/// Giới tính KTV. Hai giá trị, cố ý không có "khác": trường này tồn tại để khách lọc
/// ("tôi muốn KTV nữ"), và một hồ sơ mang giá trị thứ ba sẽ không bao giờ khớp bất kỳ
/// lượt lọc nào — tức một ô chọn khiến người chọn nó biến mất khỏi kết quả tìm kiếm mà
/// không có gì báo cho họ biết.
///
/// Lưu chuỗi chứ không enum số: cột đọc được bằng mắt khi truy vấn tay, và CHECK
/// constraint ở tầng DB chặn được giá trị lạ — hai điều enum int không cho.
/// </summary>
public static class Genders
{
    public const string Male = "MALE";
    public const string Female = "FEMALE";

    public static bool IsValid(string? value) => value is Male or Female;
}

public static class VerificationStatuses
{
    public const string Pending = "PENDING";
    public const string Verified = "VERIFIED";
    public const string Rejected = "REJECTED";
}

public class KtvProfile
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    public string FullName { get; set; } = null!;

    /// <summary>Đi vào URL công khai (/ktv/{slug}-{id}) nên phải ổn định — xem SlugHelper.</summary>
    public string Slug { get; set; } = null!;

    /// <summary>
    /// Phần giới thiệu KTV tự nhập — <b>đã ngừng sử dụng</b> (2026-09-07). Không còn
    /// đường ghi (form và DTO đã gỡ) và không còn đường đọc nào ra tới khách.
    ///
    /// Vẫn giữ trong model để cột <c>bio</c> nằm trong snapshot EF: bỏ khỏi model sẽ
    /// khiến lần <c>migrations add</c> kế tiếp sinh <c>DropColumn</c>, tức xoá vĩnh viễn
    /// nội dung của những hồ sơ đã viết. Đừng nối lại vào DTO nào.
    /// </summary>
    public string? Bio { get; set; }

    /// <summary>
    /// Giới tính KTV — xem <see cref="Genders"/>. <b>Nullable, và sẽ còn nullable lâu.</b>
    ///
    /// Bắt buộc ở đường tạo hồ sơ mới, nhưng hồ sơ có từ trước 2026-09-08 để NULL và
    /// <b>không backfill</b>: suy giới tính từ tên là đoán, và đoán sai ở đây nghĩa là
    /// khách lọc "KTV nữ" gọi trúng một người nam — hỏng đúng cái nhu cầu mà trường này
    /// sinh ra để phục vụ. Hồ sơ cũ khai lại ở lần sửa kế tiếp, nơi ô này cũng bắt buộc.
    ///
    /// Hệ quả có chủ ý: <b>lọc theo giới tính ẩn hồ sơ chưa khai</b>. Đó là hành vi đúng
    /// — hồ sơ không biết giới tính thì không thể khẳng định nó khớp bộ lọc.
    /// </summary>
    public string? Gender { get; set; }

    public short YearsExperience { get; set; }

    /// <summary>SRID 4326, lưu dạng geography để tính khoảng cách theo mét trên mặt cầu.</summary>
    public Point BasePoint { get; set; } = null!;

    public string? BaseAddress { get; set; }

    /// <summary>
    /// Key ảnh đại diện trong object storage. Ảnh công khai — nó nằm trên card tìm kiếm
    /// và là ảnh lớn nhất trên trang hồ sơ, tức ứng viên LCP của đường đọc SEO.
    ///
    /// Không có trạng thái duyệt riêng như <c>KtvPhoto</c>: avatar hiện ngay để hồ sơ
    /// mới không phải chờ mới có mặt, và nó đã nằm trong tầm mắt của admin ở chính
    /// trang duyệt hồ sơ. Ảnh vi phạm gỡ bằng đường gỡ hồ sơ đã có.
    /// </summary>
    public string? AvatarKey { get; set; }

    /// <summary>
    /// Phường/xã của địa chỉ cơ sở. Lưu ở cấp mịn nhất và suy quận/tỉnh bằng hai bước
    /// join lên <c>parent_id</c>, thay vì giữ ba khoá ngoại — ba cột có thể lệch nhau
    /// mà không ràng buộc nào ở tầng DB chặn được (CHECK cần subquery), trong khi
    /// hiện không có truy vấn nào lọc theo địa chỉ cơ sở: search lọc theo
    /// <c>coverage_areas</c>, đếm KTV cũng cộng dồn từ đó.
    ///
    /// **Khác hẳn <c>CoverageAreas</c>**: đây là "tôi ở đâu", còn coverage là "tôi nhận
    /// đi những đâu". Đừng dùng cột này để lọc tìm kiếm.
    ///
    /// Nullable: hồ sơ đã có từ trước không có phường, và bắt buộc điền sẽ chặn mọi KTV
    /// hiện tại sửa hồ sơ cho tới khi khai địa chỉ.
    /// </summary>
    public Guid? BaseWardId { get; set; }

    /// <summary>Số nhà và tên đường. Chỉ dùng nội bộ, không bao giờ ra trang công khai.</summary>
    public string? BaseStreet { get; set; }
    public short ServiceRadiusKm { get; set; } = 5;

    public string VerificationStatus { get; set; } = VerificationStatuses.Pending;
    public string? RejectionReason { get; set; }
    public Guid? VerifiedBy { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }

    public decimal RatingAvg { get; set; }
    public int RatingCount { get; set; }

    /// <summary>
    /// Tỉ lệ 0–1, thành phần chiếm 0.15 trong BaseScore. Phase 1 chưa có luồng đo
    /// phản hồi thật nên giá trị còn là 0 cho mọi hồ sơ — nó nằm sẵn trong công
    /// thức để khi có dữ liệu chỉ cần backfill, không phải sửa lại xếp hạng.
    /// </summary>
    public decimal ResponseRate { get; set; }

    public int ResponseCount { get; set; }
    public int LeadCount { get; set; }

    public bool IsOnline { get; set; }
    public DateTimeOffset? LastActiveAt { get; set; }

    /// <summary>
    /// Phiên bản bản cam kết KTV đã chấp nhận (xem <c>KtvCommitments</c>). 0 nghĩa là
    /// chưa chấp nhận bản nào — hồ sơ cũ có từ trước khi có tính năng này.
    ///
    /// Lưu **số phiên bản** chứ không phải một cờ boolean: nội dung cam kết sẽ đổi theo
    /// thời gian, và "đã tick" mà không biết tick vào bản nào thì không chứng minh được
    /// gì khi có tranh chấp. So với <c>KtvCommitments.CurrentVersion</c> để biết hồ sơ
    /// có cần xác nhận lại hay không.
    /// </summary>
    public int CommitmentVersion { get; set; }

    public DateTimeOffset? CommittedAt { get; set; }

    /// <summary>
    /// IP lúc chấp nhận. Cùng với <see cref="CommittedAt"/> đây là phần "ai, khi nào,
    /// từ đâu" của bằng chứng đồng ý — thứ duy nhất còn lại nếu sau này KTV phủ nhận.
    /// Nullable vì hồ sơ chưa cam kết thì không có gì để ghi.
    /// </summary>
    public string? CommittedIp { get; set; }

    /// <summary>
    /// Cộng tác viên đã giới thiệu KTV này, null khi hồ sơ tự đến (SEO là nguồn chính,
    /// nên đa số hồ sơ sẽ null — xem <c>Collaborator</c>).
    ///
    /// Lưu **khoá ngoại tới CTV**, không lưu chuỗi mã: mã là thứ đổi được (CTV đổi tên
    /// mã, hoặc sửa vì gõ nhầm), còn "ai mang người này về" thì không đổi. Lưu chuỗi
    /// thì mọi hồ sơ cũ trỏ tới một mã đã đổi sẽ mất dấu, đúng vào lúc đối soát hoa hồng.
    ///
    /// <b>Chốt lúc tạo hồ sơ, đường sửa hồ sơ không đụng tới.</b> Đây là dữ liệu tính
    /// tiền: để KTV tự đổi bất cứ lúc nào là mở đường cho một CTV đổi mã của mình vào
    /// hồ sơ người khác mang về. Sửa sai thì đi qua admin.
    /// </summary>
    public Guid? ReferredByCollaboratorId { get; set; }

    /// <summary>
    /// Thời điểm ghi nhận giới thiệu. Tách khỏi <see cref="CreatedAt"/> vì admin có thể
    /// gắn mã sau khi có khiếu nại "tôi mời người này nhưng họ quên điền mã", và lúc đó
    /// mốc giới thiệu khác hẳn mốc tạo hồ sơ.
    /// </summary>
    public DateTimeOffset? ReferredAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<Certification> Certifications { get; set; } = [];
    public List<KtvPhoto> Photos { get; set; } = [];

    /// <summary>
    /// CCCD — một hàng mỗi hồ sơ, null khi KTV chưa gửi. Không phải danh sách như
    /// <see cref="Certifications"/>: xem <see cref="IdentityDocument"/>.
    /// </summary>
    public IdentityDocument? IdentityDocument { get; set; }
    public List<CoverageArea> CoverageAreas { get; set; } = [];
}
