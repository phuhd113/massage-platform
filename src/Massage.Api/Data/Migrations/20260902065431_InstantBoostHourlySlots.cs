using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Mở bán Instant Boost: gói bán theo <b>khung giờ</b> thay vì khung ngày.
    ///
    /// Bảng <c>slot_allocations</c> không đổi. Nó đã chống trùng bằng
    /// <c>UNIQUE (area_id, package_type, window_start, slot_index)</c>, và
    /// <c>package_type</c> nằm trong khoá nên khung giờ của Instant Boost không bao
    /// giờ đụng khung ngày của VIP Pin dù cả hai ghi chung một bảng. Tách bảng riêng
    /// cho slot theo giờ sẽ tạo ra hai trọng tài chống trùng phải tự giữ cho khớp
    /// nhau mãi mãi — nhiều rủi ro hơn hẳn phần được lợi.
    ///
    /// Thay đổi thật sự chỉ có hai: thêm cột đơn vị giờ, và một CHECK ép mỗi gói
    /// khai báo đúng một đơn vị thời lượng cho loại của nó.
    /// </summary>
    public partial class InstantBoostHourlySlots : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE promotion_packages
                    ADD COLUMN duration_hours INTEGER;
                """);

            // Backfill TRƯỚC khi thêm CHECK.
            //
            // Thứ tự này không phải chuyện phong cách: gói Instant Boost đã tồn tại
            // từ Phase 2 với duration_hours NULL, nên thêm ràng buộc trước sẽ làm
            // migration đổ ngay trên mọi database đã chạy seed-packages — Postgres
            // kiểm CHECK trên toàn bộ dòng hiện có tại thời điểm ADD CONSTRAINT.
            //
            // Gói được seed từ Phase 2 với is_active = false vì lúc đó cấp phát slot
            // mới chỉ cắt theo ngày. Giờ đã có khung giờ nên mở bán, kèm khai báo
            // thời lượng theo đúng đơn vị của nó.
            //
            // UPDATE chứ không INSERT: hàng đã tồn tại ở mọi môi trường đã chạy
            // seed-packages, và seeder là idempotent theo `code`.
            migrationBuilder.Sql("""
                UPDATE promotion_packages
                SET duration_hours = 3,
                    is_active = true,
                    description = 'Đẩy hạng trong 3 khung giờ liên tiếp kể từ giờ kế tiếp, '
                                  || 'đảm bảo đứng trên các KTV không mua gói trong khu vực đã chọn.'
                WHERE type = 'INSTANT_BOOST' AND duration_hours IS NULL;
                """);

            // Đơn vị thời lượng phải khớp loại gói, và ràng buộc đó thuộc về DB chứ
            // không chỉ về code: một hàng seed sai đơn vị sẽ bán 3 ngày với giá 3 giờ,
            // và không có test nào của tầng ứng dụng nhìn thấy nó.
            //
            // Gói theo giờ: duration_hours bắt buộc, duration_days vẫn phải > 0 vì cột
            // đó NOT NULL CHECK (> 0) từ Phase 2 — nó chỉ không còn dùng để tính khung.
            migrationBuilder.Sql("""
                ALTER TABLE promotion_packages
                    ADD CONSTRAINT chk_package_duration_unit CHECK (
                        (type = 'INSTANT_BOOST' AND duration_hours IS NOT NULL AND duration_hours > 0)
                     OR (type <> 'INSTANT_BOOST' AND duration_hours IS NULL)
                    );
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Trả gói về trạng thái chưa mở bán trước khi bỏ cột: rollback mà vẫn để
            // is_active = true sẽ bán một gói mà code cũ không biết cách cấp phát slot.
            migrationBuilder.Sql("""
                UPDATE promotion_packages
                SET is_active = false,
                    description = 'Đẩy hạng theo khung giờ. Mở bán ở Phase 3 cùng với cấp phát slot theo giờ.'
                WHERE code = 'instant-boost-1d';

                ALTER TABLE promotion_packages
                    DROP CONSTRAINT IF EXISTS chk_package_duration_unit;

                ALTER TABLE promotion_packages
                    DROP COLUMN IF EXISTS duration_hours;
                """);

            // Campaign Instant Boost đã bán (nếu có) vẫn giữ nguyên: chúng đã thu tiền
            // thật và slot_allocations của chúng vẫn hợp lệ với schema cũ. Xoá đi để
            // "sạch" sẽ là xoá thứ KTV đã trả tiền mua.
        }
    }
}
