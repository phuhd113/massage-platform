using NetTopologySuite.Geometries;

namespace Massage.Api.Modules.KtvProfiles.Entities;

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

    public string? Bio { get; set; }
    public short YearsExperience { get; set; }

    /// <summary>SRID 4326, lưu dạng geography để tính khoảng cách theo mét trên mặt cầu.</summary>
    public Point BasePoint { get; set; } = null!;

    public string? BaseAddress { get; set; }

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

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public List<Certification> Certifications { get; set; } = [];
    public List<CoverageArea> CoverageAreas { get; set; } = [];
}
