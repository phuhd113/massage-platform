using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Đổi tên hiển thị của gói đẩy tin sang tiếng Việt: "VIP Pin" → "Ghim đầu trang",
    /// "Instant Boost khung giờ vàng" → "Đẩy hạng theo giờ (khung giờ vàng)".
    ///
    /// Không có thay đổi schema — đây là backfill dữ liệu, đi kèm đợt gỡ tên mã tiếng
    /// Anh khỏi mặt người dùng (2026-09-12).
    ///
    /// Cần migration chứ không chỉ sửa <c>PromotionPackageSeeder</c>: seeder idempotent
    /// theo <c>code</c> và <b>bỏ qua</b> hàng đã tồn tại, nên sửa mình nó chỉ có tác
    /// dụng với database rỗng. Ở nơi đã seed từ trước, chuỗi cũ vẫn nằm nguyên trong
    /// <c>promotion_packages.name</c> và hiện <b>nguyên văn</b> trên thẻ mua gói —
    /// frontend render <c>pkg.name</c> chứ không tra lại nhãn theo <c>type</c>.
    ///
    /// Chỉ đụng <c>name</c>. <c>code</c> và <c>type</c> giữ nguyên: <c>code</c> là khoá
    /// idempotency của seeder và khoá tra gói của API, còn <c>type</c> nằm trong
    /// <c>UNIQUE (area_id, package_type, window_start, slot_index)</c> cùng mọi campaign
    /// đã bán — đổi chúng là sửa dữ liệu đang tính tiền để đổi một nhãn.
    ///
    /// Campaign đã bán không cần backfill: chúng không sao chép tên gói, chỉ giữ
    /// <c>package_type</c>, và nhãn dựng từ đó ở frontend (<c>lib/labels.ts</c>).
    ///
    /// Mệnh đề <c>AND name = ...</c> làm migration an toàn khi chạy lại và không ghi đè
    /// tên đã sửa tay: chỉ đổi khi còn đúng chuỗi cũ.
    /// </summary>
    public partial class VietnamesePackageNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""
                UPDATE promotion_packages
                SET name = 'Ghim đầu trang 7 ngày'
                WHERE code = 'vip-pin-7d' AND name = 'VIP Pin 7 ngày';

                UPDATE promotion_packages
                SET name = 'Ghim đầu trang 30 ngày'
                WHERE code = 'vip-pin-30d' AND name = 'VIP Pin 30 ngày';

                UPDATE promotion_packages
                SET name = 'Đẩy hạng theo giờ (khung giờ vàng)'
                WHERE code = 'instant-boost-1d' AND name = 'Instant Boost khung giờ vàng';
                """);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""
                UPDATE promotion_packages
                SET name = 'VIP Pin 7 ngày'
                WHERE code = 'vip-pin-7d' AND name = 'Ghim đầu trang 7 ngày';

                UPDATE promotion_packages
                SET name = 'VIP Pin 30 ngày'
                WHERE code = 'vip-pin-30d' AND name = 'Ghim đầu trang 30 ngày';

                UPDATE promotion_packages
                SET name = 'Instant Boost khung giờ vàng'
                WHERE code = 'instant-boost-1d' AND name = 'Đẩy hạng theo giờ (khung giờ vàng)';
                """);
    }
}
