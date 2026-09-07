using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Thêm trạng thái ABANDONED cho phiên nạp tiền: mở phiên rồi không bao giờ trả
    /// tiền, và cổng chưa từng gọi về.
    ///
    /// Tách khỏi FAILED có chủ ý. FAILED nghĩa là cổng đã nói "giao dịch này hỏng" —
    /// có một lượt thanh toán thật để đối chiếu với sao kê. ABANDONED nghĩa là chưa
    /// từng có lượt nào. Gộp hai thứ lại thì lúc đối soát không phân biệt được "khách
    /// bỏ giữa chừng" với "ngân hàng từ chối", mà tỉ lệ của hai loại nói hai chuyện
    /// khác hẳn nhau về sức khoẻ của luồng nạp tiền.
    ///
    /// CHECK constraint phải drop rồi tạo lại: Postgres không sửa tại chỗ được, và
    /// EF không mô hình hoá CHECK nên cả hai chiều đều phải viết tay.
    /// </summary>
    public partial class PaymentIntentAbandoned : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE payment_intents
                    DROP CONSTRAINT payment_intents_status_check;

                ALTER TABLE payment_intents
                    ADD CONSTRAINT payment_intents_status_check
                    CHECK (status IN ('PENDING','SUCCEEDED','FAILED','ABANDONED'));
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Phải đưa dữ liệu về tập giá trị cũ TRƯỚC khi siết lại ràng buộc, nếu
            // không migration down sẽ fail trên bất kỳ DB nào job dọn đã chạy qua.
            //
            // Đổi về PENDING chứ không phải FAILED: những hàng này chưa từng có lượt
            // thanh toán nào, và FAILED sẽ nói dối rằng cổng đã từ chối chúng. Về
            // PENDING là quay lại đúng trạng thái chúng có trước khi job chạy — mất
            // thông tin "đã quá hạn", nhưng không bịa ra thông tin sai.
            migrationBuilder.Sql("""
                UPDATE payment_intents SET status = 'PENDING' WHERE status = 'ABANDONED';

                ALTER TABLE payment_intents
                    DROP CONSTRAINT payment_intents_status_check;

                ALTER TABLE payment_intents
                    ADD CONSTRAINT payment_intents_status_check
                    CHECK (status IN ('PENDING','SUCCEEDED','FAILED'));
                """);
        }
    }
}
