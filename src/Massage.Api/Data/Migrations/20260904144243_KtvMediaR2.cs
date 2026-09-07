using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Ảnh hồ sơ KTV (avatar + gallery) và chuyển file sang object storage.
    ///
    /// Ba việc trong một migration vì chúng cùng một thay đổi: nơi file nằm.
    ///
    /// <b>Cột lưu key, không lưu URL.</b> <c>certifications.file_url</c> giữ nguyên tên
    /// — đổi tên cột là thao tác không tương thích ngược, mà code cũ có thể còn đang
    /// chạy khi migration đã áp — nhưng nội dung chuyển từ <c>/uploads/{guid}.pdf</c>
    /// thành key <c>certifications/{yyyy}/{MM}/{guid}.pdf</c>. Lưu URL đầy đủ thì đổi
    /// bucket hay đổi custom domain đều thành một lượt backfill toàn bảng, và những
    /// hàng chưa kịp sửa trỏ tới host đã chết.
    ///
    /// <b>Ảnh gallery có trạng thái duyệt riêng, không đi theo trạng thái hồ sơ.</b>
    /// Hồ sơ đã VERIFIED vẫn thêm ảnh mới bất cứ lúc nào; để ảnh mới hiện ngay là mở
    /// một khe đăng nội dung không ai xem trên trang công khai của đúng ngành mà
    /// Google phạt nặng nhất khi phân loại nhầm — và hình phạt rơi lên cả tên miền,
    /// không riêng một hồ sơ.
    ///
    /// Backfill lấy phần sau dấu <c>/</c> cuối cùng chứ không cắt tiền tố cứng
    /// <c>'/uploads/'</c>: <c>Upload:Dir</c> là cấu hình đổi được, nên một môi trường
    /// đã đổi nó sẽ có tiền tố khác, và cắt sai sẽ nhét tên thư mục cũ vào giữa key.
    /// Hàng nào đã là key sẵn thì không khớp điều kiện nên không đổi gì.
    /// </summary>
    public partial class KtvMediaR2 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                ALTER TABLE ktv_profiles ADD COLUMN avatar_key VARCHAR(255);

                CREATE TABLE ktv_photos (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ktv_id            UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    storage_key       VARCHAR(255) NOT NULL,
                    caption           VARCHAR(200),
                    sort_order        SMALLINT NOT NULL DEFAULT 0,
                    verify_status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    rejection_reason  TEXT,
                    verified_by       UUID REFERENCES users(id),
                    verified_at       TIMESTAMPTZ,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

                    CONSTRAINT chk_ktv_photo_status
                        CHECK (verify_status IN ('PENDING', 'VERIFIED', 'REJECTED')),

                    -- Cùng một file không được nằm hai lần trong một hồ sơ. Key chứa GUID
                    -- nên hai lượt upload cùng một tấm ảnh vẫn ra hai key khác nhau —
                    -- ràng buộc này chặn lỗi lập trình (retry ghi hai lần), không chặn
                    -- người dùng đăng lại ảnh giống nhau.
                    CONSTRAINT uq_ktv_photo_key UNIQUE (ktv_id, storage_key)
                );

                -- Đường đọc duy nhất của trang hồ sơ công khai: ảnh đã duyệt của một
                -- KTV, theo thứ tự hiển thị. Ba cột theo đúng thứ tự đó để index phục
                -- vụ được cả lọc lẫn sắp xếp.
                CREATE INDEX idx_ktv_photo_ktv
                    ON ktv_photos (ktv_id, verify_status, sort_order);

                -- Hàng đợi duyệt của admin, cũ nhất lên đầu. Partial vì hàng đợi chỉ
                -- quan tâm PENDING, và phần lớn bảng sẽ là VERIFIED sau vài tháng.
                CREATE INDEX idx_ktv_photo_pending
                    ON ktv_photos (created_at)
                    WHERE verify_status = 'PENDING';

                -- Chuyển file_url thành key: '/uploads/{guid}.pdf' -> 'certifications/{guid}.pdf'.
                -- Lấy phần sau dấu '/' cuối cùng thay vì cắt tiền tố cứng '/uploads/':
                -- Upload:Dir là cấu hình đổi được, nên một môi trường đã đổi nó sẽ có
                -- tiền tố khác, và cắt sai sẽ nhét tên thư mục cũ vào giữa key.
                --
                -- Key mới KHÔNG có phân đoạn năm/tháng như file tải lên từ nay: những
                -- hàng này không còn biết tháng gốc, và đoán một tháng sai sẽ khiến việc
                -- dọn theo tháng về sau xoá nhầm. Cả hai dạng đều là key hợp lệ.
                UPDATE certifications
                   SET file_url = 'certifications/' || regexp_replace(file_url, '^.*/', '')
                 WHERE file_url LIKE '/%';

                -- Dừng migration nếu còn hàng không chuyển được. Cột này từ trước tới nay
                -- chỉ nhận '/uploads/...' do đường upload cũ sinh ra, nên một giá trị hình
                -- dạng khác (URL tuyệt đối chẳng hạn) nghĩa là có một đường ghi khác mà
                -- migration này chưa biết. Để nó đi tiếp thì hàng đó thành "key" mà storage
                -- không có, và lỗi chỉ lộ ra khi admin bấm mở file — lâu sau, ở một chỗ
                -- không gợi ý gì về nguyên nhân.
                DO $$
                DECLARE bad int;
                BEGIN
                    SELECT count(*) INTO bad FROM certifications WHERE file_url LIKE '%://%';
                    IF bad > 0 THEN
                        RAISE EXCEPTION
                            'certifications.file_url con % hang dang URL tuyet doi, khong suy ra duoc key. Kiem tra va chuyen tay truoc khi chay lai.', bad;
                    END IF;
                END
                $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                -- Trả file_url về dạng URL cũ /uploads/{ten-file}. Chỉ áp cho những key
                -- phẳng (không có phân đoạn năm/tháng) — đó đúng là tập hàng Up() đã đổi.
                -- File tải lên sau khi đã chạy R2 nằm ở 'certifications/yyyy/MM/...' và
                -- không có bản URL nào để quay về; dựng đại một cái sẽ tạo link 404
                -- trông y như dữ liệu thật.
                UPDATE certifications
                   SET file_url = '/uploads/' || substring(file_url from '^certifications/([^/]+)$')
                 WHERE file_url ~ '^certifications/[^/]+$';

                DROP TABLE IF EXISTS ktv_photos;

                ALTER TABLE ktv_profiles DROP COLUMN avatar_key;
                """);
        }
    }
}
