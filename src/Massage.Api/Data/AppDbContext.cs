using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Analytics.Entities;
using Massage.Api.Modules.Leads.Entities;
using Massage.Api.Modules.Promotions.Entities;
using Massage.Api.Modules.Reports.Entities;
using Massage.Api.Modules.Reviews.Entities;
using Massage.Api.Modules.ServiceCatalog.Entities;
using Massage.Api.Modules.Wallets.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<OtpCode> OtpCodes => Set<OtpCode>();
    public DbSet<KtvProfile> KtvProfiles => Set<KtvProfile>();
    public DbSet<Certification> Certifications => Set<Certification>();
    public DbSet<AdministrativeArea> AdministrativeAreas => Set<AdministrativeArea>();
    public DbSet<CoverageArea> CoverageAreas => Set<CoverageArea>();
    public DbSet<Service> Services => Set<Service>();
    public DbSet<KtvService> KtvServices => Set<KtvService>();
    public DbSet<Lead> Leads => Set<Lead>();
    public DbSet<AnalyticsEvent> AnalyticsEvents => Set<AnalyticsEvent>();
    public DbSet<Review> Reviews => Set<Review>();
    public DbSet<ProfileReport> ProfileReports => Set<ProfileReport>();
    public DbSet<WalletRow> Wallets => Set<WalletRow>();
    public DbSet<WalletTransactionRow> WalletTransactions => Set<WalletTransactionRow>();
    public DbSet<WalletHoldRow> WalletHolds => Set<WalletHoldRow>();
    public DbSet<PaymentIntentRow> PaymentIntents => Set<PaymentIntentRow>();
    public DbSet<PromotionPackageRow> PromotionPackages => Set<PromotionPackageRow>();
    public DbSet<CampaignRow> Campaigns => Set<CampaignRow>();
    public DbSet<SlotAllocationRow> SlotAllocations => Set<SlotAllocationRow>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.HasPostgresExtension("postgis");
        b.HasPostgresExtension("pgcrypto");

        b.Entity<User>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(15).IsRequired();
            e.Property(x => x.Email).HasColumnName("email").HasMaxLength(255);
            e.Property(x => x.PasswordHash).HasColumnName("password_hash");
            e.Property(x => x.Role).HasColumnName("role").HasMaxLength(20).IsRequired();
            e.Property(x => x.PhoneVerifiedAt).HasColumnName("phone_verified_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            e.HasIndex(x => x.Phone).IsUnique();
            e.HasIndex(x => x.Email).IsUnique();
        });

        b.Entity<OtpCode>(e =>
        {
            e.ToTable("otp_codes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.Phone).HasColumnName("phone").HasMaxLength(15).IsRequired();
            e.Property(x => x.CodeHash).HasColumnName("code_hash").IsRequired();
            e.Property(x => x.Purpose).HasColumnName("purpose").HasMaxLength(20).IsRequired();
            e.Property(x => x.Attempts).HasColumnName("attempts");
            e.Property(x => x.ConsumedAt).HasColumnName("consumed_at");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasIndex(x => new { x.Phone, x.Purpose, x.ExpiresAt }).HasDatabaseName("idx_otp_phone_active");
        });

        b.Entity<AdministrativeArea>(e =>
        {
            e.ToTable("administrative_areas");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            e.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(160).IsRequired();
            e.Property(x => x.Level).HasColumnName("level").HasMaxLength(20).IsRequired();
            e.Property(x => x.ParentId).HasColumnName("parent_id");
            e.Property(x => x.Code).HasColumnName("code").HasMaxLength(10);
            e.Property(x => x.EditorialNote).HasColumnName("editorial_note");
            // Trigger trong DB dựng cột này ở mọi INSERT/UPDATE, nên EF chỉ được đọc:
            // để EF ghi thì giá trị nó gửi lên (thường là NULL) sẽ bị trigger đè lại
            // ngay, và change tracker giữ bản cũ — đọc lại trong cùng context ra sai.
            e.Property(x => x.NameAscii).HasColumnName("name_ascii").HasMaxLength(400)
                .ValueGeneratedOnAddOrUpdate();
            e.Property(x => x.Centroid).HasColumnName("centroid")
                .HasColumnType("geography (Point, 4326)");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasOne(x => x.Parent).WithMany().HasForeignKey(x => x.ParentId);
            // Duy nhất trong phạm vi cha. Tỉnh có parent_id NULL mà UNIQUE coi mọi NULL
            // là khác nhau, nên ràng buộc này KHÔNG chặn được hai tỉnh trùng slug —
            // phần đó do partial index uq_area_root_slug lo, và EF không mô hình hoá
            // được mệnh đề WHERE nên nó chỉ tồn tại trong migration.
            e.HasIndex(x => new { x.ParentId, x.Slug }).IsUnique().HasDatabaseName("uq_area_parent_slug");
            e.HasIndex(x => x.ParentId).HasDatabaseName("idx_area_parent");
        });

        b.Entity<KtvProfile>(e =>
        {
            e.ToTable("ktv_profiles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.FullName).HasColumnName("full_name").HasMaxLength(120).IsRequired();
            e.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(160).IsRequired();
            e.Property(x => x.Bio).HasColumnName("bio");
            e.Property(x => x.YearsExperience).HasColumnName("years_experience");
            // Kiểu geography (không phải geometry) để ST_DWithin tính bán kính theo mét.
            e.Property(x => x.BasePoint).HasColumnName("base_point").HasColumnType("geography (Point, 4326)").IsRequired();
            e.Property(x => x.BaseAddress).HasColumnName("base_address").HasMaxLength(255);
            e.Property(x => x.BaseWardId).HasColumnName("base_ward_id");
            e.Property(x => x.BaseStreet).HasColumnName("base_street").HasMaxLength(255);
            e.Property(x => x.ServiceRadiusKm).HasColumnName("service_radius_km");
            e.Property(x => x.VerificationStatus).HasColumnName("verification_status").HasMaxLength(20).IsRequired();
            e.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            e.Property(x => x.VerifiedBy).HasColumnName("verified_by");
            e.Property(x => x.VerifiedAt).HasColumnName("verified_at");
            e.Property(x => x.RatingAvg).HasColumnName("rating_avg").HasPrecision(3, 2);
            e.Property(x => x.RatingCount).HasColumnName("rating_count");
            e.Property(x => x.ResponseRate).HasColumnName("response_rate").HasPrecision(5, 4);
            e.Property(x => x.ResponseCount).HasColumnName("response_count");
            e.Property(x => x.LeadCount).HasColumnName("lead_count");
            e.Property(x => x.IsOnline).HasColumnName("is_online");
            e.Property(x => x.LastActiveAt).HasColumnName("last_active_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasIndex(x => x.Slug).IsUnique();
            e.HasIndex(x => x.VerificationStatus).HasDatabaseName("idx_ktv_verification");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
            e.HasOne<AdministrativeArea>().WithMany().HasForeignKey(x => x.BaseWardId);
            e.HasIndex(x => x.BaseWardId).HasDatabaseName("idx_ktv_base_ward");
        });

        b.Entity<Certification>(e =>
        {
            e.ToTable("certifications");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(150).IsRequired();
            e.Property(x => x.IssuingOrg).HasColumnName("issuing_org").HasMaxLength(150);
            e.Property(x => x.IssuedAt).HasColumnName("issued_at");
            e.Property(x => x.FileUrl).HasColumnName("file_url").IsRequired();
            e.Property(x => x.VerifyStatus).HasColumnName("verify_status").HasMaxLength(20).IsRequired();
            e.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            e.Property(x => x.VerifiedBy).HasColumnName("verified_by");
            e.Property(x => x.VerifiedAt).HasColumnName("verified_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasOne(x => x.Ktv).WithMany(x => x.Certifications).HasForeignKey(x => x.KtvId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.KtvId, x.VerifyStatus }).HasDatabaseName("idx_certification_ktv");
        });

        b.Entity<CoverageArea>(e =>
        {
            e.ToTable("coverage_areas");
            e.HasKey(x => new { x.KtvId, x.AreaId });
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.AreaId).HasColumnName("area_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasOne<KtvProfile>().WithMany(x => x.CoverageAreas).HasForeignKey(x => x.KtvId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<AdministrativeArea>().WithMany().HasForeignKey(x => x.AreaId);
            e.HasIndex(x => x.AreaId).HasDatabaseName("idx_coverage_area");
        });

        b.Entity<Service>(e =>
        {
            e.ToTable("services");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            e.Property(x => x.Slug).HasColumnName("slug").HasMaxLength(160).IsRequired();
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.SortOrder).HasColumnName("sort_order");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasIndex(x => x.Slug).IsUnique();
        });

        b.Entity<KtvService>(e =>
        {
            e.ToTable("ktv_services");
            e.HasKey(x => new { x.KtvId, x.ServiceId });
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.ServiceId).HasColumnName("service_id");
            // NUMERIC chứ không phải float: giá đi vào so sánh và hiển thị, sai số
            // dấu phẩy động sẽ hiện ra thành "299999.99999" trên trang công khai.
            e.Property(x => x.PriceFrom).HasColumnName("price_from").HasPrecision(12, 0);
            e.Property(x => x.DurationMin).HasColumnName("duration_min");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasOne<KtvProfile>().WithMany().HasForeignKey(x => x.KtvId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Service).WithMany().HasForeignKey(x => x.ServiceId);
            e.HasIndex(x => x.ServiceId).HasDatabaseName("idx_ktv_service_service");
        });

        b.Entity<Lead>(e =>
        {
            e.ToTable("leads");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.CustomerUserId).HasColumnName("customer_user_id");
            e.Property(x => x.Channel).HasColumnName("channel").HasMaxLength(20).IsRequired();
            e.Property(x => x.AreaId).HasColumnName("area_id");
            e.Property(x => x.SourceUrl).HasColumnName("source_url");
            e.Property(x => x.Ip).HasColumnName("ip").HasMaxLength(45);
            e.Property(x => x.UserAgent).HasColumnName("user_agent");
            e.Property(x => x.DeviceHash).HasColumnName("device_hash").HasMaxLength(64);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasOne<KtvProfile>().WithMany().HasForeignKey(x => x.KtvId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<AdministrativeArea>().WithMany().HasForeignKey(x => x.AreaId);
            e.HasIndex(x => new { x.KtvId, x.CreatedAt }).HasDatabaseName("idx_lead_ktv_time");
        });

        b.Entity<AnalyticsEvent>(e =>
        {
            e.ToTable("analytics_events");
            // Khoá gồm cả cột phân mảnh: bảng partition không ép được tính duy nhất nếu
            // khoá không nói được hàng nằm ở partition nào. Khai đúng như DB để EF không
            // sinh ra truy vấn theo mỗi `id`.
            e.HasKey(x => new { x.Id, x.CreatedAt });
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.Type).HasColumnName("type").HasMaxLength(20).IsRequired();
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.AreaId).HasColumnName("area_id");
            e.Property(x => x.Position).HasColumnName("position");
            e.Property(x => x.ViewerHash).HasColumnName("viewer_hash").HasMaxLength(64);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            // Cố ý KHÔNG khai khoá ngoại tới ktv_profiles — xem ghi chú ở AnalyticsEvent
            // và ở migration: khoá ngoại trên bảng partition phải khai lại ở từng
            // partition, và job tạo partition hằng tháng sẽ phải nhớ điều đó mãi mãi.
            e.HasIndex(x => new { x.KtvId, x.Type, x.CreatedAt })
                .HasDatabaseName("idx_analytics_ktv_type_time");
        });

        b.Entity<Review>(e =>
        {
            e.ToTable("reviews");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.AuthorUserId).HasColumnName("author_user_id");
            e.Property(x => x.LeadId).HasColumnName("lead_id");
            e.Property(x => x.Rating).HasColumnName("rating");
            e.Property(x => x.Comment).HasColumnName("comment");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            e.Property(x => x.RejectionReason).HasColumnName("rejection_reason");
            e.Property(x => x.ModeratedBy).HasColumnName("moderated_by");
            e.Property(x => x.ModeratedAt).HasColumnName("moderated_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            e.HasOne<KtvProfile>().WithMany().HasForeignKey(x => x.KtvId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.AuthorUserId);
            e.HasIndex(x => new { x.KtvId, x.AuthorUserId }).IsUnique().HasDatabaseName("uq_review_ktv_author");
            e.HasIndex(x => new { x.KtvId, x.Status }).HasDatabaseName("idx_review_ktv_status");
        });

        b.Entity<ProfileReport>(e =>
        {
            e.ToTable("profile_reports");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.ReporterUserId).HasColumnName("reporter_user_id");
            e.Property(x => x.Reason).HasColumnName("reason").HasMaxLength(30).IsRequired();
            e.Property(x => x.Detail).HasColumnName("detail");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            e.Property(x => x.Ip).HasColumnName("ip").HasMaxLength(45);
            e.Property(x => x.UserAgent).HasColumnName("user_agent");
            e.Property(x => x.DeviceHash).HasColumnName("device_hash").HasMaxLength(64);
            e.Property(x => x.ReviewedBy).HasColumnName("reviewed_by");
            e.Property(x => x.ReviewedAt).HasColumnName("reviewed_at");
            e.Property(x => x.ResolutionNote).HasColumnName("resolution_note");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasOne<KtvProfile>().WithMany().HasForeignKey(x => x.KtvId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.ReporterUserId);
            e.HasIndex(x => new { x.Status, x.CreatedAt }).HasDatabaseName("idx_report_status_time");
            e.HasIndex(x => new { x.KtvId, x.Status }).HasDatabaseName("idx_report_ktv_status");
        });

        ConfigureMoney(b);
    }

    /// <summary>
    /// Cấu hình các bảng chạm tiền.
    ///
    /// Mọi cột tiền khai báo <c>HasPrecision</c> tường minh: để EF tự suy từ
    /// <c>decimal</c> sẽ ra <c>numeric</c> không giới hạn ở chỗ này và
    /// <c>numeric(18,2)</c> ở chỗ khác, rồi làm tròn âm thầm khi ghi.
    /// </summary>
    private static void ConfigureMoney(ModelBuilder b)
    {
        b.Entity<WalletRow>(e =>
        {
            e.ToTable("wallets");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Balance).HasColumnName("balance").HasPrecision(14, 0);
            e.Property(x => x.Held).HasColumnName("held").HasPrecision(14, 0);
            // Concurrency token: hai request cùng ghi một ví thì request thứ hai
            // ném DbUpdateConcurrencyException thay vì ghi đè im lặng.
            e.Property(x => x.Version).HasColumnName("version").IsConcurrencyToken();
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            e.HasIndex(x => x.UserId).IsUnique();
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        });

        b.Entity<WalletTransactionRow>(e =>
        {
            e.ToTable("wallet_transactions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.WalletId).HasColumnName("wallet_id");
            e.Property(x => x.Type).HasColumnName("type").HasMaxLength(20).IsRequired();
            e.Property(x => x.Amount).HasColumnName("amount").HasPrecision(14, 0);
            e.Property(x => x.BalanceAfter).HasColumnName("balance_after").HasPrecision(14, 0);
            e.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(120).IsRequired();
            e.Property(x => x.CampaignId).HasColumnName("campaign_id");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasIndex(x => x.IdempotencyKey).IsUnique().HasDatabaseName("uq_wallet_txn_idem");
            e.HasIndex(x => new { x.WalletId, x.CreatedAt }).HasDatabaseName("idx_wallet_txn_wallet");
            e.HasOne<WalletRow>().WithMany().HasForeignKey(x => x.WalletId);
        });

        b.Entity<WalletHoldRow>(e =>
        {
            e.ToTable("wallet_holds");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.WalletId).HasColumnName("wallet_id");
            e.Property(x => x.Amount).HasColumnName("amount").HasPrecision(14, 0);
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasColumnName("updated_at").HasDefaultValueSql("now()");
            e.HasIndex(x => new { x.Status, x.ExpiresAt }).HasDatabaseName("idx_hold_expiry");
            e.HasOne<WalletRow>().WithMany().HasForeignKey(x => x.WalletId);
        });

        b.Entity<PaymentIntentRow>(e =>
        {
            e.ToTable("payment_intents");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Amount).HasColumnName("amount").HasPrecision(14, 0);
            e.Property(x => x.Provider).HasColumnName("provider").HasMaxLength(20).IsRequired();
            e.Property(x => x.ProviderRef).HasColumnName("provider_ref").HasMaxLength(64).IsRequired();
            e.Property(x => x.ProviderTxnId).HasColumnName("provider_txn_id").HasMaxLength(64);
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            e.Property(x => x.RawCallback).HasColumnName("raw_callback");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.Property(x => x.CompletedAt).HasColumnName("completed_at");
            e.HasIndex(x => new { x.Provider, x.ProviderRef }).IsUnique().HasDatabaseName("uq_payment_intent_ref");
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId);
        });

        b.Entity<PromotionPackageRow>(e =>
        {
            e.ToTable("promotion_packages");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.Code).HasColumnName("code").HasMaxLength(40).IsRequired();
            e.Property(x => x.Name).HasColumnName("name").HasMaxLength(120).IsRequired();
            e.Property(x => x.Type).HasColumnName("type").HasMaxLength(20).IsRequired();
            e.Property(x => x.Description).HasColumnName("description");
            e.Property(x => x.Price).HasColumnName("price").HasPrecision(12, 0);
            e.Property(x => x.DurationDays).HasColumnName("duration_days");
            e.Property(x => x.DurationHours).HasColumnName("duration_hours");
            e.Property(x => x.MaxSlotsPerArea).HasColumnName("max_slots_per_area");
            e.Property(x => x.IsActive).HasColumnName("is_active");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasIndex(x => x.Code).IsUnique();
        });

        b.Entity<CampaignRow>(e =>
        {
            e.ToTable("campaigns");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.KtvId).HasColumnName("ktv_id");
            e.Property(x => x.PackageId).HasColumnName("package_id");
            e.Property(x => x.AreaId).HasColumnName("area_id");
            e.Property(x => x.PackageType).HasColumnName("package_type").HasMaxLength(20).IsRequired();
            e.Property(x => x.BoostPoints).HasColumnName("boost_points");
            e.Property(x => x.PricePaid).HasColumnName("price_paid").HasPrecision(12, 0);
            e.Property(x => x.StartAt).HasColumnName("start_at");
            e.Property(x => x.EndAt).HasColumnName("end_at");
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
            e.Property(x => x.CancelledAt).HasColumnName("cancelled_at");
            e.Property(x => x.RefundedAmount).HasColumnName("refunded_amount").HasPrecision(12, 0);
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            // Hot path của search: campaign đang chạy theo khu vực.
            e.HasIndex(x => new { x.AreaId, x.Status, x.EndAt }).HasDatabaseName("idx_campaign_active_window");
            e.HasIndex(x => new { x.KtvId, x.Status }).HasDatabaseName("idx_campaign_ktv");
            e.HasOne<KtvProfile>().WithMany().HasForeignKey(x => x.KtvId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<AdministrativeArea>().WithMany().HasForeignKey(x => x.AreaId);
            e.HasOne<PromotionPackageRow>().WithMany().HasForeignKey(x => x.PackageId);
        });

        b.Entity<SlotAllocationRow>(e =>
        {
            e.ToTable("slot_allocations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id").HasDefaultValueSql("gen_random_uuid()");
            e.Property(x => x.CampaignId).HasColumnName("campaign_id");
            e.Property(x => x.AreaId).HasColumnName("area_id");
            e.Property(x => x.PackageType).HasColumnName("package_type").HasMaxLength(20).IsRequired();
            e.Property(x => x.WindowStart).HasColumnName("window_start");
            e.Property(x => x.SlotIndex).HasColumnName("slot_index");
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasIndex(x => new { x.AreaId, x.PackageType, x.WindowStart, x.SlotIndex })
                .IsUnique().HasDatabaseName("uq_slot");
            e.HasIndex(x => x.CampaignId).HasDatabaseName("idx_slot_campaign");
            e.HasOne<CampaignRow>().WithMany().HasForeignKey(x => x.CampaignId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
