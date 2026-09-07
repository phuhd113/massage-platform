using Massage.Api.Common;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Admin;

public record PagedResult<T>(IReadOnlyList<T> Items, int Total, int Page, int Limit)
{
    /// <summary>
    /// Tên và mã cộng tác viên đã giới thiệu, tra theo id — chỉ dùng cho danh sách hồ sơ.
    ///
    /// Là thuộc tính init tuỳ chọn chứ không phải tham số vị trí: <c>PagedResult</c> dùng
    /// chung cho nhiều danh sách, và thêm một tham số bắt buộc sẽ bắt mọi chỗ gọi khác
    /// phải truyền một từ điển rỗng cho thứ chúng không dùng.
    /// </summary>
    public IReadOnlyDictionary<Guid, (string Code, string FullName)> Referrers { get; init; }
        = new Dictionary<Guid, (string, string)>();
}

public class AdminService(AppDbContext db)
{
    public async Task<PagedResult<KtvProfile>> ListProfilesAsync(
        string status, int page, int limit, CancellationToken ct = default)
    {
        var query = db.KtvProfiles
            .Include(p => p.Certifications)
            .Include(p => p.IdentityDocument)
            .Where(p => p.VerificationStatus == status);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(p => p.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);

        // Tên và mã CTV giới thiệu, tra một lượt cho cả trang.
        //
        // Tách khỏi câu trên chứ không `Include` navigation: `KtvProfile` cố ý không khai
        // nav tới `Collaborator` (xem AppDbContext), và một `Include` ở đây sẽ bắt phải
        // thêm nav đó chỉ để phục vụ một cột hiển thị ở trang admin. Một câu tra theo
        // danh sách id rẻ hơn hẳn tra từng hồ sơ một.
        var referrerIds = items
            .Where(p => p.ReferredByCollaboratorId.HasValue)
            .Select(p => p.ReferredByCollaboratorId!.Value)
            .Distinct()
            .ToList();

        var referrers = referrerIds.Count == 0
            ? []
            : await db.Collaborators.AsNoTracking()
                .Where(c => referrerIds.Contains(c.Id))
                .ToDictionaryAsync(c => c.Id, c => (c.Code, c.FullName), ct);

        return new PagedResult<KtvProfile>(items, total, page, limit) { Referrers = referrers };
    }

    /// <summary>
    /// Duyệt hoặc từ chối hồ sơ KTV.
    ///
    /// <b>Hai điều kiện bắt buộc để sang VERIFIED</b>: CCCD đã xác minh, và KTV đã chấp
    /// nhận bản cam kết đang có hiệu lực. Cả hai ràng buộc nằm ở backend chứ không chỉ là
    /// cảnh báo trên giao diện admin: hồ sơ VERIFIED là thứ khách dựa vào để mời một
    /// người lạ vào nhà mình, nên "đã xác minh" phải luôn có nghĩa là đã đối chiếu giấy
    /// tờ tuỳ thân và người đó đã nhận rõ nghĩa vụ — không phụ thuộc vào việc admin có
    /// nhớ nhìn hay không.
    ///
    /// Chỉ chặn chiều **sang VERIFIED**. Từ chối hay gỡ một hồ sơ thì không cần điều kiện
    /// nào, và chặn ở đó sẽ khoá luôn đường gỡ đúng những hồ sơ đáng ngờ nhất.
    /// </summary>
    public async Task<KtvProfile> DecideProfileAsync(
        Guid ktvId, Guid adminId, VerifyDecisionDto dto, CancellationToken ct = default)
    {
        var profile = await db.KtvProfiles
            .Include(p => p.IdentityDocument)
            .FirstOrDefaultAsync(p => p.Id == ktvId, ct)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

        if (dto.Decision == VerificationStatuses.Verified)
        {
            if (profile.IdentityDocument?.VerifyStatus != VerificationStatuses.Verified)
                throw new BadRequestException(
                    "Chưa duyệt được: hồ sơ phải có ảnh CCCD đã xác minh. "
                    + "Duyệt CCCD trước bằng PATCH /admin/ktv/{id}/identity/verify.");

            // Cam kết là nghĩa vụ KTV tự nhận, không phải thứ admin duyệt — nên chỉ
            // kiểm nó có tồn tại và đúng bản đang hiệu lực. Duyệt một hồ sơ chưa cam
            // kết là mở hồ sơ cho người chưa nhận bất kỳ ràng buộc nào về nội dung.
            if (profile.CommitmentVersion != KtvCommitments.CurrentVersion)
                throw new BadRequestException(
                    "Chưa duyệt được: KTV chưa chấp nhận bản cam kết đang có hiệu lực "
                    + $"(bản {KtvCommitments.CurrentVersion}).");
        }

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

    /// <summary>
    /// Duyệt hoặc từ chối CCCD của một hồ sơ.
    ///
    /// Quyết định cho **cả hai mặt cùng lúc** — chúng là một hàng, xem
    /// <see cref="IdentityDocument"/>. Từ chối thì lý do là bắt buộc về mặt vận hành:
    /// KTV phải biết chụp lại thế nào, không thì họ gửi lại đúng tấm ảnh cũ.
    /// </summary>
    public async Task<IdentityDocument> DecideIdentityDocumentAsync(
        Guid ktvId, Guid adminId, VerifyDecisionDto dto, CancellationToken ct = default)
    {
        var doc = await db.IdentityDocuments.FirstOrDefaultAsync(d => d.KtvId == ktvId, ct)
            ?? throw new NotFoundException("Hồ sơ này chưa gửi ảnh CCCD");

        doc.VerifyStatus = dto.Decision;
        doc.RejectionReason = dto.Decision == VerificationStatuses.Rejected ? dto.Reason : null;
        doc.VerifiedBy = adminId;
        doc.VerifiedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return doc;
    }

    /// <summary>
    /// CCCD đang chờ duyệt, gửi sớm nhất lên đầu.
    ///
    /// Hàng đợi riêng, cùng lý do với hàng đợi ảnh: KTV gửi lại CCCD sau khi bị từ chối
    /// không làm đổi trạng thái **hồ sơ**, nên lần gửi đó sẽ không xuất hiện trong danh
    /// sách lọc theo trạng thái hồ sơ.
    /// </summary>
    public async Task<(List<IdentityDocument> Items, int Total)> ListIdentityDocumentsAsync(
        string status, int page, int limit, CancellationToken ct = default)
    {
        var q = db.IdentityDocuments.AsNoTracking()
            .Include(x => x.Ktv)
            .Where(x => x.VerifyStatus == status);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(x => x.SubmittedAt)
            .Skip((page - 1) * limit).Take(limit)
            .ToListAsync(ct);

        return (items, total);
    }

    /// <summary>
    /// Duyệt hoặc từ chối một ảnh hồ sơ. Cùng hình dạng với duyệt chứng chỉ, cố ý —
    /// đây là hai hàng đợi khác nhau nhưng cùng một quyết định của cùng một người.
    /// </summary>
    public async Task<KtvPhoto> DecidePhotoAsync(
        Guid photoId, Guid adminId, VerifyDecisionDto dto, CancellationToken ct = default)
    {
        var photo = await db.KtvPhotos.FirstOrDefaultAsync(x => x.Id == photoId, ct)
            ?? throw new NotFoundException("Không tìm thấy ảnh");

        photo.VerifyStatus = dto.Decision;
        photo.RejectionReason = dto.Decision == VerificationStatuses.Rejected ? dto.Reason : null;
        photo.VerifiedBy = adminId;
        photo.VerifiedAt = DateTimeOffset.UtcNow;

        await db.SaveChangesAsync(ct);
        return photo;
    }

    /// <summary>
    /// Ảnh đang chờ duyệt, cũ nhất lên đầu.
    ///
    /// Hàng đợi riêng chứ không nhét vào danh sách hồ sơ: hồ sơ đã VERIFIED vẫn thêm
    /// ảnh mới bất cứ lúc nào, mà danh sách kia lọc theo trạng thái **hồ sơ** nên
    /// những ảnh đó sẽ không bao giờ xuất hiện ở đâu cả.
    /// </summary>
    public async Task<(List<KtvPhoto> Items, int Total)> ListPendingPhotosAsync(
        string status, int page, int limit, CancellationToken ct = default)
    {
        var q = db.KtvPhotos.AsNoTracking()
            .Include(x => x.Ktv)
            .Where(x => x.VerifyStatus == status);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(x => x.CreatedAt)
            .Skip((page - 1) * limit).Take(limit)
            .ToListAsync(ct);

        return (items, total);
    }
}
