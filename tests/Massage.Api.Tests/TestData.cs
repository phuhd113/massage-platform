using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.ServiceCatalog.Entities;
using NetTopologySuite.Geometries;

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

    public static string UniquePhone() =>
        $"09{Random.Shared.Next(10, 99)}{Interlocked.Increment(ref _counter):D6}"[..10];

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
        AppDbContext db, Guid ktvId, Guid serviceId, CancellationToken ct = default)
    {
        db.KtvServices.Add(new KtvService
        {
            KtvId = ktvId,
            ServiceId = serviceId,
            PriceFrom = 300_000m,
            DurationMin = 60,
        });
        await db.SaveChangesAsync(ct);
    }

    public static async Task<AdministrativeArea> CreateAreaAsync(
        AppDbContext db, string level, Guid? parentId = null, CancellationToken ct = default)
    {
        var suffix = Guid.NewGuid().ToString("N")[..12];
        var area = new AdministrativeArea
        {
            Name = $"Khu vực {suffix}",
            Slug = $"khu-vuc-{suffix}",
            Level = level,
            ParentId = parentId,
        };
        db.AdministrativeAreas.Add(area);
        await db.SaveChangesAsync(ct);
        return area;
    }

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
