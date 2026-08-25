using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Data;

/// <summary>
/// Seed danh mục tỉnh/quận. Viết idempotent (khớp theo slug+level) để chạy lại
/// nhiều lần không nhân bản dữ liệu — seeder sẽ còn được gọi lại mỗi khi bổ sung
/// khu vực mới ở các phase sau.
/// </summary>
public static class AreaSeeder
{
    private static readonly (string Province, string[] Districts)[] Data =
    [
        ("TP. Hồ Chí Minh", [
            "Quận 1", "Quận 3", "Quận 4", "Quận 5", "Quận 7", "Quận 10",
            "Quận Bình Thạnh", "Quận Phú Nhuận", "Quận Gò Vấp", "Quận Tân Bình", "TP. Thủ Đức",
        ]),
        ("Hà Nội", [
            "Quận Ba Đình", "Quận Hoàn Kiếm", "Quận Hai Bà Trưng", "Quận Đống Đa",
            "Quận Cầu Giấy", "Quận Thanh Xuân", "Quận Hoàng Mai", "Quận Long Biên",
            "Quận Nam Từ Liêm", "Quận Hà Đông",
        ]),
    ];

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        foreach (var (provinceName, districts) in Data)
        {
            var province = await UpsertAsync(db, provinceName, AreaLevels.Province, null, ct);

            foreach (var districtName in districts)
                await UpsertAsync(db, districtName, AreaLevels.District, province.Id, ct);

            logger.LogInformation("Đã seed {Province}: {Count} quận/huyện", provinceName, districts.Length);
        }
    }

    private static async Task<AdministrativeArea> UpsertAsync(
        AppDbContext db, string name, string level, Guid? parentId, CancellationToken ct)
    {
        var slug = SlugHelper.ToSlug(name);
        var existing = await db.AdministrativeAreas
            .FirstOrDefaultAsync(a => a.Slug == slug && a.Level == level, ct);

        if (existing is not null) return existing;

        var area = new AdministrativeArea { Name = name, Slug = slug, Level = level, ParentId = parentId };
        db.AdministrativeAreas.Add(area);
        await db.SaveChangesAsync(ct);
        return area;
    }
}
