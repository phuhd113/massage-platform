using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Leads.Entities;
using Massage.Api.Modules.Reviews.Entities;
using Massage.Api.Modules.ServiceCatalog.Entities;
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
    public DbSet<Review> Reviews => Set<Review>();

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
            e.Property(x => x.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
            e.HasOne(x => x.Parent).WithMany().HasForeignKey(x => x.ParentId);
            e.HasIndex(x => new { x.Slug, x.Level }).IsUnique().HasDatabaseName("uq_area_slug_level");
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
    }
}
