using Massage.Api.Modules.Promotions.Entities;
using Massage.Promotion.Domain;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Data;

/// <summary>
/// Seed catalog gói đẩy tin. Idempotent theo <c>code</c> giống các seeder khác.
///
/// Giá và số slot ở đây là tham số kinh doanh, không phải hằng số kỹ thuật — sửa
/// chúng là sửa vào doanh thu. Số slot càng nhỏ thì gói càng đắt giá và càng dễ
/// bán hết; đặt quá lớn thì "ghim VIP" mất ý nghĩa vì ai mua cũng được ghim.
/// </summary>
public static class PromotionPackageSeeder
{
    private static readonly PromotionPackageRow[] Data =
    [
        new()
        {
            Code = "vip-pin-7d",
            Name = "VIP Pin 7 ngày",
            Type = PackageTypes.VipPin,
            Description = "Ghim hồ sơ lên đầu kết quả tìm kiếm trong khu vực đã chọn, 7 ngày.",
            Price = 500_000m,
            DurationDays = 7,
            MaxSlotsPerArea = 3,
            IsActive = true,
        },
        new()
        {
            Code = "vip-pin-30d",
            Name = "VIP Pin 30 ngày",
            Type = PackageTypes.VipPin,
            Description = "Ghim hồ sơ lên đầu kết quả tìm kiếm trong khu vực đã chọn, 30 ngày.",
            Price = 1_800_000m,
            DurationDays = 30,
            MaxSlotsPerArea = 3,
            IsActive = true,
        },
        new()
        {
            Code = "featured-badge-30d",
            Name = "Huy hiệu nổi bật 30 ngày",
            // Từ 2026-09-01 Badge là 150 điểm, lớn hơn dải BaseScore (0–100), nên
            // nó đảm bảo đứng trên KTV không mua gói. Mô tả phải đi theo con số:
            // bán kèm một lời hứa hệ thống không giữ được — hoặc giấu một lời hứa
            // hệ thống có giữ — đều làm KTV hiểu sai thứ mình đang mua.
            Description = "Gắn huy hiệu nổi bật và đảm bảo đứng trên các KTV không mua gói trong khu vực đã chọn.",
            Type = PackageTypes.FeaturedBadge,
            Price = 300_000m,
            DurationDays = 30,
            MaxSlotsPerArea = 20,
            IsActive = true,
        },
        new()
        {
            Code = "instant-boost-1d",
            Name = "Instant Boost khung giờ vàng",
            Description = "Đẩy hạng trong 3 khung giờ liên tiếp kể từ giờ kế tiếp, "
                          + "đảm bảo đứng trên các KTV không mua gói trong khu vực đã chọn.",
            Type = PackageTypes.InstantBoost,
            Price = 150_000m,
            // Gói này bán theo giờ nên `DurationHours` mới là thời lượng thật.
            // `DurationDays` vẫn phải > 0 vì cột NOT NULL CHECK (> 0) có từ Phase 2;
            // nó không tham gia tính khung — xem `PromotionPackage.Duration`.
            DurationDays = 1,
            DurationHours = 3,
            MaxSlotsPerArea = 5,
            // Mở bán từ Phase 3: cấp phát slot đã cắt được theo khung giờ.
            IsActive = true,
        },
    ];

    public static async Task SeedAsync(AppDbContext db, ILogger logger, CancellationToken ct = default)
    {
        var added = 0;

        foreach (var package in Data)
        {
            if (await db.PromotionPackages.AnyAsync(p => p.Code == package.Code, ct)) continue;

            db.PromotionPackages.Add(package);
            added++;
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Đã seed catalog gói: thêm mới {Added}/{Total}", added, Data.Length);
    }
}
