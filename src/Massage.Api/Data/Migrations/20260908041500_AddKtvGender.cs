using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Giới tính KTV — cột <c>gender</c> trên <c>ktv_profiles</c>, kèm bộ lọc theo giới
    /// tính ở <c>/search</c> (2026-09-08).
    ///
    /// <b>Nullable và KHÔNG backfill.</b> Hồ sơ có từ trước không có dữ liệu này, và suy
    /// từ tên là đoán: đoán sai nghĩa là khách lọc "KTV nữ" gọi trúng một người nam —
    /// hỏng đúng cái nhu cầu mà cột này sinh ra để phục vụ. Hồ sơ cũ khai lại ở lần sửa
    /// kế tiếp, nơi ô này cũng bắt buộc. Hệ quả có chủ ý: <b>chúng vắng mặt ở mọi lượt
    /// lọc theo giới tính</b> cho tới lúc đó.
    ///
    /// <b>CHECK constraint ở tầng DB, không chỉ ở FluentValidation.</b> Đường ghi qua API
    /// không phải đường duy nhất chạm bảng này — seed và sửa tay bằng SQL cũng có — và
    /// một giá trị lạ ('nu', 'Nam', '') sẽ không khớp bộ lọc nào mà cũng không có gì báo
    /// đỏ: hồ sơ đơn giản là biến mất khỏi kết quả tìm kiếm. Cùng hình dạng với
    /// <c>chk_package_duration_unit</c>.
    ///
    /// <b>Không có index.</b> Giới tính chia tập ứng viên làm hai, tức chọn lọc ~50% —
    /// Postgres sẽ bỏ qua index B-tree ở độ chọn lọc đó và quét tuần tự vẫn rẻ hơn. Bộ
    /// lọc này luôn đi kèm một vị từ đã thu hẹp mạnh (bán kính GiST, hoặc coverage theo
    /// khu vực), nên nó chỉ lọc trên tập đã nhỏ sẵn.
    /// </summary>
    public partial class AddKtvGender : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE ktv_profiles
                    ADD COLUMN gender VARCHAR(10);

                ALTER TABLE ktv_profiles
                    ADD CONSTRAINT chk_ktv_gender
                    CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE'));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE ktv_profiles DROP CONSTRAINT chk_ktv_gender;
                ALTER TABLE ktv_profiles DROP COLUMN gender;
                """);
        }
    }
}
