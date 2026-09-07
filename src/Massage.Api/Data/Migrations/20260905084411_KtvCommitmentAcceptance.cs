using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Bằng chứng KTV đã chấp nhận bản cam kết (xem <c>KtvCommitments</c>).
    ///
    /// <b>Lưu số phiên bản, không lưu một cờ boolean.</b> Nội dung cam kết sẽ đổi theo
    /// thời gian, và "đã tick" mà không biết tick vào bản nào thì không chứng minh được
    /// gì khi có tranh chấp — đúng lúc cần tới nó nhất. Bộ ba
    /// <c>commitment_version</c> + <c>committed_at</c> + <c>committed_ip</c> trả lời
    /// được "đồng ý với cái gì, khi nào, từ đâu".
    ///
    /// <b>Mặc định 0 cho hồ sơ đã có.</b> Không backfill thành phiên bản hiện tại: những
    /// hồ sơ đó chưa từng nhìn thấy bản cam kết nào, và ghi nhận họ đã đồng ý là tự tạo
    /// ra bằng chứng giả cho chính mình. Họ phải xác nhận lại — hệ quả có chủ ý là hồ sơ
    /// cũ không duyệt lại được cho tới khi làm việc đó.
    ///
    /// <c>committed_ip</c> là VARCHAR(45) chứ không phải INET: đủ cho IPv6 dạng đầy đủ,
    /// và giá trị này chỉ để đọc lại khi có tranh chấp chứ không bao giờ dùng để lọc hay
    /// so sánh dải. Một chuỗi lạ từ proxy làm hỏng lượt lưu hồ sơ thì tệ hơn hẳn việc
    /// thiếu một dòng bằng chứng.
    /// </summary>
    public partial class KtvCommitmentAcceptance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE ktv_profiles
                    ADD COLUMN commitment_version INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN committed_at       TIMESTAMPTZ,
                    ADD COLUMN committed_ip       VARCHAR(45);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE ktv_profiles
                    DROP COLUMN IF EXISTS commitment_version,
                    DROP COLUMN IF EXISTS committed_at,
                    DROP COLUMN IF EXISTS committed_ip;
                """);
        }
    }
}
