using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;

namespace Massage.Api.Modules.KtvProfiles;

public class KtvProfileService(AppDbContext db)
{
    private static Point ToPoint(double lon, double lat) =>
        new(lon, lat) { SRID = 4326 };

    public async Task<KtvProfile> CreateAsync(Guid userId, CreateKtvProfileDto dto, CancellationToken ct = default)
    {
        if (await db.KtvProfiles.AnyAsync(p => p.UserId == userId, ct))
            throw new ConflictException("Tài khoản này đã có hồ sơ KTV");

        await AssertAreasExistAsync(dto.CoverageAreaIds, ct);

        var profile = new KtvProfile
        {
            UserId = userId,
            FullName = dto.FullName,
            Slug = await GenerateUniqueSlugAsync(dto.FullName, ct),
            Bio = dto.Bio,
            YearsExperience = dto.YearsExperience ?? 0,
            BasePoint = ToPoint(dto.Lon, dto.Lat),
            BaseAddress = dto.BaseAddress,
            ServiceRadiusKm = dto.ServiceRadiusKm,
            VerificationStatus = VerificationStatuses.Pending,
        };

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.KtvProfiles.Add(profile);
        await db.SaveChangesAsync(ct);
        await ReplaceCoverageAreasAsync(profile.Id, dto.CoverageAreaIds, ct);
        await tx.CommitAsync(ct);

        return profile;
    }

    public async Task<KtvProfile> UpdateAsync(Guid userId, UpdateKtvProfileDto dto, CancellationToken ct = default)
    {
        var profile = await GetByUserIdAsync(userId, ct);
        await AssertAreasExistAsync(dto.CoverageAreaIds, ct);

        if (dto.FullName is not null) profile.FullName = dto.FullName;
        if (dto.Bio is not null) profile.Bio = dto.Bio;
        if (dto.YearsExperience.HasValue) profile.YearsExperience = dto.YearsExperience.Value;
        if (dto.BaseAddress is not null) profile.BaseAddress = dto.BaseAddress;
        if (dto.ServiceRadiusKm.HasValue) profile.ServiceRadiusKm = dto.ServiceRadiusKm.Value;
        if (dto.Lat.HasValue && dto.Lon.HasValue) profile.BasePoint = ToPoint(dto.Lon.Value, dto.Lat.Value);

        // Hồ sơ đã duyệt mà sửa thông tin thì phải duyệt lại: nếu không, KTV có thể
        // được duyệt bằng hồ sơ sạch rồi đổi sang nội dung khác sau lưng admin.
        if (profile.VerificationStatus == VerificationStatuses.Verified)
        {
            profile.VerificationStatus = VerificationStatuses.Pending;
            profile.RejectionReason = null;
        }

        profile.UpdatedAt = DateTimeOffset.UtcNow;

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.SaveChangesAsync(ct);
        if (dto.CoverageAreaIds is not null)
            await ReplaceCoverageAreasAsync(profile.Id, dto.CoverageAreaIds, ct);
        await tx.CommitAsync(ct);

        return profile;
    }

    public async Task<KtvProfile> GetByUserIdAsync(Guid userId, CancellationToken ct = default) =>
        await db.KtvProfiles.Include(p => p.Certifications).FirstOrDefaultAsync(p => p.UserId == userId, ct)
        ?? throw new NotFoundException("Chưa có hồ sơ KTV cho tài khoản này");

    public async Task<KtvProfile> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        await db.KtvProfiles.Include(p => p.Certifications).FirstOrDefaultAsync(p => p.Id == id, ct)
        ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

    /// <summary>
    /// Hồ sơ công khai, tra theo id hoặc theo slug (URL công khai là
    /// <c>/ktv/{slug}-{id}</c> nên frontend có sẵn cả hai).
    ///
    /// Chỉ trả hồ sơ đã duyệt: hồ sơ PENDING không xuất hiện trong kết quả tìm
    /// kiếm, nên nếu endpoint này vẫn trả về thì chỉ cần đoán id là xem được hồ sơ
    /// chưa qua kiểm duyệt — và trang đó có thể bị Google index trước khi ai kịp
    /// nhìn vào nội dung.
    /// </summary>
    public async Task<PublicKtvProfileDto> GetPublicAsync(
        Guid? id, string? slug, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles
            .AsNoTracking()
            .Include(p => p.Certifications)
            .FirstOrDefaultAsync(p =>
                p.VerificationStatus == VerificationStatuses.Verified &&
                (id != null ? p.Id == id : p.Slug == slug), ct)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

        var areas = await db.CoverageAreas
            .Where(c => c.KtvId == profile.Id)
            .Join(db.AdministrativeAreas, c => c.AreaId, a => a.Id, (_, a) => a)
            .OrderBy(a => a.Name)
            .Select(a => new PublicAreaDto(a.Id, a.Name, a.Slug, a.Level,
                a.Parent != null ? a.Parent.Slug : null))
            .ToListAsync(ct);

        var services = await db.KtvServices
            .Where(s => s.KtvId == profile.Id && s.Service!.IsActive)
            .OrderBy(s => s.Service!.SortOrder)
            .Select(s => new PublicKtvServiceDto(
                s.ServiceId, s.Service!.Name, s.Service.Slug, s.PriceFrom, s.DurationMin))
            .ToListAsync(ct);

        return new PublicKtvProfileDto(
            profile.Id,
            profile.FullName,
            profile.Slug,
            profile.Bio,
            profile.YearsExperience,
            Math.Round(profile.BasePoint.Y, 3),
            Math.Round(profile.BasePoint.X, 3),
            profile.ServiceRadiusKm,
            profile.RatingAvg,
            profile.RatingCount,
            profile.IsOnline,
            profile.CreatedAt,
            profile.Certifications
                .Where(c => c.VerifyStatus == VerificationStatuses.Verified)
                .OrderBy(c => c.Name)
                .Select(c => new PublicCertificationDto(c.Id, c.Name, c.IssuingOrg, c.IssuedAt))
                .ToList(),
            areas,
            services);
    }

    /// <summary>
    /// Khu vực KTV nhận phục vụ, kèm tên để hiển thị.
    ///
    /// Tách riêng khỏi <see cref="GetByUserIdAsync"/> vì nav property
    /// <c>CoverageAreas</c> chỉ có cặp id — form sửa hồ sơ cần biết KTV đang chọn
    /// những quận nào, không thể để họ chọn lại từ đầu mỗi lần sửa một dòng bio.
    /// </summary>
    public async Task<List<PublicAreaDto>> ListCoverageAreasAsync(
        Guid ktvId, CancellationToken ct = default) =>
        await db.CoverageAreas
            .Where(c => c.KtvId == ktvId)
            .Join(db.AdministrativeAreas, c => c.AreaId, a => a.Id, (_, a) => a)
            .OrderBy(a => a.Name)
            .Select(a => new PublicAreaDto(a.Id, a.Name, a.Slug, a.Level,
                a.Parent != null ? a.Parent.Slug : null))
            .ToListAsync(ct);

    /// <summary>
    /// Dữ liệu sinh <c>sitemap.xml</c>: chỉ hồ sơ đã duyệt, kèm mốc cập nhật để
    /// Google biết trang nào cần crawl lại.
    /// </summary>
    public async Task<List<SitemapEntryDto>> GetSitemapEntriesAsync(CancellationToken ct = default) =>
        await db.KtvProfiles
            .AsNoTracking()
            .Where(p => p.VerificationStatus == VerificationStatuses.Verified)
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => new SitemapEntryDto(p.Id, p.Slug, p.UpdatedAt))
            .ToListAsync(ct);

    public async Task<Certification> AddCertificationAsync(
        Guid userId, CreateCertificationDto dto, string fileUrl, CancellationToken ct = default)
    {
        var profile = await GetByUserIdAsync(userId, ct);

        var cert = new Certification
        {
            KtvId = profile.Id,
            Name = dto.Name,
            IssuingOrg = dto.IssuingOrg,
            IssuedAt = dto.IssuedAt,
            FileUrl = fileUrl,
            VerifyStatus = VerificationStatuses.Pending,
        };

        db.Certifications.Add(cert);
        await db.SaveChangesAsync(ct);
        return cert;
    }

    private async Task AssertAreasExistAsync(List<Guid>? areaIds, CancellationToken ct)
    {
        if (areaIds is null || areaIds.Count == 0) return;

        var distinct = areaIds.Distinct().ToList();
        var found = await db.AdministrativeAreas.CountAsync(a => distinct.Contains(a.Id), ct);
        if (found != distinct.Count)
            throw new BadRequestException("Có khu vực hoạt động không tồn tại");
    }

    private async Task ReplaceCoverageAreasAsync(Guid ktvId, List<Guid>? areaIds, CancellationToken ct)
    {
        await db.CoverageAreas.Where(c => c.KtvId == ktvId).ExecuteDeleteAsync(ct);
        if (areaIds is null || areaIds.Count == 0) return;

        db.CoverageAreas.AddRange(areaIds.Distinct()
            .Select(areaId => new CoverageArea { KtvId = ktvId, AreaId = areaId }));
        await db.SaveChangesAsync(ct);
    }

    private async Task<string> GenerateUniqueSlugAsync(string fullName, CancellationToken ct)
    {
        var baseSlug = SlugHelper.ToSlug(fullName);
        if (string.IsNullOrEmpty(baseSlug)) baseSlug = "ktv";

        var candidate = baseSlug;
        var suffix = 1;
        while (await db.KtvProfiles.AnyAsync(p => p.Slug == candidate, ct))
        {
            suffix++;
            candidate = $"{baseSlug}-{suffix}";
        }
        return candidate;
    }
}
