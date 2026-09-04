using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Hàng đợi báo cáo vi phạm hồ sơ KTV.
    ///
    /// Bảng này có mặt sớm chứ không đợi Phase 4 vì rủi ro nó phòng chạm đúng hai trụ
    /// cột của dự án: pháp lý, và kênh acquisition chính. Google hạ hạng mạnh tên miền
    /// bị phân loại là nội dung người lớn, và với sản phẩm sống bằng traffic organic thì
    /// đó không phải một sự cố sửa được bằng bản vá.
    ///
    /// Không có ràng buộc UNIQUE chống trùng ở đây, khác <c>reviews</c>. Cửa sổ gộp là
    /// 24 giờ theo thiết bị và điều đó không diễn đạt được bằng một khoá duy nhất —
    /// UNIQUE chặn giá trị rời rạc, không chặn được "trong vòng 24 giờ qua". Việc gộp
    /// nằm ở tầng ứng dụng, còn ở đây chỉ có index phục vụ đúng truy vấn đó.
    ///
    /// <c>reporter_user_id</c> NULL được, cố ý: bắt đăng nhập mới cho báo cáo sẽ chặn
    /// đúng nhóm người có nhiều khả năng báo cáo nhất — khách vãng lai vừa nhìn thấy
    /// nội dung vi phạm trên một trang công khai.
    /// </summary>
    public partial class ProfileReports : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE profile_reports (
                    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ktv_id           UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    reporter_user_id UUID REFERENCES users(id),
                    reason           VARCHAR(30) NOT NULL CHECK (reason IN (
                                         'PROSTITUTION','INAPPROPRIATE_CONTENT','FALSE_INFORMATION',
                                         'IMPERSONATION','MISCONDUCT','OTHER')),
                    detail           TEXT,
                    status           VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                         CHECK (status IN ('PENDING','ACTION_TAKEN','DISMISSED')),
                    ip               VARCHAR(45),
                    user_agent       TEXT,
                    device_hash      VARCHAR(64),
                    reviewed_by      UUID REFERENCES users(id),
                    reviewed_at      TIMESTAMPTZ,
                    resolution_note  TEXT,
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

                    -- Một dòng đã chốt phải nói được ai chốt và lúc nào. Ràng buộc ở tầng
                    -- DB chứ không chỉ trong code vì đây là dữ liệu dùng để đối chất khi
                    -- KTV khiếu nại việc hồ sơ bị gỡ.
                    CONSTRAINT chk_report_reviewed_together CHECK (
                        (status = 'PENDING'  AND reviewed_by IS NULL AND reviewed_at IS NULL)
                     OR (status <> 'PENDING' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
                );
                """);

            // Truy vấn chính của hàng đợi admin: lọc theo trạng thái, cũ trước.
            migrationBuilder.Sql(
                "CREATE INDEX idx_report_status_time ON profile_reports (status, created_at);");

            // Đếm số báo cáo còn chờ theo từng hồ sơ — con số quyết định thứ tự đọc của
            // admin, nên nó chạy mỗi lần mở hàng đợi chứ không phải thỉnh thoảng.
            migrationBuilder.Sql(
                "CREATE INDEX idx_report_ktv_status ON profile_reports (ktv_id, status);");

            // Đường gộp báo cáo trùng lọc theo (ktv, thiết bị, thời gian). Partial index
            // bỏ qua dòng không có device_hash — chúng không bao giờ gộp được.
            migrationBuilder.Sql(
                """
                CREATE INDEX idx_report_dedupe
                  ON profile_reports (ktv_id, device_hash, created_at DESC)
                  WHERE device_hash IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Index đi theo bảng, nên drop bảng là đủ.
            migrationBuilder.Sql("DROP TABLE IF EXISTS profile_reports;");
        }
    }
}
