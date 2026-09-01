using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.ServiceCatalog.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Data;

/// <summary>
/// Seed danh mục dịch vụ. Idempotent theo slug giống <see cref="AreaSeeder"/> vì
/// seeder sẽ còn được chạy lại mỗi khi bổ sung dịch vụ mới.
///
/// Mô tả từng dịch vụ được viết sẵn ở đây thay vì để trống: trang /dich-vu/{slug}
/// cần nội dung riêng để không bị Google xếp vào thin content, và mô tả trống sẽ
/// im lặng đi thẳng ra production.
/// </summary>
public static class ServiceSeeder
{
    private static readonly (string Name, string Description)[] Data =
    [
        ("Massage trị liệu",
            "Kỹ thuật tác động sâu vào nhóm cơ bị co cứng, phù hợp với người đau mỏi kéo dài do ngồi lâu hoặc vận động sai tư thế."),
        ("Massage cổ vai gáy",
            "Tập trung vào vùng cổ, vai và gáy — nhóm cơ chịu tải nhiều nhất ở người làm việc với máy tính."),
        ("Bấm huyệt",
            "Tác động lên hệ thống huyệt đạo theo y học cổ truyền nhằm giảm đau và cải thiện tuần hoàn."),
        ("Massage Thái",
            "Kết hợp kéo giãn và ấn huyệt theo trường phái Thái, thực hiện trên nệm và không dùng dầu."),
        ("Massage body",
            "Massage toàn thân với tinh dầu, thiên về thư giãn và phục hồi sau ngày làm việc dài."),
        ("Massage chân",
            "Xoa bóp bàn chân và cẳng chân, phù hợp với người đứng nhiều hoặc hay bị phù chân."),
        ("Massage bà bầu",
            "Kỹ thuật nhẹ nhàng dành cho thai phụ, cần KTV có chứng chỉ chuyên biệt cho nhóm khách này."),
        ("Trị liệu cột sống",
            "Nắn chỉnh và thư giãn cơ dọc cột sống, dành cho người có biểu hiện đau lưng mạn tính."),
        ("Giác hơi",
            "Dùng lực hút của cốc để tăng lưu thông máu tại chỗ, thường kết hợp cùng massage trị liệu."),
        ("Xông hơi thảo dược",
            "Xông hơi với thảo dược tại nhà, thường đi kèm gói massage để tăng hiệu quả thư giãn."),
    ];

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        short order = 0;
        var added = 0;

        foreach (var (name, description) in Data)
        {
            order++;
            var slug = SlugHelper.ToSlug(name);
            if (await db.Services.AnyAsync(s => s.Slug == slug, ct)) continue;

            db.Services.Add(new Service
            {
                Name = name,
                Slug = slug,
                Description = description,
                SortOrder = order,
            });
            added++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Đã seed danh mục dịch vụ: thêm mới {Added}/{Total}", added, Data.Length);
    }
}
