using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.Collaborators.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Collaborators;

public class CollaboratorService(AppDbContext db)
{
    /// <summary>
    /// Tra mã và trả về CTV đang hoạt động, hoặc ném lỗi rõ ràng.
    ///
    /// <b>Ném lỗi thay vì trả null im lặng</b> khi mã sai: KTV gõ nhầm một chữ phải biết
    /// ngay lúc tạo hồ sơ, chứ không phải lưu thành công rồi CTV mất hoa hồng mà không ai
    /// nhận ra cho tới kỳ đối soát.
    ///
    /// Mã của CTV đã ngừng hoạt động cũng bị từ chối, và thông điệp nói đúng lý do —
    /// gộp nó vào "mã không tồn tại" sẽ khiến CTV vừa bị khoá đi báo với KTV rằng hệ
    /// thống hỏng.
    /// </summary>
    public async Task<Collaborator> RequireActiveByCodeAsync(
        string code, CancellationToken ct = default)
    {
        var normalized = Collaborator.NormalizeCode(code);

        var collaborator = await db.Collaborators
            .FirstOrDefaultAsync(c => c.Code == normalized, ct)
            ?? throw new BadRequestException($"Mã giới thiệu \"{code.Trim()}\" không tồn tại");

        if (collaborator.Status != CollaboratorStatuses.Active)
            throw new BadRequestException(
                $"Mã giới thiệu \"{code.Trim()}\" đã ngừng hoạt động");

        return collaborator;
    }

    /// <summary>
    /// Danh sách CTV kèm số hồ sơ đã giới thiệu.
    ///
    /// Đếm bằng subquery tương quan chứ không left-join tới <c>GroupBy</c>: EF **không
    /// dịch được** dạng thứ hai, và bản viết bằng join chỉ nổ lúc chạy (cùng cái bẫy đã
    /// ghi lại ở hàng đợi báo cáo vi phạm).
    ///
    /// Đếm cả hai con số vì chúng trả lời hai câu khác nhau: <c>total</c> là "đã mời được
    /// bao nhiêu", còn <c>verified</c> là "bao nhiêu người thật sự lên sàn" — và chỉ con
    /// số thứ hai mới đáng dùng để tính hoa hồng.
    /// </summary>
    public async Task<(List<CollaboratorSummaryDto> Items, int Total)> ListAsync(
        string? status, int page, int limit, CancellationToken ct = default)
    {
        var q = db.Collaborators.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status))
            q = q.Where(c => c.Status == status);

        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(c => c.CreatedAt)
            .Skip((page - 1) * limit).Take(limit)
            .Select(c => new CollaboratorSummaryDto(
                c.Id,
                c.Code,
                c.FullName,
                c.Phone,
                c.Status,
                c.Note,
                c.CreatedAt,
                db.KtvProfiles.Count(p => p.ReferredByCollaboratorId == c.Id),
                db.KtvProfiles.Count(p =>
                    p.ReferredByCollaboratorId == c.Id
                    && p.VerificationStatus == KtvProfiles.Entities.VerificationStatuses.Verified)))
            .ToListAsync(ct);

        return (items, total);
    }

    public async Task<Collaborator> CreateAsync(
        UpsertCollaboratorDto dto, CancellationToken ct = default)
    {
        var code = Collaborator.NormalizeCode(dto.Code);

        // Kiểm trước để trả 409 có nghĩa thay vì để UNIQUE ném ra lỗi DB thô. Ràng buộc
        // ở DB vẫn là trọng tài cuối — câu kiểm này thua hai lượt tạo song song.
        if (await db.Collaborators.AnyAsync(c => c.Code == code, ct))
            throw new ConflictException($"Mã \"{code}\" đã được dùng cho cộng tác viên khác");

        var collaborator = new Collaborator
        {
            Code = code,
            FullName = dto.FullName.Trim(),
            Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim(),
            Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim(),
            Status = CollaboratorStatuses.Active,
        };

        db.Collaborators.Add(collaborator);
        await db.SaveChangesAsync(ct);
        return collaborator;
    }

    /// <summary>
    /// Sửa thông tin CTV. <b>Không đổi mã</b> — mã đã nằm trên giấy tờ, tin nhắn và tờ
    /// rơi CTV phát đi, nên đổi nó làm hỏng mọi lượt giới thiệu đang trên đường về. Cần
    /// mã khác thì tạo CTV mới; hồ sơ đã giới thiệu vẫn trỏ đúng người cũ vì liên kết
    /// lưu bằng id chứ không bằng chuỗi mã.
    /// </summary>
    public async Task<Collaborator> UpdateAsync(
        Guid id, UpdateCollaboratorDto dto, CancellationToken ct = default)
    {
        var collaborator = await db.Collaborators.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException("Không tìm thấy cộng tác viên");

        if (dto.FullName is not null) collaborator.FullName = dto.FullName.Trim();
        if (dto.Phone is not null)
            collaborator.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        if (dto.Note is not null)
            collaborator.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
        if (dto.Status is not null) collaborator.Status = dto.Status;

        collaborator.UpdatedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return collaborator;
    }

    /// <summary>
    /// Hồ sơ do một CTV giới thiệu — đường đối soát khi CTV hỏi "tôi đã mời những ai".
    /// </summary>
    public async Task<(List<ReferredKtvDto> Items, int Total)> ListReferredAsync(
        Guid collaboratorId, int page, int limit, CancellationToken ct = default)
    {
        if (!await db.Collaborators.AnyAsync(c => c.Id == collaboratorId, ct))
            throw new NotFoundException("Không tìm thấy cộng tác viên");

        var q = db.KtvProfiles.AsNoTracking()
            .Where(p => p.ReferredByCollaboratorId == collaboratorId);

        var total = await q.CountAsync(ct);

        var items = await q
            .OrderByDescending(p => p.ReferredAt)
            .Skip((page - 1) * limit).Take(limit)
            .Select(p => new ReferredKtvDto(
                p.Id, p.FullName, p.Slug, p.VerificationStatus, p.ReferredAt, p.CreatedAt))
            .ToListAsync(ct);

        return (items, total);
    }
}
