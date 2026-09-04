using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.ServiceCatalog.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Npgsql;
using NpgsqlTypes;

namespace Massage.Api.Tests;

/// <summary>
/// Tạo dữ liệu cho test tích hợp.
///
/// Fixture dùng chung một database cho cả collection nên mỗi test tự sinh dữ liệu
/// riêng (số điện thoại, slug ngẫu nhiên) thay vì dọn bảng — trừ trường hợp test
/// phụ thuộc vào một đại lượng toàn cục, xem <c>SearchRankingTests</c>.
/// </summary>
public static class TestData
{
    private static int _counter;

    /// <summary>
    /// Mốc bắt đầu ngẫu nhiên cho mỗi lần chạy, để hai lần chạy nối tiếp nhau trên
    /// cùng một database không đụng số của nhau.
    /// </summary>
    private static readonly int PhoneSeed = Random.Shared.Next(0, 90_000_000);

    /// <summary>
    /// Số điện thoại duy nhất trong cả process.
    ///
    /// <b>Nguồn duy nhất</b> — mọi test dùng chung hàm này. Trước đây tầng HTTP có
    /// bộ sinh riêng với cùng định dạng và cũng đếm từ 0, nên hai bộ đụng nhau và
    /// làm đỏ một test ngẫu nhiên nào đó với lỗi trùng khoá users.phone: triệu
    /// chứng hiện ra ở test rate limit trong khi nguyên nhân nằm ở chỗ khác hẳn.
    ///
    /// Khớp <c>^(0|\+84)(3|5|7|8|9)\d{8}$</c>: "09" cộng 8 chữ số.
    /// </summary>
    public static string UniquePhone() =>
        $"09{(PhoneSeed + Interlocked.Increment(ref _counter)) % 100_000_000:D8}";

    public static async Task<User> CreateUserAsync(
        AppDbContext db, string role = UserRoles.Ktv, CancellationToken ct = default)
    {
        var user = new User
        {
            Phone = UniquePhone(),
            Role = role,
            PhoneVerifiedAt = DateTimeOffset.UtcNow,
        };
        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return user;
    }

    /// <param name="lat">Vĩ độ; test geo nên dùng gốc toạ độ ngẫu nhiên cách xa nhau để không lẫn dữ liệu của nhau.</param>
    /// <param name="serviceRadiusKm">Bán kính KTV nhận đi — vế thứ hai của luật khớp hai bán kính.</param>
    public static async Task<KtvProfile> CreateKtvAsync(
        AppDbContext db,
        double lat,
        double lon,
        short serviceRadiusKm = 50,
        string status = VerificationStatuses.Verified,
        decimal ratingAvg = 0m,
        int ratingCount = 0,
        bool isOnline = false,
        CancellationToken ct = default)
    {
        var user = await CreateUserAsync(db, ct: ct);
        var suffix = Guid.NewGuid().ToString("N")[..12];

        var profile = new KtvProfile
        {
            UserId = user.Id,
            FullName = $"KTV Test {suffix}",
            Slug = $"ktv-test-{suffix}",
            YearsExperience = 3,
            BasePoint = new Point(lon, lat) { SRID = 4326 },
            ServiceRadiusKm = serviceRadiusKm,
            VerificationStatus = status,
            RatingAvg = ratingAvg,
            RatingCount = ratingCount,
            IsOnline = isOnline,
        };

        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync(ct);
        return profile;
    }

    public static async Task<Service> CreateServiceAsync(AppDbContext db, CancellationToken ct = default)
    {
        var suffix = Guid.NewGuid().ToString("N")[..12];
        var service = new Service { Name = $"Dịch vụ {suffix}", Slug = $"dich-vu-{suffix}" };
        db.Services.Add(service);
        await db.SaveChangesAsync(ct);
        return service;
    }

    public static async Task LinkServiceAsync(
        AppDbContext db,
        Guid ktvId,
        Guid serviceId,
        decimal priceFrom = 300_000m,
        short durationMin = 60,
        CancellationToken ct = default)
    {
        db.KtvServices.Add(new KtvService
        {
            KtvId = ktvId,
            ServiceId = serviceId,
            PriceFrom = priceFrom,
            DurationMin = durationMin,
        });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Thêm một chứng chỉ. Mặc định là ĐÃ DUYỆT vì phần lớn test quan tâm tới hồ sơ
    /// hoàn chỉnh; truyền <c>VerificationStatuses.Pending</c> khi cần kiểm tra rằng
    /// chứng chỉ chờ duyệt không được đếm.
    /// </summary>
    public static async Task<Certification> AddCertificationAsync(
        AppDbContext db,
        Guid ktvId,
        string? status = null,
        CancellationToken ct = default)
    {
        var cert = new Certification
        {
            KtvId = ktvId,
            Name = $"Chứng chỉ {Guid.NewGuid().ToString("N")[..8]}",
            FileUrl = $"https://example.test/{Guid.NewGuid():N}.pdf",
            VerifyStatus = status ?? VerificationStatuses.Verified,
        };
        db.Certifications.Add(cert);
        await db.SaveChangesAsync(ct);
        return cert;
    }

    /// <summary>
    /// Tạo một khu vực. Slug ngẫu nhiên theo mặc định để test chạy song song không
    /// đụng nhau — truyền <paramref name="slug"/> khi chính cái slug là thứ đang được
    /// kiểm (ví dụ hai tỉnh cùng chứa "huyen-chau-thanh").
    ///
    /// Quận/huyện **luôn có tỉnh cha**: từ khi slug chỉ duy nhất trong phạm vi cha,
    /// tra quận đòi cặp (tỉnh, quận), nên một quận mồ côi không tra ra được bằng
    /// đường mà production dùng. Truyền <paramref name="parentId"/> để gắn vào tỉnh
    /// có sẵn; bỏ trống thì tự dựng một tỉnh mới.
    ///
    /// <paramref name="name"/> chỉ cần truyền khi chính cái tên là thứ đang kiểm (ô gợi ý
    /// khớp theo tên, không theo slug) — tên mặc định là ngẫu nhiên để test song song
    /// không thấy nhau.
    /// </summary>
    public static async Task<AdministrativeArea> CreateAreaAsync(
        AppDbContext db,
        string level,
        Guid? parentId = null,
        string? slug = null,
        string? code = null,
        string? name = null,
        CancellationToken ct = default)
    {
        if (level != AreaLevels.Province && parentId is null)
        {
            var parentLevel = level == AreaLevels.Ward ? AreaLevels.District : AreaLevels.Province;
            var parent = await CreateAreaAsync(db, parentLevel, ct: ct);
            parentId = parent.Id;
        }

        var suffix = Guid.NewGuid().ToString("N")[..12];
        var area = new AdministrativeArea
        {
            Name = name ?? $"Khu vực {suffix}",
            Slug = slug ?? $"khu-vuc-{suffix}",
            Level = level,
            ParentId = parentId,
            Code = code,
        };
        db.AdministrativeAreas.Add(area);
        await db.SaveChangesAsync(ct);
        return area;
    }

    /// <summary>
    /// Slug tỉnh chứa khu vực này — thứ mà <c>SearchQueryDto.ProvinceSlug</c> cần khi
    /// tìm theo quận.
    /// </summary>
    public static async Task<string> ProvinceSlugOfAsync(
        AppDbContext db, Guid areaId, CancellationToken ct = default) =>
        await db.AdministrativeAreas
            .Where(a => a.Id == areaId)
            .Select(a => a.Parent!.Slug)
            .FirstAsync(ct);

    /// <summary>
    /// Gắn nội dung biên tập cho một khu vực. Cờ indexable đòi cả đủ KTV lẫn có nội
    /// dung riêng, nên test nào kiểm ngưỡng số KTV đều phải set trường này trước.
    /// </summary>
    public static async Task SetEditorialNoteAsync(
        AppDbContext db, Guid areaId, string note, CancellationToken ct = default) =>
        await db.AdministrativeAreas.Where(a => a.Id == areaId)
            .ExecuteUpdateAsync(u => u.SetProperty(a => a.EditorialNote, note), ct);

    /// <summary>
    /// Đặt toạ độ tâm cho một khu vực — thứ mà <c>AreaService.ResolveAsync</c> dò ngược
    /// từ vị trí GPS của khách. Dữ liệu thật do <c>seed-areas</c> nạp; test tự đặt để
    /// không phụ thuộc vào việc DB test đã seed toàn quốc hay chưa.
    /// </summary>
    public static async Task SetCentroidAsync(
        AppDbContext db, Guid areaId, double lat, double lon, CancellationToken ct = default) =>
        await db.Database.ExecuteSqlRawAsync(
            """
            UPDATE administrative_areas
               SET centroid = ST_SetSRID(ST_MakePoint(@lon, @lat), 4326)::geography
             WHERE id = @id
            """,
            [
                new NpgsqlParameter("lon", NpgsqlDbType.Double) { Value = lon },
                new NpgsqlParameter("lat", NpgsqlDbType.Double) { Value = lat },
                new NpgsqlParameter("id", NpgsqlDbType.Uuid) { Value = areaId },
            ],
            ct);

    public static async Task CoverAsync(
        AppDbContext db, Guid ktvId, Guid areaId, CancellationToken ct = default)
    {
        db.CoverageAreas.Add(new CoverageArea { KtvId = ktvId, AreaId = areaId });
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Một gốc toạ độ ngẫu nhiên trên biển, cách xa mọi gốc khác. Test geo dùng nó
    /// để dữ liệu của test này không lọt vào bán kính tìm kiếm của test khác — rẻ
    /// hơn và an toàn hơn nhiều so với dọn bảng giữa các test.
    /// </summary>
    public static (double Lat, double Lon) RandomOrigin() =>
        (Random.Shared.Next(-60, 60) + Random.Shared.NextDouble(),
         Random.Shared.Next(-170, 170) + Random.Shared.NextDouble());

    /// <summary>
    /// Dịch một điểm về phía bắc <paramref name="km"/> kilômét. Dùng vĩ độ để dịch
    /// vì 1 độ vĩ ≈ 111.32km ở mọi kinh độ, còn 1 độ kinh thì co lại theo vĩ độ.
    /// </summary>
    public static double LatOffsetKm(double lat, double km) => lat + km / 111.32;
}
