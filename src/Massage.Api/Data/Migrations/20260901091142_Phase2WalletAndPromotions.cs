using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Massage.Api.Data.Migrations
{
    /// <summary>
    /// Schema Phase 2: ví, sổ cái, hold, catalog gói, campaign và cấp phát slot.
    ///
    /// Ba ràng buộc dưới đây là trọng tài cuối cùng của toàn bộ vùng chạm tiền.
    /// Chúng không được nới lỏng vì lý do "code đã kiểm tra rồi": code kiểm tra
    /// rồi ghi luôn có một khe ở giữa, còn Redis lock ở Phase 3 thì có thể hết hạn
    /// giữa chừng khi transaction chạy lâu hơn dự kiến.
    ///
    ///   uq_wallet_txn_idem  — một khoá chống lặp chỉ ghi được một lần
    ///   uq_slot             — một slot chỉ bán được cho một người
    ///   chk_wallet_amounts  — số dư không âm, phần bị giữ không vượt số dư
    /// </summary>
    public partial class Phase2WalletAndPromotions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE wallets (
                    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id    UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    -- NUMERIC(14,0): VND không có phần lẻ, và không bao giờ dùng float
                    -- cho tiền — sai số dấu phẩy động làm đối soát lệch dần.
                    balance    NUMERIC(14,0) NOT NULL DEFAULT 0,
                    -- Phần đang bị giữ cho lần mua chưa chốt. Nằm TRONG balance.
                    held       NUMERIC(14,0) NOT NULL DEFAULT 0,
                    version    INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT chk_wallet_amounts
                        CHECK (balance >= 0 AND held >= 0 AND held <= balance)
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE wallet_transactions (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    wallet_id       UUID NOT NULL REFERENCES wallets(id),
                    type            VARCHAR(20) NOT NULL
                                    CHECK (type IN ('TOPUP','CAPTURE','REFUND','ADJUST')),
                    -- Có dấu. Sổ cái chỉ chứa dòng làm đổi số dư, nên bất biến
                    -- SUM(amount) = balance đúng theo nghĩa đen và kiểm được bằng
                    -- một câu SQL. Giữ/nhả tiền không đổi số dư nên nằm ở wallet_holds.
                    amount          NUMERIC(14,0) NOT NULL,
                    balance_after   NUMERIC(14,0) NOT NULL,
                    idempotency_key VARCHAR(120) NOT NULL,
                    campaign_id     UUID,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT uq_wallet_txn_idem UNIQUE (idempotency_key)
                );
                """);

            migrationBuilder.Sql(
                "CREATE INDEX idx_wallet_txn_wallet ON wallet_transactions (wallet_id, created_at DESC);");

            migrationBuilder.Sql("""
                CREATE TABLE wallet_holds (
                    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    wallet_id  UUID NOT NULL REFERENCES wallets(id),
                    amount     NUMERIC(14,0) NOT NULL CHECK (amount > 0),
                    status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                               CHECK (status IN ('ACTIVE','CAPTURED','RELEASED','EXPIRED')),
                    -- Bắt buộc có hạn: process chết giữa luồng mua thì tiền của KTV
                    -- không được treo vĩnh viễn.
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            // Partial index: tác vụ dọn dẹp chỉ quan tâm hold còn ACTIVE, và tập đó
            // nhỏ hơn nhiều so với toàn bộ lịch sử hold.
            migrationBuilder.Sql("""
                CREATE INDEX idx_hold_expiry ON wallet_holds (status, expires_at)
                WHERE status = 'ACTIVE';
                """);

            migrationBuilder.Sql("""
                CREATE TABLE payment_intents (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id         UUID NOT NULL REFERENCES users(id),
                    amount          NUMERIC(14,0) NOT NULL CHECK (amount > 0),
                    provider        VARCHAR(20) NOT NULL,
                    provider_ref    VARCHAR(64) NOT NULL,
                    provider_txn_id VARCHAR(64),
                    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                                    CHECK (status IN ('PENDING','SUCCEEDED','FAILED')),
                    -- Payload thô của cổng, giữ để đối chất khi có tranh chấp.
                    raw_callback    TEXT,
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    completed_at    TIMESTAMPTZ,
                    CONSTRAINT uq_payment_intent_ref UNIQUE (provider, provider_ref)
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE promotion_packages (
                    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    code               VARCHAR(40) NOT NULL UNIQUE,
                    name               VARCHAR(120) NOT NULL,
                    type               VARCHAR(20) NOT NULL
                                       CHECK (type IN ('VIP_PIN','FEATURED_BADGE','INSTANT_BOOST')),
                    description        TEXT,
                    price              NUMERIC(12,0) NOT NULL CHECK (price >= 0),
                    duration_days      INTEGER NOT NULL CHECK (duration_days > 0),
                    max_slots_per_area INTEGER NOT NULL CHECK (max_slots_per_area > 0),
                    is_active          BOOLEAN NOT NULL DEFAULT true,
                    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
                );
                """);

            migrationBuilder.Sql("""
                CREATE TABLE campaigns (
                    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    ktv_id          UUID NOT NULL REFERENCES ktv_profiles(id) ON DELETE CASCADE,
                    package_id      UUID NOT NULL REFERENCES promotion_packages(id),
                    area_id         UUID NOT NULL REFERENCES administrative_areas(id),
                    -- Sao chép từ gói lúc mua: đổi giá trong catalog không được làm
                    -- thay đổi campaign đã bán.
                    package_type    VARCHAR(20) NOT NULL,
                    boost_points    INTEGER NOT NULL,
                    price_paid      NUMERIC(12,0) NOT NULL CHECK (price_paid >= 0),
                    start_at        TIMESTAMPTZ NOT NULL,
                    end_at          TIMESTAMPTZ NOT NULL,
                    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                                    CHECK (status IN ('ACTIVE','EXPIRED','CANCELLED')),
                    cancelled_at    TIMESTAMPTZ,
                    refunded_amount NUMERIC(12,0) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
                    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT chk_campaign_window CHECK (end_at > start_at),
                    CONSTRAINT chk_campaign_refund CHECK (refunded_amount <= price_paid)
                );
                """);

            // Hot path của search: campaign đang chạy trong một khu vực.
            migrationBuilder.Sql(
                "CREATE INDEX idx_campaign_active_window ON campaigns (area_id, status, end_at);");
            migrationBuilder.Sql("CREATE INDEX idx_campaign_ktv ON campaigns (ktv_id, status);");

            migrationBuilder.Sql("""
                CREATE TABLE slot_allocations (
                    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
                    area_id      UUID NOT NULL REFERENCES administrative_areas(id),
                    package_type VARCHAR(20) NOT NULL,
                    -- Một campaign N ngày sinh N dòng, mỗi khung ngày một dòng:
                    -- UNIQUE chặn được trùng giá trị rời rạc, không diễn đạt được
                    -- "hai khoảng thời gian giao nhau".
                    window_start TIMESTAMPTZ NOT NULL,
                    slot_index   INTEGER NOT NULL CHECK (slot_index >= 0),
                    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
                    CONSTRAINT uq_slot UNIQUE (area_id, package_type, window_start, slot_index)
                );
                """);

            migrationBuilder.Sql("CREATE INDEX idx_slot_campaign ON slot_allocations (campaign_id);");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Ngược thứ tự tạo để không vướng khoá ngoại.
            migrationBuilder.Sql("DROP TABLE IF EXISTS slot_allocations;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS campaigns;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS promotion_packages;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS payment_intents;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS wallet_holds;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS wallet_transactions;");
            migrationBuilder.Sql("DROP TABLE IF EXISTS wallets;");
        }
    }
}
