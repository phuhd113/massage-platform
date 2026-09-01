using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Schema Phase 1: danh mục dịch vụ, bảng giá theo KTV, lead liên hệ, đánh giá,
    /// và ba cột phục vụ BaseScore trên hồ sơ KTV.
    ///
    /// Thân viết bằng raw SQL theo convention của dự án — fluent API không mô hình
    /// hoá được CHECK constraint và partial index, mà đây là những thứ giữ cho dữ
    /// liệu đúng chứ không phải tối ưu có thể bỏ qua.
    /// </summary>
    public partial class Phase1SearchAndReviews : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Cột mới NOT NULL đều có DEFAULT: bảng đã có dữ liệu ở môi trường đang
            // chạy, thiếu default thì migration fail ngay khi áp lên production.
            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                    ADD COLUMN response_rate  NUMERIC(5,4) NOT NULL DEFAULT 0
                                              CHECK (response_rate BETWEEN 0 AND 1),
                    ADD COLUMN response_count INTEGER NOT NULL DEFAULT 0,
                    ADD COLUMN lead_count     INTEGER NOT NULL DEFAULT 0;
                """);

            // Đường tìm kiếm chỉ đụng tới hồ sơ đã duyệt. Partial index nhỏ hơn hẳn
            // index đầy đủ và loại luôn bước lọc verification_status sau khi quét GiST.
            migrationBuilder.Sql("""
                CREATE INDEX idx_ktv_search_verified ON ktv_profiles USING GIST (base_point)
                WHERE verification_status = 'VERIFIED';
                """);

            migrationBuilder.Sql("""
                CREATE TABLE services (
                    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name        VARCHAR(120) NOT NULL,
                    slug        VARCHAR(160) NOT NULL UNIQUE,
                    description TEXT,
                    sort_order  SMALLINT NOT NULL DEFAULT 0,
                    is_active   BOOLEAN NOT NULL DEFAULT true,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE ktv_services (
                    ktv_id       UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    service_id   UUID NOT NULL REFERENCES services(id),
                    -- NUMERIC chứ không phải float: giá hiển thị công khai và sẽ đi
                    -- vào đối soát khi có ví ở Phase 2.
                    price_from   NUMERIC(12,0) NOT NULL DEFAULT 0 CHECK (price_from >= 0),
                    duration_min SMALLINT NOT NULL DEFAULT 60
                                 CHECK (duration_min BETWEEN 15 AND 300),
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (ktv_id, service_id)
                );
                """);

            // Lọc theo dịch vụ là bộ lọc phụ của search; index theo service_id để
            // truy vấn "KTV nào cung cấp dịch vụ X" không phải quét toàn bảng.
            migrationBuilder.Sql("CREATE INDEX idx_ktv_service_service ON ktv_services (service_id);");

            migrationBuilder.Sql("""
                CREATE TABLE leads (
                    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ktv_id           UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    customer_user_id UUID REFERENCES users(id),
                    channel          VARCHAR(20) NOT NULL CHECK (channel IN ('CALL','ZALO','SMS')),
                    area_id          UUID REFERENCES administrative_areas(id),
                    source_url       TEXT,
                    ip               VARCHAR(45),
                    user_agent       TEXT,
                    device_hash      VARCHAR(64),
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            migrationBuilder.Sql("CREATE INDEX idx_lead_ktv_time ON leads (ktv_id, created_at DESC);");

            // Truy vấn gộp lead trùng lọc theo (ktv, device, thời gian). Partial index
            // bỏ qua các dòng không có device_hash — chúng không bao giờ gộp được.
            migrationBuilder.Sql("""
                CREATE INDEX idx_lead_dedupe ON leads (ktv_id, device_hash, created_at DESC)
                WHERE device_hash IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                CREATE TABLE reviews (
                    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ktv_id           UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    author_user_id   UUID NOT NULL REFERENCES users(id),
                    lead_id          UUID REFERENCES leads(id),
                    rating           SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                    comment          TEXT,
                    status           VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED'
                                     CHECK (status IN ('PENDING','PUBLISHED','REJECTED')),
                    rejection_reason TEXT,
                    moderated_by     UUID REFERENCES users(id),
                    moderated_at     TIMESTAMPTZ,
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
                    -- Một tài khoản chỉ đánh giá một KTV một lần. Ràng buộc ở DB chứ
                    -- không chỉ kiểm tra trong code: hai request đồng thời sẽ cùng
                    -- vượt qua bước kiểm tra rồi cùng ghi.
                    CONSTRAINT uq_review_ktv_author UNIQUE (ktv_id, author_user_id)
                );
                """);

            migrationBuilder.Sql("CREATE INDEX idx_review_ktv_status ON reviews (ktv_id, status);");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Ngược thứ tự tạo để không vướng khoá ngoại (reviews tham chiếu leads).
            migrationBuilder.Sql("DROP TABLE IF EXISTS reviews;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS leads;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS ktv_services;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS services;");
            migrationBuilder.Sql("DROP INDEX IF EXISTS idx_ktv_search_verified;");
            migrationBuilder.Sql("""
                ALTER TABLE ktv_profiles
                    DROP COLUMN IF EXISTS lead_count,
                    DROP COLUMN IF EXISTS response_count,
                    DROP COLUMN IF EXISTS response_rate;
                """);
        }
    }
}
