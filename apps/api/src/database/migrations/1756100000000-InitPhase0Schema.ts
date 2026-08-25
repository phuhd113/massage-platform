import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitPhase0Schema1756100000000 implements MigrationInterface {
  name = 'InitPhase0Schema1756100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      CREATE TABLE users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone         VARCHAR(15) NOT NULL UNIQUE,
        email         VARCHAR(255) UNIQUE,
        password_hash TEXT,
        role          VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER'
                      CHECK (role IN ('CUSTOMER','KTV','ADMIN')),
        phone_verified_at TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // OTP lưu dạng hash: nếu DB bị lộ, mã còn hiệu lực không dùng lại được để chiếm tài khoản.
    await queryRunner.query(`
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
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_otp_phone_active ON otp_codes (phone, purpose, expires_at)`,
    );

    await queryRunner.query(`
      CREATE TABLE administrative_areas (
        id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name      VARCHAR(120) NOT NULL,
        slug      VARCHAR(160) NOT NULL,
        level     VARCHAR(20) NOT NULL CHECK (level IN ('PROVINCE','DISTRICT','WARD')),
        parent_id UUID REFERENCES administrative_areas(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_area_slug_level UNIQUE (slug, level)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_area_parent ON administrative_areas (parent_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE ktv_profiles (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id             UUID NOT NULL UNIQUE REFERENCES users(id),
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
        rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 0,
        rating_count        INT NOT NULL DEFAULT 0,
        is_online           BOOLEAN NOT NULL DEFAULT false,
        last_active_at      TIMESTAMPTZ,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    // Thiếu index GiST này thì geo-search vẫn đúng nhưng chậm dần tới mức timeout ở production.
    await queryRunner.query(
      `CREATE INDEX idx_ktv_base_point ON ktv_profiles USING GIST (base_point)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_ktv_verification ON ktv_profiles (verification_status)`,
    );

    await queryRunner.query(`
      CREATE TABLE coverage_areas (
        ktv_id     UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
        area_id    UUID NOT NULL REFERENCES administrative_areas(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (ktv_id, area_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_coverage_area ON coverage_areas (area_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE certifications (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ktv_id        UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
        name          VARCHAR(150) NOT NULL,
        issuing_org   VARCHAR(150),
        issued_at     DATE,
        file_url      TEXT NOT NULL,
        verify_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                      CHECK (verify_status IN ('PENDING','VERIFIED','REJECTED')),
        rejection_reason TEXT,
        verified_by   UUID REFERENCES users(id),
        verified_at   TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_certification_ktv ON certifications (ktv_id, verify_status)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS certifications`);
    await queryRunner.query(`DROP TABLE IF EXISTS coverage_areas`);
    await queryRunner.query(`DROP TABLE IF EXISTS ktv_profiles`);
    await queryRunner.query(`DROP TABLE IF EXISTS administrative_areas`);
    await queryRunner.query(`DROP TABLE IF EXISTS otp_codes`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
