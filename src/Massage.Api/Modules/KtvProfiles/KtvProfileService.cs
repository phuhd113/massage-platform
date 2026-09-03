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
        await AssertWardExistsAsync(dto.BaseWardId, ct);

        var profile = new KtvProfile
        {
            UserId = userId,
            FullName = dto.FullName,
            Slug = await GenerateUniqueSlugAsync(dto.FullName, ct),
            Bio = dto.Bio,
            YearsExperience = dto.YearsExperience ?? 0,
            BasePoint = ToPoint(dto.Lon, dto.Lat),
            BaseAddress = dto.BaseAddress,
            BaseWardId = dto.BaseWardId,
            BaseStreet = dto.BaseStreet,
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
        await AssertWardExistsAsync(dto.BaseWardId, ct);

        if (dto.FullName is not null) profile.FullName = dto.FullName;
        if (dto.Bio is not null) profile.Bio = dto.Bio;
        if (dto.YearsExperience.HasValue) profile.YearsExperience = dto.YearsExperience.Value;
        if (dto.BaseAddress is not null) profile.BaseAddress = dto.BaseAddress;
        if (dto.BaseWardId.HasValue) profile.BaseWardId = dto.BaseWardId;
        if (dto.BaseStreet is not null) profile.BaseStreet = dto.BaseStreet;
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
    /// Địa chỉ hành chính của hồ sơ, dựng bằng hai bước join lên <c>parent_id</c> từ
    /// phường đã lưu. Trả cả tên lẫn slug để form sửa hiển thị được lựa chọn hiện tại
    /// mà không phải gọi thêm ba lượt tra khu vực.
    ///
    /// Chỉ nhận phường làm điểm xuất phát: <c>base_ward_id</c> được validate đúng cấp
    /// ở đường ghi, nên gặp cấp khác ở đây là dữ liệu hỏng chứ không phải trường hợp
    /// hợp lệ — trả null để trang vẫn hiện được thay vì ném lỗi.
    /// </summary>
    public async Task<BaseAreaDto?> GetBaseAreaAsync(Guid? wardId, CancellationToken ct = default)
    {
        if (wardId is null) return null;

        return await db.AdministrativeAreas
            .Where(w => w.Id == wardId && w.Level == AreaLevels.Ward)
            .Select(w => new BaseAreaDto(
                w.Id, w.Name, w.Slug,
                w.Parent!.Id, w.Parent.Name, w.Parent.Slug,
                w.Parent.Parent!.Id, w.Parent.Parent.Name, w.Parent.Parent.Slug))
            .FirstOrDefaultAsync(ct);
    }

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

    /// <summary>
    /// Khu vực hoạt động phải tồn tại **và phải ở cấp quận/huyện**.
    ///
    /// Kiểm cấp là bắt buộc chứ không thừa: đặt một tỉnh làm khu vực hoạt động sẽ
    /// khiến KTV được đếm hai lần ở rollup tỉnh, còn đặt một phường thì cộng vào cha
    /// của nó — tức vào một quận, như thể quận đó là tỉnh. Cả hai đều làm sai con số
    /// quyết định trang nào được index.
    /// </summary>
    private async Task AssertAreasExistAsync(List<Guid>? areaIds, CancellationToken ct)
    {
        if (areaIds is null || areaIds.Count == 0) return;

        var distinct = areaIds.Distinct().ToList();
        var found = await db.AdministrativeAreas
            .CountAsync(a => distinct.Contains(a.Id) && a.Level == AreaLevels.District, ct);

        if (found != distinct.Count)
            throw new BadRequestException("Khu vực hoạt động phải là quận/huyện có thật");
    }

    /// <summary>
    /// Phường/xã của địa chỉ cơ sở phải tồn tại và đúng cấp phường. Nhận nhầm một quận
    /// ở đây sẽ làm địa chỉ hiển thị thiếu một cấp mà không có lỗi nào hiện ra.
    /// </summary>
    private async Task AssertWardExistsAsync(Guid? wardId, CancellationToken ct)
    {
        if (wardId is null) return;

        var ok = await db.AdministrativeAreas
            .AnyAsync(a => a.Id == wardId && a.Level == AreaLevels.Ward, ct);

        if (!ok) throw new BadRequestException("Phường/xã của địa chỉ không hợp lệ");
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
