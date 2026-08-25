using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Schema nền Phase 0 viết bằng raw SQL thay vì migrationBuilder fluent API.
    /// Lý do: EF không mô hình hoá được CHECK constraint, index GiST cho geography,
    /// hay partial index — mà đây đều là những thứ bảo vệ tính đúng đắn của dữ liệu,
    /// không phải chi tiết tối ưu có thể bỏ qua.
    /// </summary>
    public partial class InitPhase0Schema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS postgis;");
            migrationBuilder.Sql("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

            migrationBuilder.Sql("""
                CREATE TABLE users (
                    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    phone             VARCHAR(15) NOT NULL UNIQUE,
                    email             VARCHAR(255) UNIQUE,
                    password_hash     TEXT,
                    role              VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER'
                                      CHECK (role IN ('CUSTOMER','KTV','ADMIN')),
                    phone_verified_at TIMESTAMPTZ,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE otp_codes (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    phone        VARCHAR(15) NOT NULL,
                    code_hash    TEXT NOT NULL,
                    purpose      VARCHAR(20) NOT NULL DEFAULT 'REGISTER'
                                 CHECK (purpose IN ('REGISTER','LOGIN')),
                    attempts     SMALLINT NOT NULL DEFAULT 0,
                    consumed_at  TIMESTAMPTZ,
                    expires_at   TIMESTAMPTZ NOT NULL,
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            // Partial index: chỉ đánh index mã chưa dùng — đó là tập duy nhất được
            // truy vấn khi xác thực, và nó nhỏ hơn nhiều so với toàn bộ lịch sử OTP.
            migrationBuilder.Sql("""
                CREATE INDEX idx_otp_phone_active ON otp_codes (phone, purpose, expires_at)
                WHERE consumed_at IS NULL;
                """);

            migrationBuilder.Sql("""
                CREATE TABLE administrative_areas (
                    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name       VARCHAR(120) NOT NULL,
                    slug       VARCHAR(160) NOT NULL,
                    level      VARCHAR(20) NOT NULL CHECK (level IN ('PROVINCE','DISTRICT','WARD')),
                    parent_id  UUID REFERENCES administrative_areas(id),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT uq_area_slug_level UNIQUE (slug, level)
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE ktv_profiles (
                    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    full_name           VARCHAR(120) NOT NULL,
                    slug                VARCHAR(160) NOT NULL UNIQUE,
                    bio                 TEXT,
                    years_experience    SMALLINT NOT NULL DEFAULT 0,
                    base_point          GEOGRAPHY(POINT, 4326) NOT NULL,
                    base_address        VARCHAR(255),
                    service_radius_km   SMALLINT NOT NULL DEFAULT 5
                                        CHECK (service_radius_km BETWEEN 1 AND 50),
                    verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                        CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
                    rejection_reason    TEXT,
                    verified_by         UUID REFERENCES users(id),
                    verified_at         TIMESTAMPTZ,
                    rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 0
                                        CHECK (rating_avg BETWEEN 0 AND 5),
                    rating_count        INTEGER NOT NULL DEFAULT 0,
                    is_online           BOOLEAN NOT NULL DEFAULT false,
                    last_active_at      TIMESTAMPTZ,
                    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            // Index GiST là điều kiện để ST_DWithin dùng được index thay vì quét toàn bảng —
            // thiếu nó thì geo-search vẫn chạy đúng nhưng chậm dần theo số lượng hồ sơ.
            migrationBuilder.Sql("CREATE INDEX idx_ktv_base_point ON ktv_profiles USING GIST (base_point);");
            migrationBuilder.Sql("CREATE INDEX idx_ktv_verification ON ktv_profiles (verification_status);");

            migrationBuilder.Sql("""
                CREATE TABLE coverage_areas (
                    ktv_id     UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    area_id    UUID NOT NULL REFERENCES administrative_areas(id),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (ktv_id, area_id)
                );
                """);

            migrationBuilder.Sql("CREATE INDEX idx_coverage_area ON coverage_areas (area_id);");

            migrationBuilder.Sql("""
                CREATE TABLE certifications (
                    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ktv_id           UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    name             VARCHAR(150) NOT NULL,
                    issuing_org      VARCHAR(150),
                    issued_at        DATE,
                    file_url         TEXT NOT NULL,
                    verify_status    VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                     CHECK (verify_status IN ('PENDING','VERIFIED','REJECTED')),
                    rejection_reason TEXT,
                    verified_by      UUID REFERENCES users(id),
                    verified_at      TIMESTAMPTZ,
                    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            migrationBuilder.Sql("CREATE INDEX idx_certification_ktv ON certifications (ktv_id, verify_status);");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Thứ tự ngược lại thứ tự tạo để không vướng khoá ngoại.
            migrationBuilder.Sql("DROP TABLE IF EXISTS certifications;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS coverage_areas;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS ktv_profiles;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS administrative_areas;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS otp_codes;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS users;");
            // Không drop extension postgis/pgcrypto: chúng có thể đang được dùng bởi
            // schema khác trong cùng database.
        }
    }
}
