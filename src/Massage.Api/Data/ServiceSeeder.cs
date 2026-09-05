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
/// im lặng đi thẳng ra production. Bản tiếng Anh cũng vậy, cho /en/dich-vu/{slug}.
///
/// Idempotent theo hai chiều: hàng chưa có thì thêm, hàng đã có mà thiếu bản dịch
/// thì bổ sung. Chiều thứ hai là bắt buộc — mọi môi trường đã seed trước khi có
/// cột EN sẽ không bao giờ nhận được bản dịch nếu seeder chỉ biết thêm mới.
/// </summary>
public static class ServiceSeeder
{
    private static readonly (string Name, string Description, string NameEn, string DescriptionEn)[] Data =
    [
        ("Massage trị liệu",
            "Kỹ thuật tác động sâu vào nhóm cơ bị co cứng, phù hợp với người đau mỏi kéo dài do ngồi lâu hoặc vận động sai tư thế.",
            "Therapeutic massage",
            "Deep work on tight muscle groups, suited to people with lasting aches from long hours seated or from poor movement habits."),
        ("Massage cổ vai gáy",
            "Tập trung vào vùng cổ, vai và gáy — nhóm cơ chịu tải nhiều nhất ở người làm việc với máy tính.",
            "Neck and shoulder massage",
            "Focused on the neck, shoulders and upper back — the muscles that carry the most load for people who work at a computer."),
        ("Bấm huyệt",
            "Tác động lên hệ thống huyệt đạo theo y học cổ truyền nhằm giảm đau và cải thiện tuần hoàn.",
            "Acupressure",
            "Pressure applied to points along traditional-medicine meridians to ease pain and improve circulation."),
        ("Massage Thái",
            "Kết hợp kéo giãn và ấn huyệt theo trường phái Thái, thực hiện trên nệm và không dùng dầu.",
            "Thai massage",
            "Assisted stretching combined with pressure-point work in the Thai tradition, done on a mat without oil."),
        ("Massage body",
            "Massage toàn thân với tinh dầu, thiên về thư giãn và phục hồi sau ngày làm việc dài.",
            "Full-body oil massage",
            "Full-body massage with essential oils, geared towards relaxation and recovery after a long day."),
        ("Massage chân",
            "Xoa bóp bàn chân và cẳng chân, phù hợp với người đứng nhiều hoặc hay bị phù chân.",
            "Foot and leg massage",
            "Massage of the feet and lower legs, suited to people who stand for long periods or get swollen legs."),
        ("Massage bà bầu",
            "Kỹ thuật nhẹ nhàng dành cho thai phụ, cần KTV có chứng chỉ chuyên biệt cho nhóm khách này.",
            "Prenatal massage",
            "Gentle technique for expectant mothers; requires a therapist certified specifically for prenatal work."),
        ("Trị liệu cột sống",
            "Nắn chỉnh và thư giãn cơ dọc cột sống, dành cho người có biểu hiện đau lưng mạn tính.",
            "Spinal therapy",
            "Alignment work and muscle release along the spine, for people with signs of chronic back pain."),
        ("Giác hơi",
            "Dùng lực hút của cốc để tăng lưu thông máu tại chỗ, thường kết hợp cùng massage trị liệu.",
            "Cupping",
            "Suction cups used to increase local blood flow, usually combined with therapeutic massage."),
        ("Xông hơi thảo dược",
            "Xông hơi với thảo dược tại nhà, thường đi kèm gói massage để tăng hiệu quả thư giãn.",
            "Herbal steam therapy",
            "Herbal steam treatment at home, usually paired with a massage session to deepen the relaxation."),
    ];

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        short order = 0;
        var added = 0;
        var filled = 0;

        foreach (var (name, description, nameEn, descriptionEn) in Data)
        {
            order++;
            var slug = SlugHelper.ToSlug(name);
            var existing = await db.Services.FirstOrDefaultAsync(s => s.Slug == slug, ct);

            if (existing is not null)
            {
                // Hàng đã có thì vẫn phải nạp bản dịch còn thiếu. Bỏ qua thẳng như
                // trước là để cột EN vĩnh viễn NULL trên mọi môi trường đã seed —
                // seeder báo "thêm mới 0/10" và trông y hệt một lượt chạy thành công.
                if (existing.NameEn is null) { existing.NameEn = nameEn; filled++; }
                existing.DescriptionEn ??= descriptionEn;
                continue;
            }

            db.Services.Add(new Service
            {
                Name = name,
                Slug = slug,
                Description = description,
                NameEn = nameEn,
                DescriptionEn = descriptionEn,
                SortOrder = order,
            });
            added++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Đã seed danh mục dịch vụ: thêm mới {Added}/{Total}, bổ sung bản dịch EN {Filled}",
            added, Data.Length, filled);
    }
}
