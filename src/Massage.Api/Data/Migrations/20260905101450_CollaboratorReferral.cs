using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Cộng tác viên và mã giới thiệu.
    ///
    /// <b>Bảng riêng chứ không phải một cột chuỗi trên <c>ktv_profiles</c>.</b> Mã này là
    /// cơ sở trả hoa hồng nên nó phải trỏ tới một người có thật: nhập sai một chữ thì KTV
    /// báo lỗi ngay lúc tạo hồ sơ, thay vì lặng lẽ lưu một chuỗi không ai sở hữu và chỉ
    /// vỡ ra lúc đối soát. Nó cũng cho phép đếm "CTV này mời được bao nhiêu" bằng một câu
    /// join, thay vì gộp theo chuỗi nơi 'AN01' và 'an01' thành hai người khác nhau.
    ///
    /// <b><c>ktv_profiles</c> giữ khoá ngoại, không giữ chuỗi mã.</b> Mã đổi được, còn
    /// "ai mang người này về" thì không — lưu chuỗi thì mọi hồ sơ cũ mất dấu ngay khi mã
    /// được sửa, đúng vào lúc cần nó nhất.
    ///
    /// <b><c>ON DELETE RESTRICT</c></b> (khác <c>CASCADE</c> dùng cho ảnh và chứng chỉ):
    /// xoá một CTV đang có hồ sơ giới thiệu phải **thất bại**, chứ không được lặng lẽ gỡ
    /// liên kết khỏi những hồ sơ đó. Ngừng hợp tác thì chuyển <c>status='DISABLED'</c> —
    /// mã hết dùng được cho hồ sơ mới nhưng lịch sử vẫn nguyên vẹn.
    ///
    /// Cột <c>referred_at</c> tách khỏi <c>created_at</c> của hồ sơ vì admin có thể gắn
    /// mã sau khi có khiếu nại "tôi mời người này nhưng họ quên điền mã", và lúc đó hai
    /// mốc khác hẳn nhau.
    /// </summary>
    public partial class CollaboratorReferral : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE collaborators (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    code        VARCHAR(32) NOT NULL,
                    full_name   VARCHAR(120) NOT NULL,
                    phone       VARCHAR(15),
                    status      VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
                    note        TEXT,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

                    CONSTRAINT chk_collaborator_status
                        CHECK (status IN ('ACTIVE', 'DISABLED')),

                    -- Trọng tài của tính duy nhất, không phải câu kiểm ở tầng ứng dụng:
                    -- hai lượt tạo song song cùng một mã đều thấy "chưa tồn tại" rồi cùng
                    -- ghi, để lại hai CTV tranh nhau một mã mà không ai biết.
                    CONSTRAINT uq_collaborator_code UNIQUE (code)
                );

                ALTER TABLE ktv_profiles
                    ADD COLUMN referred_by_collaborator_id UUID
                        REFERENCES collaborators(id) ON DELETE RESTRICT,
                    ADD COLUMN referred_at TIMESTAMPTZ;

                -- Đường đọc duy nhất: "CTV này đã giới thiệu những hồ sơ nào". Partial vì
                -- đa số hồ sơ tự đến qua SEO và để NULL — index phủ cả chúng chỉ làm cây
                -- to ra mà không câu nào dùng tới.
                CREATE INDEX idx_ktv_referred_by
                    ON ktv_profiles (referred_by_collaborator_id)
                    WHERE referred_by_collaborator_id IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                DROP INDEX IF EXISTS idx_ktv_referred_by;

                ALTER TABLE ktv_profiles
                    DROP COLUMN IF EXISTS referred_by_collaborator_id,
                    DROP COLUMN IF EXISTS referred_at;

                DROP TABLE IF EXISTS collaborators;
                """);
        }
    }
}
