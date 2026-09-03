using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Index cho các trường mà thẻ KTV trên trang tìm kiếm cần đọc thêm: số chứng
    /// chỉ đã duyệt và một vài dịch vụ tiêu biểu.
    ///
    /// Không thêm cột nào — dữ liệu đã có sẵn (<c>ktv_profiles.bio</c>,
    /// <c>certifications</c>, <c>ktv_services</c>). Thứ còn thiếu là đường truy cập:
    /// <c>certifications</c> chỉ có PRIMARY KEY trên <c>id</c>, nên đếm chứng chỉ
    /// theo <c>ktv_id</c> phải quét toàn bảng. Trong truy vấn search, phép đếm đó
    /// chạy **một lần cho mỗi ứng viên** — đúng hình dạng của sự cố CTE thiếu
    /// MATERIALIZED ngày 2026-09-02 (seq scan lặp trong nested loop, chậm gấp 89
    /// lần ở 5.000 hồ sơ). Thêm cột mà quên index sẽ dựng lại đúng sự cố đó.
    ///
    /// <c>ktv_services</c> đã có PRIMARY KEY <c>(ktv_id, service_id)</c>; <c>ktv_id</c>
    /// là cột dẫn đầu nên tra theo KTV đã được index đó phục vụ — không cần thêm.
    /// </summary>
    public partial class SearchCardFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Partial index: thẻ chỉ đếm chứng chỉ đã duyệt, nên các hàng PENDING và
            // REJECTED không cần nằm trong index. Hồ sơ bị từ chối và hồ sơ chờ duyệt
            // chiếm phần không nhỏ của bảng này, và chúng không bao giờ được đếm.
            //
            // CONCURRENTLY để không khoá ghi khi chạy trên bảng đã có dữ liệu; đi kèm
            // suppressTransaction vì CONCURRENTLY không chạy được bên trong transaction
            // mà EF bọc quanh mỗi migration.
            migrationBuilder.Sql(
                """
                CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_certification_ktv_verified
                    ON certifications (ktv_id)
                    WHERE verify_status = 'VERIFIED';
                """,
                suppressTransaction: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // CONCURRENTLY ở cả chiều xuống, cùng lý do: DROP INDEX thường lấy khoá
            // ACCESS EXCLUSIVE và chặn mọi truy vấn chạm bảng trong lúc đó.
            migrationBuilder.Sql(
                "DROP INDEX CONCURRENTLY IF EXISTS idx_certification_ktv_verified;",
                suppressTransaction: true);
        }
    }
}
