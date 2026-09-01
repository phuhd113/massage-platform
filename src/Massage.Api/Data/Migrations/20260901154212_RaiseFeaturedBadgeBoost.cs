using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Nâng điểm boost của Featured Badge từ 50 lên 150 cho các campaign đang chạy.
    ///
    /// Không có thay đổi schema — đây là backfill dữ liệu, đi kèm quyết định kinh
    /// doanh ngày 2026-09-01 (xem <c>PackageTypes</c>).
    ///
    /// Cần thiết vì <c>campaigns.boost_points</c> được sao chép từ gói tại thời
    /// điểm mua và cố ý không join lại lúc đọc: đổi catalog không được làm thay đổi
    /// campaign đã bán. Quy tắc đó bảo vệ người mua khi giá <b>tăng</b>, nhưng ở
    /// đây thay đổi có lợi cho họ — không backfill thì hai KTV cùng đang giữ một
    /// gói giống hệt nhau lại xếp hạng khác nhau, và không ai giải thích nổi.
    ///
    /// Chỉ đụng campaign còn ACTIVE. Campaign đã hết hạn hoặc đã huỷ là sổ sách
    /// lịch sử, sửa lại chỉ làm hỏng khả năng đối chiếu mà không đổi thứ hạng của ai.
    /// </summary>
    public partial class RaiseFeaturedBadgeBoost : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""
                UPDATE campaigns
                SET boost_points = 150
                WHERE package_type = 'FEATURED_BADGE'
                  AND status = 'ACTIVE'
                  AND boost_points = 50;
                """);

        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""
                UPDATE campaigns
                SET boost_points = 50
                WHERE package_type = 'FEATURED_BADGE'
                  AND status = 'ACTIVE'
                  AND boost_points = 150;
                """);
    }
}
