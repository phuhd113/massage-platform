using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Admin;

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int Limit);

public class AdminService(AppDbContext db)
{
    public async Task<PagedResult<KtvProfile>> ListProfilesAsync(
        string status, int page, int limit, CancellationToken ct = default)
    {
        var query = db.KtvProfiles
            .Include(p => p.Certifications)
            .Where(p => p.VerificationStatus == status);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(p => p.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);

        return new PagedResult<KtvProfile>(items, total, page, limit);
    }

    public async Task<KtvProfile> DecideProfileAsync(
        Guid ktvId, Guid adminId, VerifyDecisionDto dto, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles.FirstOrDefaultAsync(p => p.Id == ktvId, ct)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

        profile.VerificationStatus = dto.Decision;
        profile.RejectionReason = dto.Decision == VerificationStatuses.Rejected ? dto.Reason : null;
        profile.VerifiedBy = adminId;
        profile.VerifiedAt = DateTimeOffset.UtcNow;
        profile.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return profile;
    }

    public async Task<Certification> DecideCertificationAsync(
        Guid certId, Guid adminId, VerifyDecisionDto dto, CancellationToken ct = default)
    {
        var cert = await db.Certifications.FirstOrDefaultAsync(c => c.Id == certId, ct)
            ?? throw new NotFoundException("Không tìm thấy chứng chỉ");

        cert.VerifyStatus = dto.Decision;
        cert.RejectionReason = dto.Decision == VerificationStatuses.Rejected ? dto.Reason : null;
        cert.VerifiedBy = adminId;
        cert.VerifiedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return cert;
    }
}
