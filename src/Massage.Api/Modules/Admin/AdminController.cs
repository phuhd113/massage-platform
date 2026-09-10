using Massage.Api.Common;
using Massage.Api.Common.Storage;
using Massage.Api.Data;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles;
using Massage.Api.Modules.KtvProfiles.Entities;
using Massage.Api.Modules.Reviews;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Massage.Api.Modules.Admin;

/// <summary>Duyệt hồ sơ KTV và chứng chỉ. Chỉ tài khoản ADMIN truy cập được.</summary>
[ApiController]
[Route("admin")]
[Tags("Admin")]
[Authorize(Roles = UserRoles.Admin)]
public class AdminController(
    AdminService service,
    MediaUrls urls,
    KtvProfileService profiles,
    IObjectStorage storage) : ControllerBase
{
    /// <summary>Danh sách hồ sơ KTV theo trạng thái duyệt.</summary>
    /// <param name="status">PENDING (mặc định), VERIFIED hoặc REJECTED.</param>
    /// <param name="page">Trang, bắt đầu từ 1.</param>
    /// <param name="limit">Số bản ghi mỗi trang, tối đa 100.</param>
    [HttpGet("ktv")]
    public async Task<IActionResult> ListProfiles(
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var result = await service.ListProfilesAsync(status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = result.Items.Select(p => new
            {
                p.Id,
                p.FullName,
                p.Slug,
                p.BaseAddress,
                p.ServiceRadiusKm,
                p.VerificationStatus,
                p.RejectionReason,
                p.CreatedAt,
                AvatarUrl = urls.Public(p.AvatarKey),
                // URL ký hạn ngắn: file chứng chỉ là ảnh chụp giấy tờ tuỳ thân, và
                // bucket để private nên đây là đường duy nhất mở được. Hạn ngắn hơn
                // hẳn một phiên làm việc, admin mở lại trang là có URL mới.
                Certifications = p.Certifications.Select(c => new
                {
                    c.Id,
                    c.Name,
                    FileUrl = urls.Signed(c.StorageKey),
                    c.VerifyStatus,
                }),
                // Null nghĩa là KTV chưa gửi CCCD — và hồ sơ đó **không duyệt được**
                // (xem AdminService.DecideProfileAsync). Trả về ở đây để trang duyệt
                // nói được lý do trước khi admin bấm, thay vì để họ nhận lỗi 400.
                IdentityDocument = p.IdentityDocument is null ? null : new
                {
                    FrontUrl = urls.Signed(p.IdentityDocument.FrontKey),
                    BackUrl = urls.Signed(p.IdentityDocument.BackKey),
                    p.IdentityDocument.VerifyStatus,
                    p.IdentityDocument.RejectionReason,
                    p.IdentityDocument.SubmittedAt,
                },
                // Điều kiện bắt buộc thứ hai. Cùng lý do: admin phải thấy còn thiếu gì
                // trước khi bấm duyệt.
                p.CommittedAt,
                CommitmentsUpToDate = p.CommitmentVersion == KtvCommitments.CurrentVersion,
                // Ai mang hồ sơ này về. Null với hồ sơ tự đến qua SEO — đó là đa số.
                ReferredBy = p.ReferredByCollaboratorId is { } rid
                             && result.Referrers.TryGetValue(rid, out var r)
                    ? new { Code = r.Code, Name = r.FullName, p.ReferredAt }
                    : null,
            }),
            total = result.Total,
            page = result.Page,
            limit = result.Limit,
        });
    }

    /// <summary>
    /// Tra cứu KTV: mọi trạng thái, tìm theo tên hoặc số điện thoại, kèm số liệu vận hành.
    /// </summary>
    /// <remarks>
    /// Khác <c>GET /admin/ktv</c> ở trên, vốn là **hàng đợi duyệt** — chỉ một trạng thái
    /// mỗi lần, xếp cũ nhất trước, kèm giấy tờ để đối chiếu. Endpoint này trả lời câu hỏi
    /// ngược lại: "người tên X (hoặc số 09xx) là ai, đang thế nào". Câu hỏi đó luôn bắt
    /// đầu bằng một cái tên chứ không bằng một trạng thái duyệt, nên nó cần đường vào
    /// riêng chứ không phải một tham số thêm vào hàng đợi.
    ///
    /// <paramref name="q"/> tìm cả tên có dấu, tên không dấu (qua <c>slug</c>) và số điện
    /// thoại — admin cầm máy nghe KTV đọc số thì gõ thẳng số đó.
    /// </remarks>
    /// <param name="status">Bỏ trống để lấy **mọi** trạng thái.</param>
    /// <param name="q">Từ khoá tìm theo tên hoặc số điện thoại.</param>
    /// <param name="gender">MALE hoặc FEMALE; bỏ trống để không lọc.</param>
    [HttpGet("ktv/search")]
    public async Task<IActionResult> SearchProfiles(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] string? q = null,
        [FromQuery] string? gender = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20)
    {
        if (status is not null
            && status is not (VerificationStatuses.Pending
                or VerificationStatuses.Verified
                or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        // Giá trị lạ trả 400 chứ không lặng lẽ bỏ qua: bỏ qua nghĩa là giao diện hiện
        // "đang lọc theo nữ" trong khi danh sách bên dưới có cả nam. Cùng lý do với bộ
        // lọc giới tính ở `/tim-kiem`.
        if (gender is not null && !Genders.IsValid(gender))
            throw new BadRequestException("Gender phải là MALE hoặc FEMALE");

        if (page < 1 || limit is < 1 or > 100)
            throw new BadRequestException("page ≥ 1 và limit trong khoảng 1 – 100");

        return Ok(await service.SearchProfilesAsync(status, q, gender, page, limit, ct));
    }

    /// <summary>Duyệt hoặc từ chối một hồ sơ KTV.</summary>
    [HttpPatch("ktv/{id:guid}/verify")]
    public async Task<IActionResult> VerifyProfile(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var (p, orphanedAvatar) = await service.DecideProfileAsync(id, User.GetUserId(), dto, ct);

        // Duyệt hồ sơ cũng duyệt luôn avatar đang chờ, nên ảnh cũ có thể vừa thành rác.
        // Xoá sau khi DB commit, đúng quy ước của mọi đường ảnh khác.
        if (orphanedAvatar is not null)
            await storage.DeleteAsync(orphanedAvatar, ct);

        return Ok(new { p.Id, p.VerificationStatus, p.RejectionReason, p.VerifiedBy, p.VerifiedAt });
    }

    /// <summary>
    /// Duyệt hoặc từ chối ảnh CCCD của một hồ sơ (cả hai mặt cùng lúc).
    /// </summary>
    /// <remarks>
    /// Đường dẫn theo <c>ktvId</c> chứ không theo id của bản ghi CCCD: một hồ sơ có
    /// nhiều nhất một CCCD, nên id đó không thêm thông tin gì mà lại buộc trang duyệt
    /// phải mang theo một định danh thứ hai.
    /// </remarks>
    [HttpPatch("ktv/{id:guid}/identity/verify")]
    public async Task<IActionResult> VerifyIdentityDocument(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var d = await service.DecideIdentityDocumentAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { d.Id, d.KtvId, d.VerifyStatus, d.RejectionReason, d.VerifiedBy, d.VerifiedAt });
    }

    /// <summary>Hàng đợi CCCD chờ duyệt, gửi sớm nhất lên đầu.</summary>
    /// <remarks>
    /// Tách khỏi hàng đợi hồ sơ vì cùng lý do với hàng đợi ảnh: KTV gửi lại CCCD sau
    /// khi bị từ chối không làm đổi trạng thái hồ sơ, nên lần gửi lại đó sẽ không xuất
    /// hiện trong danh sách lọc theo trạng thái hồ sơ.
    /// </remarks>
    [HttpGet("identity-documents")]
    public async Task<IActionResult> ListIdentityDocuments(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var (items, total) = await service.ListIdentityDocumentsAsync(
            status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = items.Select(d => new
            {
                d.Id,
                d.KtvId,
                KtvName = d.Ktv!.FullName,
                KtvSlug = d.Ktv.Slug,
                KtvVerificationStatus = d.Ktv.VerificationStatus,
                FrontUrl = urls.Signed(d.FrontKey),
                BackUrl = urls.Signed(d.BackKey),
                d.VerifyStatus,
                d.RejectionReason,
                d.SubmittedAt,
            }),
            total,
            page,
            limit,
        });
    }

    /// <summary>Duyệt hoặc từ chối một chứng chỉ hành nghề.</summary>
    [HttpPatch("certifications/{id:guid}/verify")]
    public async Task<IActionResult> VerifyCertification(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var c = await service.DecideCertificationAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { c.Id, c.VerifyStatus, c.RejectionReason, c.VerifiedBy, c.VerifiedAt });
    }

    /// <summary>
    /// Hàng đợi chứng chỉ chờ duyệt, cũ nhất lên đầu.
    /// </summary>
    /// <remarks>
    /// Tách khỏi hàng đợi hồ sơ vì cùng lý do với ảnh, và đây là lỗi đã gặp thật: chứng
    /// chỉ chỉ hiện lồng trong danh sách hồ sơ, vốn lọc theo trạng thái **hồ sơ**. KTV
    /// đã duyệt tải chứng chỉ mới thì nó rơi vào tab "Đã duyệt" — chỗ admin không mở —
    /// nên không bao giờ được xem tới, trong khi KTV thấy "chờ duyệt" và chờ vô hạn.
    ///
    /// URL ký hạn ngắn: chứng chỉ là file riêng tư, bucket để private nên đây là đường
    /// duy nhất mở được. Admin mở lại trang là có URL mới.
    /// </remarks>
    [HttpGet("certifications")]
    public async Task<IActionResult> ListCertifications(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var (items, total) = await service.ListCertificationsAsync(
            status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = items.Select(c => new
            {
                c.Id,
                c.KtvId,
                KtvName = c.Ktv!.FullName,
                KtvSlug = c.Ktv.Slug,
                c.Name,
                c.IssuingOrg,
                c.IssuedAt,
                FileUrl = urls.Signed(c.StorageKey),
                c.VerifyStatus,
                c.RejectionReason,
                c.CreatedAt,
            }),
            total,
            page = Math.Max(1, page),
            limit = Math.Clamp(limit, 1, 100),
        });
    }

    /// <summary>
    /// Hàng đợi ảnh hồ sơ chờ duyệt, cũ nhất lên đầu.
    /// </summary>
    /// <remarks>
    /// Tách khỏi hàng đợi hồ sơ vì hồ sơ đã duyệt vẫn thêm ảnh mới được: lọc theo
    /// trạng thái hồ sơ thì những ảnh đó không xuất hiện ở bất kỳ đâu, và một ảnh
    /// không ai xem trên trang công khai của ngành này là rủi ro cho toàn bộ tên miền.
    /// </remarks>
    [HttpGet("photos")]
    public async Task<IActionResult> ListPhotos(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var (items, total) = await service.ListPendingPhotosAsync(
            status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = items.Select(p => new
            {
                p.Id,
                p.KtvId,
                KtvName = p.Ktv!.FullName,
                KtvSlug = p.Ktv.Slug,
                Url = urls.Public(p.StorageKey),
                p.Caption,
                p.VerifyStatus,
                p.RejectionReason,
                p.CreatedAt,
            }),
            total,
            page = Math.Max(1, page),
            limit = Math.Clamp(limit, 1, 100),
        });
    }

    /// <summary>Duyệt hoặc từ chối một ảnh hồ sơ.</summary>
    [HttpPatch("photos/{id:guid}/verify")]
    public async Task<IActionResult> VerifyPhoto(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var p = await service.DecidePhotoAsync(id, User.GetUserId(), dto, ct);
        return Ok(new { p.Id, p.VerifyStatus, p.RejectionReason, p.VerifiedBy, p.VerifiedAt });
    }

    /// <summary>Hàng đợi ảnh đại diện chờ duyệt, cũ nhất lên đầu.</summary>
    /// <remarks>
    /// Hàng đợi riêng, tách khỏi ảnh gallery: avatar là tấm ảnh lớn nhất trên trang công
    /// khai và là thứ hiện trên mọi thẻ tìm kiếm, nên trộn nó vào danh sách ảnh phòng ốc
    /// sẽ khiến đúng tấm đáng xem kỹ nhất trôi lẫn giữa hàng chục tấm khác.
    /// </remarks>
    [HttpGet("avatars")]
    public async Task<IActionResult> ListAvatars(
        CancellationToken ct,
        [FromQuery] string? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        status ??= VerificationStatuses.Pending;
        if (status is not (VerificationStatuses.Pending or VerificationStatuses.Verified or VerificationStatuses.Rejected))
            throw new BadRequestException("Status phải là PENDING, VERIFIED hoặc REJECTED");

        var (items, total) = await service.ListPendingAvatarsAsync(
            status, Math.Max(1, page), Math.Clamp(limit, 1, 100), ct);

        return Ok(new
        {
            items = items.Select(p => new
            {
                KtvId = p.Id,
                KtvName = p.FullName,
                KtvSlug = p.Slug,
                // Cả hai ảnh: admin cần so tấm mới với tấm đang hiển thị để thấy KTV đang
                // đổi sang cái gì. Chỉ đưa tấm mới thì mọi lượt đổi trông giống nhau.
                PendingUrl = urls.Public(p.PendingAvatarKey),
                CurrentUrl = urls.Public(p.AvatarKey),
                p.AvatarVerifyStatus,
                p.AvatarRejectionReason,
                p.AvatarSubmittedAt,
                ProfileStatus = p.VerificationStatus,
            }),
            total,
            page = Math.Max(1, page),
            limit = Math.Clamp(limit, 1, 100),
        });
    }

    /// <summary>Duyệt hoặc từ chối ảnh đại diện đang chờ của một hồ sơ.</summary>
    [HttpPatch("ktv/{id:guid}/avatar/verify")]
    public async Task<IActionResult> VerifyAvatar(Guid id, VerifyDecisionDto dto, CancellationToken ct)
    {
        var orphan = await profiles.DecideAvatarAsync(
            id, User.GetUserId(), dto.Decision, dto.Reason, ct);

        // Xoá file sau khi DB commit — cùng quy ước với mọi đường ảnh khác. Duyệt thì ảnh
        // cũ thành rác; từ chối thì chính ảnh vừa bị từ chối thành rác.
        if (orphan is not null)
            await storage.DeleteAsync(orphan, ct);

        return NoContent();
    }

    /// <summary>
    /// Danh sách đánh giá để rà soát, đáng ngờ nhất lên trước.
    /// </summary>
    /// <remarks>
    /// Bổ sung cho <c>PATCH reviews/{id}/moderate</c>: trước đây admin gỡ được một
    /// đánh giá nhưng không có đường nào **tìm ra** đánh giá đáng gỡ, nên cơ chế kiểm
    /// duyệt chỉ chạy khi có người báo cáo.
    ///
    /// <paramref name="unverifiedOnly"/> lọc những đánh giá không gắn được với một
    /// lượt liên hệ nào. Đó là **dấu hiệu**, không phải bằng chứng: khách bấm gọi lúc
    /// chưa đăng nhập thì lead ẩn danh và không bao giờ khớp, nên phần lớn đánh giá
    /// thật cũng rơi vào nhóm này. Nó chỉ thu hẹp chỗ cần nhìn.
    /// </remarks>
    [HttpGet("reviews")]
    public async Task<IActionResult> ListReviews(
        [FromServices] ReviewService reviews,
        CancellationToken ct,
        [FromQuery] bool unverifiedOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50)
    {
        if (page < 1 || limit is < 1 or > 200)
            throw new BadRequestException("page ≥ 1 và limit trong khoảng 1 – 200");

        return Ok(await reviews.ListForModerationAsync(unverifiedOnly, page, limit, ct));
    }

    /// <summary>
    /// Gỡ hoặc khôi phục một đánh giá. Đánh giá được đăng ngay khi gửi, nên đây là
    /// đường duy nhất để xử lý nội dung vi phạm — và nó tính lại rating của KTV.
    /// </summary>
    [HttpPatch("reviews/{id:guid}/moderate")]
    public async Task<IActionResult> ModerateReview(
        Guid id,
        ModerateReviewDto dto,
        [FromServices] ReviewService reviews,
        CancellationToken ct) =>
        Ok(await reviews.ModerateAsync(id, User.GetUserId(), dto, ct));

    /// <summary>
    /// Doanh thu theo ngày, khu vực và loại gói.
    ///
    /// Tính từ sổ cái ví (bút toán CAPTURE và REFUND) chứ không từ bảng campaign:
    /// sổ cái là nơi tiền thật sự đổi chủ, còn campaign chỉ mô tả thứ đã bán. Nếu
    /// hai nguồn lệch nhau thì con số đúng là con số ở sổ.
    /// </summary>
    [HttpGet("revenue")]
    public async Task<IActionResult> Revenue(
        [FromServices] AppDbContext db,
        CancellationToken ct,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null)
    {
        var start = from ?? DateTimeOffset.UtcNow.AddDays(-30);
        var end = to ?? DateTimeOffset.UtcNow;
        if (end <= start) throw new BadRequestException("Khoảng thời gian không hợp lệ");

        // Join tới `administrative_areas` để trả **tên** khu vực chứ không chỉ id.
        // Một danh sách GUID buộc người đọc tra ngược từng dòng bằng SQL để biết mình
        // đang nhìn doanh thu ở đâu, tức là báo cáo chỉ dùng được bởi người có quyền
        // vào thẳng DB — đúng nhóm người ít cần tới nó nhất.
        var lines = db.WalletTransactions.AsNoTracking()
            .Where(t => t.CreatedAt >= start && t.CreatedAt < end && t.CampaignId != null)
            .Join(db.Campaigns, t => t.CampaignId, c => c.Id,
                (t, c) => new { t.Amount, t.CreatedAt, c.AreaId, c.PackageType });

        var rows = await lines
            .Join(db.AdministrativeAreas, x => x.AreaId, a => a.Id,
                (x, a) => new { x.Amount, x.AreaId, x.PackageType, AreaName = a.Name })
            .GroupBy(x => new { x.AreaId, x.AreaName, x.PackageType })
            // Sắp xếp **trước** khi projection sang record: EF không dịch được
            // `OrderBy` trên thuộc tính của một record vừa dựng trong `Select`, và nó
            // nổ lúc chạy chứ không lúc biên dịch. Bút toán CAPTURE mang dấu âm nên
            // doanh thu cao nhất là tổng âm nhất — `OrderBy` chứ không `OrderByDescending`.
            .OrderBy(g => g.Sum(x => x.Amount))
            .Select(g => new RevenueRowDto(
                g.Key.AreaId,
                g.Key.AreaName,
                g.Key.PackageType,
                // Bút toán CAPTURE mang dấu âm, REFUND dấu dương — đảo dấu tổng để
                // ra doanh thu ròng đã trừ hoàn tiền.
                -g.Sum(x => x.Amount),
                g.Count()))
            .ToListAsync(ct);

        // Chuỗi theo ngày, cắt theo **giờ Việt Nam**: một ngày doanh thu kết thúc lúc
        // nửa đêm giờ địa phương chứ không phải 7 giờ sáng. Gom theo UTC sẽ đẩy doanh
        // thu buổi tối — đúng khung giờ bán chạy nhất — sang ngày hôm sau.
        var daily = await lines
            // `AddHours` chứ không `ToOffset`: EF **không dịch được** `ToOffset` và nổ
            // lúc chạy. Cộng thẳng 7 giờ vào mốc UTC rồi lấy phần ngày cho ra cùng kết
            // quả — giờ Việt Nam là UTC+7 cố định, không có DST để cộng sai.
            .GroupBy(x => x.CreatedAt.AddHours(VietnamOffsetHours).Date)
            // Cùng lý do như trên: sắp xếp trên khoá nhóm, không trên record đã dựng.
            .OrderBy(g => g.Key)
            .Select(g => new RevenueDayDto(DateOnly.FromDateTime(g.Key), -g.Sum(x => x.Amount)))
            .ToListAsync(ct);

        return Ok(new RevenueReportDto(
            start, end, rows.Sum(r => r.NetRevenue), rows, daily));
    }

    /// <summary>
    /// Giờ Việt Nam là UTC+7 cố định — không có DST, nên một hằng số là đủ và tránh
    /// phụ thuộc vào tzdata của container (chỗ đã cắn một lần ở Hangfire).
    /// </summary>
    private const double VietnamOffsetHours = 7;
}
