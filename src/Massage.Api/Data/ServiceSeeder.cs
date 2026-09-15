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
///
/// Mô tả (VI+EN) được **ghi đè**, không chỉ điền khi trống — cùng lý do với
/// `SortOrder` bên dưới: đây là nội dung biên tập, `Data` là nguồn sự thật duy
/// nhất, không ai chỉnh nó bằng tay ở DB. Bản mở rộng 2026-09-15 thay bản một
/// câu ban đầu; giữ `??=` ở đây sẽ khiến mọi môi trường đã seed trước đó không
/// bao giờ nhận được nội dung mới — đúng lỗ mà lịch sử `NameEn`/`DescriptionEn`
/// từng dạy: seeder báo "thêm mới 0" và trông y hệt một lượt chạy thành công.
/// </summary>
public static class ServiceSeeder
{
    private static readonly (string Name, string Description, string NameEn, string DescriptionEn)[] Data =
    [
        ("Massage trị liệu",
            "Kỹ thuật tác động sâu vào nhóm cơ bị co cứng, dùng lực ổn định theo từng lớp cơ thay vì "
            + "xoa bóp bề mặt. Phù hợp với người đau mỏi kéo dài do ngồi lâu, mang vác nặng hoặc vận "
            + "động sai tư thế trong thời gian dài.\n\n"
            + "KTV đánh giá vùng cơ co cứng trước khi bắt đầu và điều chỉnh lực theo phản hồi của khách "
            + "ngay trong buổi, không áp dụng một mức lực cố định cho mọi người. Thường được chọn khi "
            + "cơn đau đã kéo dài vài ngày trở lên, khác với massage thư giãn thông thường.",
            "Therapeutic massage",
            "Deep, targeted work on tight muscle groups, applying steady pressure layer by layer rather "
            + "than surface strokes. Suited to people with lasting aches from long hours seated, heavy "
            + "lifting, or prolonged poor posture.\n\n"
            + "The therapist checks which muscle groups are tense before starting and adjusts pressure "
            + "based on your feedback during the session, rather than using one fixed intensity for "
            + "everyone. Usually the right choice when pain has lasted several days or more, as opposed "
            + "to a simple relaxation massage."),
        ("Massage cổ vai gáy",
            "Tập trung vào vùng cổ, vai và gáy — nhóm cơ chịu tải nhiều nhất ở người làm việc với máy "
            + "tính hoặc cúi đầu nhìn điện thoại trong thời gian dài. Đây là khu vực dễ co cứng nhất "
            + "nhưng cũng nhạy cảm nhất, nên kỹ thuật đi chậm và có kiểm soát hơn massage toàn thân.\n\n"
            + "Phù hợp với dân văn phòng, người làm việc máy tính cả ngày, hoặc bất kỳ ai thường xuyên "
            + "thấy nặng gáy, mỏi vai vào cuối ngày. Không cần cởi bỏ toàn bộ trang phục — khách có thể "
            + "ngồi hoặc nằm tuỳ tư thế thoải mái nhất.",
            "Neck and shoulder massage",
            "Focused on the neck, shoulders and upper back — the muscles that carry the most load for "
            + "people who work at a computer or look down at a phone for long stretches. This area tends "
            + "to tighten up the fastest but is also the most sensitive, so the technique is slower and "
            + "more controlled than a full-body session.\n\n"
            + "A good fit for office workers, anyone at a desk all day, or people who regularly feel a "
            + "heavy neck and stiff shoulders by the end of the day. No need to undress fully — you can "
            + "sit or lie down, whichever is more comfortable."),
        ("Bấm huyệt",
            "Tác động lên hệ thống huyệt đạo theo y học cổ truyền, dùng ngón tay hoặc khuỷu tay ấn vào "
            + "từng điểm cụ thể trên cơ thể nhằm giảm đau và cải thiện tuần hoàn. Khác với massage thông "
            + "thường ở chỗ lực tập trung vào điểm thay vì xoa trải rộng.\n\n"
            + "Thường được kết hợp trong cùng buổi với massage trị liệu để tăng hiệu quả giảm đau, hoặc "
            + "dùng riêng cho người không quen với lực tay mạnh trên diện rộng.",
            "Acupressure",
            "Pressure applied to specific points along traditional-medicine meridians, using fingers or "
            + "elbows to ease pain and improve circulation. Unlike general massage, the pressure is "
            + "concentrated on individual points rather than spread across an area.\n\n"
            + "Often combined with therapeutic massage in the same session for stronger pain relief, or "
            + "used on its own by people who prefer point-focused pressure over broad, firm strokes."),
        ("Massage Thái",
            "Kết hợp kéo giãn và ấn huyệt theo trường phái Thái, thực hiện trên nệm trải sàn và không "
            + "dùng dầu. KTV dùng cả tay, khuỷu tay, đầu gối và đôi khi cả trọng lượng cơ thể để kéo "
            + "giãn khớp và nhóm cơ lớn.\n\n"
            + "Khách mặc trang phục thoải mái, rộng rãi trong suốt buổi massage thay vì cởi đồ như "
            + "massage dầu. Phù hợp với người cứng khớp, ít vận động, hoặc muốn một buổi tác động mạnh "
            + "hơn xoa bóp thông thường.",
            "Thai massage",
            "Assisted stretching combined with pressure-point work in the Thai tradition, performed on a "
            + "floor mat without oil. The therapist uses hands, elbows, knees and sometimes body weight "
            + "to stretch joints and larger muscle groups.\n\n"
            + "You stay in loose, comfortable clothing throughout rather than undressing as with an oil "
            + "massage. A good option if you're stiff, sit a lot, or want something more physically "
            + "active than a standard rubdown."),
        ("Massage body",
            "Massage toàn thân với tinh dầu, thiên về thư giãn và phục hồi sau một ngày làm việc dài. "
            + "Kỹ thuật dùng các đường vuốt dài, đều tay trên toàn bộ lưng, vai, tay và chân thay vì "
            + "tập trung vào một điểm cụ thể.\n\n"
            + "Đây là lựa chọn phổ biến nhất khi không có vùng đau rõ ràng mà chỉ cần thư giãn tổng "
            + "thể. Khách được phủ khăn kín các vùng không massage trong suốt buổi, chỉ hở phần đang "
            + "được xử lý.",
            "Full-body oil massage",
            "Full-body massage with essential oils, geared towards relaxation and recovery after a long "
            + "day. The technique uses long, even strokes across the back, shoulders, arms and legs "
            + "rather than focusing on one specific spot.\n\n"
            + "This is the most common choice when there's no specific pain point, just a need to "
            + "unwind. You stay covered with a towel over any area not currently being worked on, "
            + "throughout the session."),
        ("Massage chân",
            "Xoa bóp bàn chân và cẳng chân, phù hợp với người đứng nhiều hoặc hay bị phù chân vào cuối "
            + "ngày. KTV tác động vào lòng bàn chân, gót, mắt cá và bắp chân — những vùng ít được chú ý "
            + "trong massage toàn thân.\n\n"
            + "Thời lượng ngắn hơn massage toàn thân nên phù hợp làm dịch vụ bổ sung sau một buổi làm "
            + "việc, hoặc chọn riêng khi chỉ có ít thời gian.",
            "Foot and leg massage",
            "Massage of the feet and lower legs, suited to people who stand for long periods or get "
            + "swollen legs by the end of the day. The therapist works the sole, heel, ankle and calf — "
            + "areas that get little attention in a full-body session.\n\n"
            + "It runs shorter than a full-body massage, which makes it a good add-on after a workday or "
            + "a solid option when you only have a short window of time."),
        ("Massage bà bầu",
            "Kỹ thuật nhẹ nhàng dành riêng cho thai phụ, dùng lực nhẹ hơn hẳn massage thông thường và "
            + "tránh hoàn toàn vùng bụng cùng một số điểm huyệt bị chống chỉ định trong thai kỳ. Tư thế "
            + "nằm nghiêng, có gối đỡ, thay vì nằm sấp như massage tiêu chuẩn.\n\n"
            + "Bắt buộc chọn KTV có chứng chỉ chuyên biệt cho massage bà bầu — đây là yêu cầu an toàn, "
            + "không phải tuỳ chọn nâng cao. Nên tham khảo ý kiến bác sĩ nếu thai kỳ có biến chứng trước "
            + "khi đặt lịch.",
            "Prenatal massage",
            "A gentle technique designed specifically for expectant mothers, using noticeably lighter "
            + "pressure than a standard massage and avoiding the abdomen entirely along with certain "
            + "pressure points considered unsafe during pregnancy. You lie on your side with supporting "
            + "cushions rather than face-down as in a standard session.\n\n"
            + "Only book a therapist certified specifically for prenatal massage — this is a safety "
            + "requirement, not an optional upgrade. If your pregnancy has any complications, check with "
            + "your doctor before booking."),
        ("Trị liệu cột sống",
            "Nắn chỉnh và thư giãn cơ dọc hai bên cột sống, dành cho người có biểu hiện đau lưng mạn "
            + "tính hoặc ngồi sai tư thế trong thời gian dài. Kỹ thuật tập trung vào nhóm cơ nâng đỡ "
            + "cột sống thay vì toàn bộ lưng.\n\n"
            + "Đây không phải dịch vụ y tế và không thay thế chẩn đoán hoặc điều trị của bác sĩ chuyên "
            + "khoa. Nếu cơn đau lưng đi kèm tê chân, mất cảm giác hoặc mới xảy ra sau chấn thương, nên "
            + "khám bác sĩ trước khi đặt lịch massage.",
            "Spinal therapy",
            "Alignment work and muscle release along both sides of the spine, for people with signs of "
            + "chronic back pain or long stretches of poor sitting posture. The technique focuses on the "
            + "muscles that support the spine rather than the whole back.\n\n"
            + "This is not a medical service and does not replace diagnosis or treatment from a "
            + "specialist. If back pain comes with numbness, loss of sensation, or started after a "
            + "recent injury, see a doctor before booking a massage."),
        ("Giác hơi",
            "Dùng lực hút của cốc chuyên dụng đặt lên da để tăng lưu thông máu tại chỗ, thường để lại "
            + "vết tròn tạm thời trên da trong vài ngày — đây là phản ứng bình thường, không phải tổn "
            + "thương. Thường kết hợp cùng massage trị liệu trong cùng buổi để tăng hiệu quả giảm đau "
            + "mỏi cơ.\n\n"
            + "Không phù hợp với người có vấn đề về đông máu, da dễ tổn thương hoặc đang mang thai — nên "
            + "trao đổi với KTV trước khi bắt đầu nếu thuộc nhóm này.",
            "Cupping",
            "Suction cups placed on the skin to increase local blood flow, typically leaving temporary "
            + "round marks that fade over a few days — this is a normal reaction, not an injury. Usually "
            + "combined with therapeutic massage in the same session for stronger relief from sore, "
            + "tight muscles.\n\n"
            + "Not suitable for people with blood-clotting conditions, fragile skin, or who are pregnant "
            + "— mention this to your therapist before starting if it applies to you."),
        ("Cạo gió",
            "Dùng dụng cụ cạo dọc lưng, vai và cổ theo y học cổ truyền, thường dùng khi người mệt mỏi, "
            + "đau mỏi vai gáy hoặc có dấu hiệu cảm lạnh. Vệt đỏ xuất hiện trên da sau khi cạo là phản "
            + "ứng bình thường của mạch máu dưới da, thường mờ dần sau 2–3 ngày.\n\n"
            + "Hay đi kèm massage hoặc giác hơi trong cùng buổi. Không cạo lên vùng da đang có vết "
            + "thương hở, phát ban hoặc viêm nhiễm.",
            "Gua sha",
            "Scraping along the back, shoulders and neck with a smooth-edged tool, a traditional-"
            + "medicine technique used for fatigue, stiff shoulders or the early signs of a cold. The "
            + "red marks that appear on the skin afterward are a normal reaction from blood vessels near "
            + "the surface, usually fading within 2–3 days.\n\n"
            + "Often paired with massage or cupping in the same session. It's not applied over open "
            + "wounds, rashes or inflamed skin."),
    ];

    /// <summary>
    /// Slug đã ngừng bán — 2026-09-15, "Xông hơi thảo dược". Tắt <see cref="Service.IsActive"/>
    /// thay vì xoá hàng hoặc bỏ khỏi <see cref="Data"/> một mình: <c>ktv_services</c> có thể
    /// đang tham chiếu, và một hồ sơ KTV mất một dòng dịch vụ mà không ai chủ động gỡ là xoá
    /// ngầm dữ liệu KTV đã khai. Đường đọc công khai (<c>ServiceCatalogService.ListAsync</c>,
    /// <c>GetBySlugAsync</c>) đều lọc theo <c>IsActive</c>, nên tắt cờ này là đủ để dịch vụ
    /// biến mất khỏi trang chủ, form chọn dịch vụ và trang <c>/dich-vu/{slug}</c> (404).
    ///
    /// Rời khỏi <see cref="Data"/> có chủ đích: mảng đó là nguồn sự thật cho tên/mô tả/thứ
    /// tự của danh mục **đang bán**, nên một dịch vụ ngừng bán không còn thuộc về nó — giữ
    /// lại sẽ buộc mọi lần sửa `Data` sau này phải nhớ bỏ qua đúng một phần tử.
    /// </summary>
    private static readonly string[] DiscontinuedSlugs = ["xong-hoi-thao-duoc"];

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        short order = 0;
        var added = 0;
        var filled = 0;
        var reordered = 0;
        var redescribed = 0;
        var discontinued = 0;

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

                // Description/DescriptionEn thì **ghi đè**, cùng lý do với SortOrder
                // ngay dưới — đây là nội dung biên tập, `Data` là nguồn sự thật duy
                // nhất. `??=` sẽ khiến bản mở rộng 2026-09-15 không bao giờ tới được
                // môi trường đã seed bản một câu ban đầu.
                if (existing.Description != description || existing.DescriptionEn != descriptionEn)
                {
                    existing.Description = description;
                    existing.DescriptionEn = descriptionEn;
                    redescribed++;
                }

                // SortOrder thì **ghi đè**, không phải chỉ điền khi trống: nó suy ra từ
                // vị trí trong `Data`, nên chèn một dịch vụ vào giữa danh sách sẽ dịch
                // thứ tự của mọi dịch vụ đứng sau. Bỏ qua như phần bản dịch ở trên thì
                // dịch vụ mới nhận đúng số thứ tự mà một dịch vụ cũ đang giữ — hai hàng
                // cùng bậc, và thứ tự giữa chúng rơi về `ThenBy(Name)`, tức không còn
                // là thứ tự biên tập đã chọn.
                //
                // Ghi đè an toàn vì đây là dữ liệu biên tập thuần: `Data` là nguồn sự
                // thật duy nhất cho thứ tự danh mục, không ai chỉnh cột này bằng tay.
                if (existing.SortOrder != order) { existing.SortOrder = order; reordered++; }
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

        foreach (var slug in DiscontinuedSlugs)
        {
            var existing = await db.Services.FirstOrDefaultAsync(s => s.Slug == slug, ct);
            if (existing is not null && existing.IsActive)
            {
                existing.IsActive = false;
                discontinued++;
            }
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation(
            "Đã seed danh mục dịch vụ: thêm mới {Added}/{Total}, bổ sung bản dịch EN {Filled}, "
            + "cập nhật mô tả {Redescribed}, sắp xếp lại {Reordered}, ngừng bán {Discontinued}",
            added, Data.Length, filled, redescribed, reordered, discontinued);
    }
}
