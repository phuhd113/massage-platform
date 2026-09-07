using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Khoá tạm tài khoản sau nhiều lần sai mật khẩu.
    ///
    /// Đi kèm việc mở đường đăng nhập bằng số điện thoại + mật khẩu (2026-09-07), lối vào
    /// của giai đoạn đầu khi Zalo ZNS còn đợi giấy phép kinh doanh.
    ///
    /// <b>Không thêm <c>password_hash</c></b>: cột đó đã có từ <c>InitPhase0Schema</c> và
    /// tới giờ chưa đường ghi nào chạm vào. Migration này chỉ thêm phần còn thiếu thật.
    ///
    /// <b>Hai cột này là bắt buộc, không phải tuỳ chọn.</b> Đường OTP tự có trần thử riêng
    /// cho từng mã (<c>otp_codes.attempts</c>), nhưng mật khẩu thì không có gì tương đương
    /// — thiếu chúng thì <c>POST /auth/login</c> là một endpoint dò mật khẩu không giới
    /// hạn, và không có gì trong hệ thống nhìn thấy điều đó đang xảy ra.
    ///
    /// <b>Không backfill.</b> Tài khoản cũ (tạo bằng OTP) giữ <c>password_hash = NULL</c>,
    /// tức là chưa đặt mật khẩu — đúng sự thật. Chúng đặt được qua
    /// <c>PATCH /auth/password</c> sau khi đăng nhập.
    /// </summary>
    public partial class AddUserLoginLockout : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE users
                    ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0,
                    ADD COLUMN locked_until          TIMESTAMPTZ;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE users
                    DROP COLUMN failed_login_attempts,
                    DROP COLUMN locked_until;
                """);
        }
    }
}
