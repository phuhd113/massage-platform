using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Ảnh đại diện KTV phải qua duyệt như ảnh gallery.
    ///
    /// Trước đây avatar hiện ngay. Lý do khi đó ("nó đã nằm trong tầm mắt admin ở chính
    /// trang duyệt hồ sơ") chỉ đúng với hồ sơ mới: hồ sơ <b>đã VERIFIED</b> đổi avatar bất
    /// cứ lúc nào mà không lượt nào lọt vào mắt ai — đúng cái lỗ mà việc duyệt ảnh gallery
    /// sinh ra để bịt, và nó nằm ở tấm ảnh lớn nhất trên trang công khai.
    ///
    /// <b>Hai cột thay vì một cột kèm cờ trạng thái</b>: `avatar_key` giữ ảnh đang hiển
    /// thị (đã duyệt), `pending_avatar_key` giữ ảnh chờ duyệt. Một cột thì hồ sơ đã duyệt
    /// đổi ảnh là mất hiển thị vài giờ, và KTV sẽ học được rằng đừng bao giờ đổi ảnh — tức
    /// tính năng tự vô hiệu hoá chính nó.
    /// </summary>
    public partial class KtvAvatarModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                    ADD COLUMN pending_avatar_key     VARCHAR(255),
                    ADD COLUMN avatar_verify_status   VARCHAR(20),
                    ADD COLUMN avatar_rejection_reason TEXT,
                    ADD COLUMN avatar_verified_by     UUID REFERENCES users(id) ON DELETE SET NULL,
                    ADD COLUMN avatar_submitted_at    TIMESTAMPTZ;
                """);

            // NULL nghĩa là "không có ảnh nào đang chờ" — cố ý KHÔNG mặc định 'PENDING'.
            // Một hồ sơ chưa từng tải avatar mà mang trạng thái chờ duyệt sẽ nằm trong hàng
            // đợi admin vĩnh viễn: không có gì để duyệt và không cách nào dọn.
            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                    ADD CONSTRAINT chk_ktv_avatar_verify_status
                    CHECK (avatar_verify_status IS NULL
                           OR avatar_verify_status IN ('PENDING', 'VERIFIED', 'REJECTED'));
                """);

            // Trạng thái PENDING phải đi kèm một ảnh thật. Thiếu ràng buộc này thì một hàng
            // (pending_avatar_key = NULL, status = 'PENDING') lọt vào hàng đợi duyệt và admin
            // mở ra thấy ô trống — hỏng im lặng, vì mọi giá trị đều hợp lệ khi xét riêng lẻ.
            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                    ADD CONSTRAINT chk_ktv_pending_avatar_pair
                    CHECK (avatar_verify_status <> 'PENDING' OR pending_avatar_key IS NOT NULL);
                """);

            // Hàng đợi duyệt avatar. Partial index vì chỉ hàng PENDING được truy vấn, và
            // đại đa số hồ sơ có cột này NULL — index đầy đủ sẽ phình vì hàng nghìn NULL.
            // Khai trong migration chứ không trong OnModelCreating: EF không mô hình hoá
            // được mệnh đề WHERE, khai ở đó sẽ làm mọi lần `migrations add` sau sinh diff rác
            // (cùng lý do với idx_ktv_referred_by và uq_area_root_slug).
            migrationBuilder.Sql("""
                CREATE INDEX idx_ktv_avatar_pending
                    ON ktv_profiles (avatar_submitted_at)
                    WHERE avatar_verify_status = 'PENDING';
                """);

            // Backfill: avatar đang có coi như đã duyệt.
            //
            // Chúng đã hiển thị công khai từ trước và admin đã nhìn thấy chúng ở trang duyệt
            // hồ sơ. Đẩy ngược vào hàng chờ sẽ làm ảnh biến mất khỏi sàn của những hồ sơ đang
            // hoạt động — phạt người dùng cũ vì một thay đổi nội bộ mà họ không gây ra.
            //
            // Cố ý KHÔNG ghi avatar_verify_status = 'VERIFIED' ở đây: cột đó mô tả ảnh **đang
            // chờ**, và không có ảnh nào đang chờ. Đặt VERIFIED cho một ô rỗng là nói rằng có
            // thứ gì đó vừa được duyệt.
            migrationBuilder.Sql("""
                UPDATE ktv_profiles
                SET pending_avatar_key = NULL, avatar_verify_status = NULL
                WHERE avatar_key IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Ảnh đang chờ duyệt bị mất khi rollback — chấp nhận được: chúng chưa bao giờ
            // hiển thị công khai, và avatar đang dùng nằm ở cột avatar_key không bị đụng tới.
            // File trong storage không xoá ở đây; dọn file mồ côi là việc của storage, không
            // phải của một lần rollback schema.
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_ktv_avatar_pending;");

            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                    DROP CONSTRAINT IF EXISTS chk_ktv_pending_avatar_pair,
                    DROP CONSTRAINT IF EXISTS chk_ktv_avatar_verify_status;
                """);

            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                    DROP COLUMN IF EXISTS avatar_submitted_at,
                    DROP COLUMN IF EXISTS avatar_verified_by,
                    DROP COLUMN IF EXISTS avatar_rejection_reason,
                    DROP COLUMN IF EXISTS avatar_verify_status,
                    DROP COLUMN IF EXISTS pending_avatar_key;
                """);
        }
    }
}
