using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
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
    }
}
