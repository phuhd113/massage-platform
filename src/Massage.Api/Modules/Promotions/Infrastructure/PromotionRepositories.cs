using Massage.Api.Data;
using Massage.Api.Modules.Promotions.Entities;
using Massage.Promotion.Domain;
using Massage.Promotion.Domain.Ports;
using Microsoft.EntityFrameworkCore;
using DomainCampaign = Massage.Promotion.Domain.Campaign;

namespace Massage.Api.Modules.Promotions.Infrastructure;

public class PromotionCatalog(AppDbContext db) : IPromotionCatalog
{
    public async Task<PromotionPackage?> FindAsync(Guid packageId, CancellationToken ct = default)
    {
        var row = await db.PromotionPackages.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == packageId && p.IsActive, ct);

        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<PromotionPackage>> ListActiveAsync(CancellationToken ct = default)
    {
        var rows = await db.PromotionPackages.AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.Price)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    internal static PromotionPackage Map(PromotionPackageRow r) =>
        new(r.Id, r.Code, r.Name, r.Type, r.Price, r.DurationDays, r.MaxSlotsPerArea, r.IsActive);
}

public class CampaignRepository(AppDbContext db) : ICampaignRepository
{
    public async Task AddAsync(DomainCampaign campaign, CancellationToken ct = default)
    {
        db.Campaigns.Add(new CampaignRow
        {
            Id = campaign.Id,
            KtvId = campaign.KtvId,
            PackageId = campaign.PackageId,
            AreaId = campaign.AreaId,
            PackageType = campaign.PackageType,
            BoostPoints = campaign.BoostPoints,
            PricePaid = campaign.PricePaid,
            // timestamptz chỉ nhận offset 0. Chuẩn hoá ở biên lưu trữ thay vì tin
            // rằng mọi nơi gọi tới đều đã truyền UTC.
            StartAt = campaign.StartAt.ToUniversalTime(),
            EndAt = campaign.EndAt.ToUniversalTime(),
            Status = campaign.Status,
        });
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(DomainCampaign campaign, CancellationToken ct = default) =>
        await db.Campaigns.Where(c => c.Id == campaign.Id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, campaign.Status)
                .SetProperty(c => c.CancelledAt, campaign.CancelledAt.HasValue ? campaign.CancelledAt.Value.ToUniversalTime() : null)
                .SetProperty(c => c.RefundedAmount, campaign.RefundedAmount), ct);

    public async Task<DomainCampaign?> FindAsync(Guid campaignId, CancellationToken ct = default)
    {
        var row = await db.Campaigns.AsNoTracking().FirstOrDefaultAsync(c => c.Id == campaignId, ct);
        return row is null ? null : Map(row);
    }

    public async Task<IReadOnlyList<DomainCampaign>> ListForKtvAsync(
        Guid ktvId, CancellationToken ct = default)
    {
        var rows = await db.Campaigns.AsNoTracking()
            .Where(c => c.KtvId == ktvId)
            .OrderByDescending(c => c.StartAt)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<DomainCampaign>> ListDueForExpiryAsync(
        DateTimeOffset now, int limit, CancellationToken ct = default)
    {
        var rows = await db.Campaigns.AsNoTracking()
            .Where(c => c.Status == CampaignStatuses.Active && c.EndAt <= now.ToUniversalTime())
            .OrderBy(c => c.EndAt)
            .Take(limit)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    private static DomainCampaign Map(CampaignRow r) =>
        new(r.Id, r.KtvId, r.PackageId, r.AreaId, r.PackageType, r.BoostPoints,
            r.PricePaid, r.StartAt, r.EndAt, r.Status);
}
