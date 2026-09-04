using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Admin;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Leads;
using Massage.Api.Modules.Reports.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Reports;

public class ReportService(AppDbContext db)
{
    /// <summary>
    /// Cùng một thiết bị báo cáo lại cùng một hồ sơ trong khoảng này được gộp làm một.
    ///
    /// Rộng hơn hẳn cửa sổ gộp lead (5 phút) vì đây là hành vi khác: người bấm gọi lại
    /// sau 10 phút thường là một ý định mới, còn người báo cáo lại cùng hồ sơ sau 10
    /// phút gần như chắc chắn vẫn đang nói về đúng chuyện đó. Và số báo cáo còn chờ
    /// xử lý của một hồ sơ là con số admin dùng để xếp thứ tự đọc, nên để một người
    /// tự bơm nó lên là làm hỏng chính thước đo mức độ nghiêm trọng.
    /// </summary>
    private static readonly TimeSpan DedupeWindow = TimeSpan.FromHours(24);

    /// <summary>
    /// Ghi nhận một báo cáo vi phạm.
    ///
    /// Cố ý **không** đổi trạng thái hồ sơ: xem ghi chú ở <see cref="ProfileReport"/>.
    /// Báo cáo chỉ đưa hồ sơ vào hàng đợi cho admin.
    /// </summary>
    public async Task<ReportCreatedDto> CreateAsync(
        CreateReportDto dto,
        Guid? reporterUserId,
        string? ip,
        string? userAgent,
        CancellationToken ct = default)
    {
        // Nhận báo cáo cho mọi hồ sơ tồn tại, không chỉ hồ sơ đã duyệt — khác với lead.
        // Hồ sơ vừa bị gỡ xuống PENDING vì nghi vấn chính là hồ sơ cần thêm bằng chứng
        // nhất, và từ chối báo cáo ở đó là làm mất đúng thông tin đang cần.
        if (!await db.KtvProfiles.AnyAsync(k => k.Id == dto.KtvId, ct))
            throw new NotFoundException("Không tìm thấy hồ sơ KTV");

        var deviceHash = LeadService.ComputeDeviceHash(ip, userAgent, reporterUserId);
        var since = DateTimeOffset.UtcNow - DedupeWindow;

        var recent = await db.ProfileReports
            .Where(r => r.KtvId == dto.KtvId
                        && r.DeviceHash == deviceHash
                        && r.CreatedAt >= since)
            .OrderByDescending(r => r.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (recent is not null)
            return new ReportCreatedDto(recent.Id, recent.CreatedAt, Deduplicated: true);

        var report = new ProfileReport
        {
            KtvId = dto.KtvId,
            ReporterUserId = reporterUserId,
            Reason = dto.Reason,
            Detail = dto.Detail,
            Status = ProfileReportStatuses.Pending,
            Ip = ip,
            UserAgent = Truncate(userAgent, 512),
            DeviceHash = deviceHash,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        db.ProfileReports.Add(report);
        await db.SaveChangesAsync(ct);

        return new ReportCreatedDto(report.Id, report.CreatedAt, Deduplicated: false);
    }

    /// <summary>
    /// Hàng đợi cho admin, xếp theo mức độ chứ không theo thời gian.
    ///
    /// Thứ tự: số báo cáo còn chờ của hồ sơ (giảm dần) → thời điểm báo cáo (cũ trước).
    /// Xếp thuần theo thời gian thì một hồ sơ bị hai mươi người báo cáo nằm lẫn giữa
    /// những dòng lẻ tẻ, và thứ đáng xử lý trước lại bị đọc sau cùng.
    /// </summary>
    public async Task<PagedResult<ReportQueueItemDto>> ListAsync(
        string status, int page, int limit, CancellationToken ct = default)
    {
        // Số báo cáo còn chờ của hồ sơ, đếm bằng subquery tương quan chứ không join
        // với một nhóm đã gộp sẵn: EF không dịch được left-join tới GroupBy, và bản
        // viết bằng join sẽ ném lỗi lúc chạy chứ không lúc biên dịch.
        //
        // Cố ý không phụ thuộc bộ lọc `status` ở dưới: khi admin xem danh sách đã xử
        // lý, con số này vẫn phải trả lời "hồ sơ đó hiện còn bao nhiêu việc chưa làm".
        var query =
            from r in db.ProfileReports.Where(r => r.Status == status)
            join k in db.KtvProfiles on r.KtvId equals k.Id
            select new
            {
                Report = r,
                k.FullName,
                k.VerificationStatus,
                PendingCount = db.ProfileReports.Count(p =>
                    p.KtvId == r.KtvId && p.Status == ProfileReportStatuses.Pending),
            };

        var total = await query.CountAsync(ct);

        var rows = await query
            .OrderByDescending(x => x.PendingCount)
            .ThenBy(x => x.Report.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);

        var items = rows
            .Select(x => new ReportQueueItemDto(
                ToDto(x.Report, x.FullName, x.VerificationStatus),
                x.PendingCount))
            .ToList();

        return new PagedResult<ReportQueueItemDto>(items, total, page, limit);
    }

    /// <summary>
    /// Chốt một báo cáo.
    ///
    /// Chỉ đổi trạng thái của chính dòng báo cáo, **không** đụng tới hồ sơ KTV: việc
    /// gỡ hồ sơ đi qua đường duyệt hồ sơ vốn đã có (<c>PATCH /admin/ktv/{id}/verify</c>),
    /// nơi đã ghi sẵn ai quyết định, lúc nào và vì sao. Nhân bản logic đó vào đây sẽ
    /// tạo ra hai đường đổi trạng thái hồ sơ phải giữ cho khớp nhau mãi mãi.
    /// </summary>
    public async Task<ReportDto> ResolveAsync(
        Guid id, Guid adminId, ResolveReportDto dto, CancellationToken ct = default)
    {
        var report = await db.ProfileReports.FirstOrDefaultAsync(r => r.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy báo cáo");

        if (report.Status != ProfileReportStatuses.Pending)
            throw new ConflictException("Báo cáo này đã được xử lý");

        report.Status = dto.Decision;
        report.ResolutionNote = dto.Note;
        report.ReviewedBy = adminId;
        report.ReviewedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);

        var ktv = await db.KtvProfiles
            .Where(k => k.Id == report.KtvId)
            .Select(k => new { k.FullName, k.VerificationStatus })
            .FirstAsync(ct);

        return ToDto(report, ktv.FullName, ktv.VerificationStatus);
    }

    private static ReportDto ToDto(ProfileReport r, string fullName, string verificationStatus) =>
        new(r.Id, r.KtvId, fullName, verificationStatus, r.Reason, r.Detail, r.Status,
            r.ReporterUserId, r.ReviewedBy, r.ReviewedAt, r.ResolutionNote, r.CreatedAt);

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
