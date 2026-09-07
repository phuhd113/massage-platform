using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Ảnh CCCD của KTV — điều kiện bắt buộc để hồ sơ được duyệt VERIFIED.
    ///
    /// <b>Một hàng mỗi KTV, không phải một hàng mỗi mặt thẻ.</b> <c>UNIQUE (ktv_id)</c>
    /// ép điều đó ở tầng DB, và hai mặt nằm chung hàng nên chúng luôn được duyệt cùng
    /// nhau: duyệt riêng từng mặt là để lọt trường hợp ghép mặt trước của thẻ này với
    /// mặt sau của thẻ khác. Gửi lại thì <b>ghi đè</b> hàng cũ (UPSERT) chứ không thêm
    /// hàng — lịch sử các lần bị từ chối không đáng giữ, mà giữ lại nghĩa là giữ thêm
    /// nhiều bản sao giấy tờ tuỳ thân trong DB.
    ///
    /// <b>Cố ý không có cột số CCCD.</b> Admin đọc số trên ảnh lúc duyệt; chưa có nghiệp
    /// vụ nào truy vấn theo số. Đây là định danh cấp quốc gia — một lần rò rỉ không thu
    /// hồi được — nên không lưu là mức bảo vệ rẻ nhất và chắc nhất. Khi cần chặn một
    /// người mở nhiều hồ sơ thì thêm cột hash có muối, đừng thêm số thô.
    ///
    /// <b><c>submitted_at</c> tách khỏi <c>created_at</c></b> vì hàng bị ghi đè tại chỗ:
    /// nếu hàng đợi duyệt xếp theo <c>created_at</c> thì KTV bị từ chối rồi gửi lại vẫn
    /// nằm nguyên chỗ cũ trong hàng đợi và không bao giờ được xem lại.
    ///
    /// File nằm ở prefix <c>identity/</c> trong bucket — <b>riêng tư</b>, cùng luật với
    /// <c>certifications/</c>. WAF rule trên custom domain phải chặn cả hai prefix, xem
    /// <c>docs/cloudflare-r2-setup.md</c> bước 4.
    /// </summary>
    public partial class KtvIdentityDocument : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE TABLE ktv_identity_documents (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ktv_id            UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    front_key         VARCHAR(255) NOT NULL,
                    back_key          VARCHAR(255) NOT NULL,
                    verify_status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    rejection_reason  TEXT,
                    verified_by       UUID REFERENCES users(id),
                    verified_at       TIMESTAMPTZ,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

                    CONSTRAINT chk_identity_doc_status
                        CHECK (verify_status IN ('PENDING', 'VERIFIED', 'REJECTED')),

                    -- Một CCCD mỗi hồ sơ. Đây là trọng tài của luật "một-đối-một": tầng
                    -- ứng dụng làm UPSERT dựa đúng vào ràng buộc này, nên nới nó ra sẽ
                    -- biến hai lượt gửi song song thành hai hàng CCCD cho cùng một KTV.
                    CONSTRAINT uq_identity_doc_ktv UNIQUE (ktv_id),

                    -- Hai mặt phải là hai file khác nhau. Gửi cùng một ảnh cho cả hai ô
                    -- là lỗi thao tác thường gặp (bấm nhầm cùng một tấm), và nó lọt qua
                    -- mọi kiểm tra khác vì cả hai cột đều NOT NULL và đều là key hợp lệ.
                    CONSTRAINT chk_identity_doc_two_sides CHECK (front_key <> back_key)
                );

                -- Hàng đợi duyệt: "CCCD đang chờ, gửi sớm nhất lên đầu".
                CREATE INDEX idx_identity_doc_queue
                    ON ktv_identity_documents (verify_status, submitted_at);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS ktv_identity_documents;");
        }
    }
}
