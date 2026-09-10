using Massage.Api.Common;
using Massage.Api.Common.Storage;
using Massage.Api.Data;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Reviews.Entities;
using Massage.Promotion.Domain;
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

/// <param name="urls">
/// Dựng URL công khai cho avatar ở <see cref="SearchProfilesAsync"/>. Hàng đợi duyệt để
/// controller tự dựng vì nó còn cần URL ký cho giấy tờ; trang tra cứu chỉ có avatar nên
/// dựng luôn trong service, tránh bắt controller lặp lại vòng map chỉ vì một trường.
/// </param>
public class AdminService(AppDbContext db, MediaUrls urls)
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
    /// <returns>
    /// Hồ sơ sau quyết định, kèm key ảnh đại diện cũ đã bị thay và cần xoá khỏi storage
    /// <b>sau khi</b> transaction commit (null khi không có gì để dọn). Service không tự
    /// xoá file: một lỗi lưu DB sau khi đã xoá sẽ để hồ sơ trỏ tới file không còn tồn tại.
    /// </returns>
    public async Task<(KtvProfile Profile, string? OrphanedAvatarKey)> DecideProfileAsync(
        Guid ktvId, Guid adminId, VerifyDecisionDto dto, CancellationToken ct = default)
    {
        string? orphanedAvatarKey = null;

        var profile = await db.KtvProfiles
            .Include(p => p.IdentityDocument)
            .FirstOrDefaultAsync(p => p.Id == ktvId, ct)
            ?? throw new NotFoundException("Không tìm thấy hồ sơ KTV");

        if (dto.Decision == VerificationStatuses.Verified)
        {
            // Câu chữ nói theo **thao tác trên giao diện**, không theo endpoint. Message
            // này hiện thẳng lên màn hình admin (AppExceptionHandler trả `title` ra cho
            // mọi status khác 500), mà người đọc nó có sẵn trang "Duyệt CCCD" trong
            // sidebar — đưa cho họ một dòng curl là chỉ đường tới thứ họ không dùng.
            if (profile.IdentityDocument?.VerifyStatus != VerificationStatuses.Verified)
                throw new BadRequestException(
                    profile.IdentityDocument is null
                        ? "Chưa duyệt được: KTV chưa gửi ảnh CCCD."
                        : "Chưa duyệt được: hồ sơ phải có ảnh CCCD đã xác minh. "
                          + "Duyệt CCCD ở trang \"Duyệt CCCD\" trước.");

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

        // Duyệt hồ sơ thì duyệt luôn avatar đang chờ: admin vừa xem CCCD và toàn bộ hồ sơ
        // của người này, và avatar nằm ngay trước mắt trong cùng màn hình đó. Bắt nó đi
        // vòng qua hàng đợi riêng nghĩa là hồ sơ vừa duyệt xong lên sàn mà không có ảnh —
        // chặn đúng nhóm cần được nhìn thấy nhất, và đó chính là vế đúng của quyết định cũ
        // ("avatar hiện ngay") mà lần đổi này cố ý giữ lại.
        //
        // Chỉ áp dụng cho chiều sang VERIFIED. Từ chối hồ sơ **không** đụng tới avatar: hai
        // quyết định độc lập, và một hồ sơ bị từ chối vì lý do khác không có nghĩa là tấm
        // ảnh cũng sai — gộp lại sẽ khiến KTV sửa xong phần bị chê rồi phát hiện mất luôn ảnh.
        if (dto.Decision == VerificationStatuses.Verified
            && profile.PendingAvatarKey is not null
            && profile.AvatarVerifyStatus == VerificationStatuses.Pending)
        {
            // Ảnh cũ (nếu có) thành rác. Trả nó ra ngoài để controller dọn sau commit, đúng
            // quy ước "xoá file sau khi DB commit" — service không tự xoá.
            orphanedAvatarKey = profile.AvatarKey;

            profile.AvatarKey = profile.PendingAvatarKey;
            profile.PendingAvatarKey = null;
            profile.AvatarVerifyStatus = VerificationStatuses.Verified;
            profile.AvatarRejectionReason = null;
            profile.AvatarVerifiedBy = adminId;
        }

        await db.SaveChangesAsync(ct);
        return (profile, orphanedAvatarKey == profile.AvatarKey ? null : orphanedAvatarKey);
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
    /// Chứng chỉ đang chờ duyệt, cũ nhất lên đầu.
    ///
    /// Hàng đợi riêng vì **đúng lý do** với ảnh hồ sơ, và đây là lỗi đã gặp thật: chứng
    /// chỉ trước đây chỉ hiện lồng trong danh sách hồ sơ, vốn lọc theo trạng thái **hồ
    /// sơ**. KTV đã VERIFIED tải chứng chỉ mới lên thì nó nằm dưới tab "Đã duyệt" của
    /// hàng đợi hồ sơ — nơi admin không có lý do gì để mở — nên nó không bao giờ được
    /// duyệt, trong khi KTV nhận thông báo "đã gửi, chờ duyệt" và chờ mãi.
    /// </summary>
    public async Task<(List<Certification> Items, int Total)> ListCertificationsAsync(
        string status, int page, int limit, CancellationToken ct = default)
    {
        var q = db.Certifications.AsNoTracking()
            .Include(x => x.Ktv)
            .Where(x => x.VerifyStatus == status);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(x => x.CreatedAt)
            .Skip((page - 1) * limit).Take(limit)
            .ToListAsync(ct);

        return (items, total);
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

    /// <summary>
    /// Hàng đợi ảnh đại diện chờ duyệt, cũ nhất lên đầu.
    /// </summary>
    /// <remarks>
    /// Hàng đợi <b>riêng</b>, không gộp vào <c>ListPendingPhotosAsync</c>: avatar nằm ở
    /// cột trên <c>ktv_profiles</c> chứ không phải hàng trong <c>ktv_photos</c>, và nó là
    /// tấm ảnh lớn nhất trên trang công khai — trộn vào một danh sách ảnh gallery sẽ khiến
    /// nó trôi lẫn giữa hàng chục ảnh phòng ốc, đúng tấm đáng xem kỹ nhất.
    ///
    /// Xếp theo <c>avatar_submitted_at</c> chứ không phải <c>created_at</c> của hồ sơ: hàng
    /// bị ghi đè tại chỗ, nên xếp theo thời điểm tạo hồ sơ thì người bị từ chối rồi gửi lại
    /// nằm nguyên chỗ cũ và không bao giờ được xem lại.
    /// </remarks>
    public async Task<(List<KtvProfile> Items, int Total)> ListPendingAvatarsAsync(
        string status, int page, int limit, CancellationToken ct = default)
    {
        var q = db.KtvProfiles.AsNoTracking()
            .Where(x => x.AvatarVerifyStatus == status);

        // Chỉ hàng đợi PENDING mới đòi có ảnh thật; hai trạng thái kia là lịch sử quyết
        // định, nơi pending_avatar_key đã được nhả và chỉ còn lại kết quả.
        if (status == VerificationStatuses.Pending)
            q = q.Where(x => x.PendingAvatarKey != null);

        var total = await q.CountAsync(ct);
        var items = await q
            .OrderBy(x => x.AvatarSubmittedAt)
            .Skip((page - 1) * limit).Take(limit)
            .ToListAsync(ct);

        return (items, total);
    }

    /// <summary>
    /// Tra cứu KTV cho trang quản lý: mọi trạng thái, có tìm kiếm, kèm số liệu vận hành.
    /// </summary>
    /// <remarks>
    /// <b>Vì sao không mở rộng <see cref="ListProfilesAsync"/>:</b> hàng đợi duyệt và
    /// trang tra cứu trả lời hai câu hỏi khác nhau và vì thế cần hai thứ tự mặc định
    /// khác nhau — hàng đợi xếp **cũ nhất trước** (ai chờ lâu nhất được xem trước), còn
    /// tra cứu xếp **mới nhất trước** (hồ sơ vừa tạo là hồ sơ hay bị hỏi tới nhất). Nhồi
    /// cả hai vào một hàm sẽ đẻ ra một tham số "sắp xếp kiểu nào" mà chỗ gọi nào cũng
    /// phải truyền đúng, và truyền sai thì không có gì báo — danh sách vẫn ra kết quả.
    ///
    /// <b>Tìm theo <c>Slug</c> chứ không theo <c>FullName</c>:</b> slug là chính cái tên
    /// đã bỏ dấu (xem <c>SlugHelper</c>), nên gõ "phu" tìm ra "Hồ Duy Phú" mà không cần
    /// <c>unaccent()</c> lúc query — và <c>unaccent()</c> không IMMUTABLE nên không dùng
    /// được trong index. Vẫn tìm cả <c>FullName</c> để admin gõ đủ dấu cũng ra.
    /// </remarks>
    public async Task<PagedResult<AdminKtvRowDto>> SearchProfilesAsync(
        string? status,
        string? q,
        string? gender,
        int page,
        int limit,
        CancellationToken ct = default)
    {
        var query = db.KtvProfiles.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.VerificationStatus == status);

        if (!string.IsNullOrWhiteSpace(gender))
            query = query.Where(p => p.Gender == gender);

        // Join users **trước** khi lọc, vì số điện thoại là một trong những thứ tìm theo.
        var joined = query.Join(
            db.Users.AsNoTracking(), p => p.UserId, u => u.Id, (p, u) => new { P = p, U = u });

        if (!string.IsNullOrWhiteSpace(qq(q)))
        {
            var term = qq(q)!;
            joined = joined.Where(x =>
                EF.Functions.ILike(x.P.FullName, $"%{term}%")
                || EF.Functions.ILike(x.P.Slug, $"%{term}%")
                || EF.Functions.ILike(x.U.Phone, $"%{term}%"));
        }

        var total = await joined.CountAsync(ct);

        var now = DateTimeOffset.UtcNow;

        var rows = await joined
            // Mới nhất trước — xem ghi chú ở phần remarks về việc vì sao khác hàng đợi.
            .OrderByDescending(x => x.P.CreatedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(x => new
            {
                x.P,
                x.U.Phone,
                // Đếm bằng subquery tương quan thay vì Include: mỗi hồ sơ chỉ cần một
                // con số, còn Include sẽ kéo về toàn bộ dòng con rồi vứt đi.
                ReviewCount = db.Reviews.Count(r =>
                    r.KtvId == x.P.Id && r.Status == ReviewStatuses.Published),
                ActiveCampaigns = db.Campaigns.Count(c =>
                    c.KtvId == x.P.Id
                    && c.Status == CampaignStatuses.Active
                    && c.EndAt > now),
                // Ví gắn với **user**, không với hồ sơ. Null khi chưa từng nạp lần nào —
                // khác hẳn 0 đồng, xem ghi chú ở DTO.
                WalletBalance = db.Wallets
                    .Where(w => w.UserId == x.P.UserId)
                    .Select(w => (decimal?)w.Balance)
                    .FirstOrDefault(),
                IdentityStatus = db.IdentityDocuments
                    .Where(d => d.KtvId == x.P.Id)
                    .Select(d => d.VerifyStatus)
                    .FirstOrDefault(),
            })
            .ToListAsync(ct);

        var items = rows
            .Select(r => new AdminKtvRowDto(
                r.P.Id,
                r.P.UserId,
                r.P.FullName,
                r.P.Slug,
                r.Phone,
                r.P.Gender,
                r.P.YearsExperience,
                r.P.BaseAddress,
                r.P.VerificationStatus,
                r.P.RejectionReason,
                urls.Public(r.P.AvatarKey),
                r.P.RatingAvg,
                r.P.RatingCount,
                r.P.LeadCount,
                r.ReviewCount,
                r.ActiveCampaigns,
                r.WalletBalance,
                r.IdentityStatus is not null,
                r.IdentityStatus,
                r.P.CommitmentVersion == KtvCommitments.CurrentVersion,
                r.P.LastActiveAt,
                r.P.CreatedAt))
            .ToList();

        return new PagedResult<AdminKtvRowDto>(items, total, page, limit);
    }

    /// <summary>
    /// Chuẩn hoá từ khoá tìm kiếm: cắt khoảng trắng, rỗng thành null.
    ///
    /// Tách ra một chỗ vì nó chạy hai lần (kiểm có tìm không, và lấy giá trị) và hai bản
    /// lệch nhau sẽ cho ra ca "có lọc nhưng lọc bằng chuỗi rỗng" — khớp mọi hồ sơ trong
    /// khi giao diện hiện là đang tìm.
    /// </summary>
    private static string? qq(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
