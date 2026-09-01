using System.Security.Cryptography;
using System.Text;
using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Leads.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Leads;

public class LeadService(AppDbContext db)
{
    /// <summary>
    /// Cùng một thiết bị bấm gọi lại trong khoảng này được tính là một lead.
    ///
    /// Khách gọi hụt rồi bấm lại là hành vi bình thường, không phải nhu cầu mới.
    /// Gộp lại ngay từ Phase 1 vì tới Phase 2 lead trở thành số liệu KTV dùng để
    /// đánh giá gói quảng cáo có đáng tiền không — dữ liệu thổi phồng từ đầu sẽ
    /// không sửa lại được về sau.
    /// </summary>
    private static readonly TimeSpan DedupeWindow = TimeSpan.FromMinutes(5);

    public async Task<LeadCreatedDto> CreateAsync(
        CreateLeadDto dto,
        Guid? customerUserId,
        string? ip,
        string? userAgent,
        CancellationToken ct = default)
    {
        var ktv = await db.KtvProfiles
            .Where(k => k.Id == dto.KtvId && k.VerificationStatus == VerificationStatuses.Verified)
            .Join(db.Users, k => k.UserId, u => u.Id, (k, u) => new { k.Id, u.Phone })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Không tìm thấy KTV đang hoạt động");

        if (dto.AreaId is not null &&
            !await db.AdministrativeAreas.AnyAsync(a => a.Id == dto.AreaId, ct))
            throw new BadRequestException("Khu vực không tồn tại");

        var deviceHash = ComputeDeviceHash(ip, userAgent, customerUserId);
        var since = DateTimeOffset.UtcNow - DedupeWindow;

        var recent = await db.Leads
            .Where(l => l.KtvId == dto.KtvId
                        && l.Channel == dto.Channel
                        && l.DeviceHash == deviceHash
                        && l.CreatedAt >= since)
            .OrderByDescending(l => l.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (recent is not null)
            return new LeadCreatedDto(recent.Id, recent.CreatedAt, Deduplicated: true, ktv.Phone);

        var lead = new Lead
        {
            KtvId = dto.KtvId,
            CustomerUserId = customerUserId,
            Channel = dto.Channel,
            AreaId = dto.AreaId,
            SourceUrl = dto.SourceUrl,
            Ip = ip,
            UserAgent = Truncate(userAgent, 512),
            DeviceHash = deviceHash,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.Leads.Add(lead);
        await db.SaveChangesAsync(ct);

        // Bộ đếm denormalize để trang hồ sơ không phải COUNT(*) trên bảng lead mỗi
        // lần render. ExecuteUpdate ghi thẳng xuống DB và bỏ qua change tracker —
        // không đọc lại lead_count qua context này và tin vào kết quả.
        await db.KtvProfiles
            .Where(k => k.Id == dto.KtvId)
            .ExecuteUpdateAsync(s => s.SetProperty(k => k.LeadCount, k => k.LeadCount + 1), ct);

        return new LeadCreatedDto(lead.Id, lead.CreatedAt, Deduplicated: false, ktv.Phone);
    }

    /// <summary>
    /// Định danh thiết bị ở mức "đủ để gộp lần bấm lặp", không phải fingerprint đầy đủ.
    /// Hash thay vì lưu thẳng ip+user agent làm khoá để không nhân bản dữ liệu định
    /// danh ra thêm một cột nữa.
    /// </summary>
    internal static string ComputeDeviceHash(string? ip, string? userAgent, Guid? userId)
    {
        var raw = $"{userId?.ToString() ?? "anon"}|{ip ?? "-"}|{userAgent ?? "-"}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
