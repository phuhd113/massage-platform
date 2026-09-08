using FluentValidation;
using Massage.Api.Common;
using Massage.Api.Common.Storage;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Massage.Api.Modules.KtvProfiles;

/// <summary>Hồ sơ kỹ thuật viên và chứng chỉ hành nghề.</summary>
[ApiController]
[Route("ktv")]
[Tags("KTV Profiles")]
public class KtvProfileController(
    KtvProfileService service,
    UploadService upload,
    IObjectStorage storage,
    MediaUrls urls,
    IOptions<UploadOptions> uploadOptions) : ControllerBase
{
    /// <summary>Tạo hồ sơ KTV cho tài khoản đang đăng nhập.</summary>
    [HttpPost("profile")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Create(CreateKtvProfileDto dto, CancellationToken ct)
    {
        var profile = await service.CreateAsync(User.GetUserId(), dto, ct);
        return CreatedAtAction(nameof(GetPublicProfile), new { id = profile.Id }, ToDto(profile));
    }

    /// <summary>Xem hồ sơ KTV của chính mình, kèm khu vực đang nhận phục vụ.</summary>
    [HttpGet("profile/me")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> MyProfile(CancellationToken ct)
    {
        var profile = await service.GetByUserIdAsync(User.GetUserId(), ct);
        return Ok(ToDto(
            profile,
            await service.ListCoverageAreasAsync(profile.Id, ct),
            await service.GetBaseAreaAsync(profile.BaseWardId, ct)));
    }

    /// <summary>Cập nhật hồ sơ KTV của chính mình.</summary>
    [HttpPatch("profile")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Update(UpdateKtvProfileDto dto, CancellationToken ct) =>
        Ok(ToDto(await service.UpdateAsync(User.GetUserId(), dto, ct)));

    /// <summary>Tải lên chứng chỉ hành nghề (multipart: ảnh hoặc PDF ở trường <c>file</c>).</summary>
    [HttpPost("certifications")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> AddCertification(
        [FromForm] CreateCertificationDto dto,
        IFormFile? file,
        [FromServices] IValidator<CreateCertificationDto> validator,
        CancellationToken ct)
    {
        // Với multipart, FluentValidation tự động không chạy như với JSON body,
        // nên gọi tay để giữ cùng một bộ quy tắc.
        var validation = await validator.ValidateAsync(dto, ct);
        if (!validation.IsValid)
            return BadRequest(new { errors = validation.Errors.Select(e => e.ErrorMessage) });

        if (file is null)
            throw new BadRequestException("Cần đính kèm ảnh/PDF chứng chỉ ở trường \"file\"");

        var key = await upload.SaveCertificationAsync(file, ct);
        var cert = await service.AddCertificationAsync(User.GetUserId(), dto, key, ct);

        return Created($"/ktv/certifications/{cert.Id}", ToDto(cert));
    }

    /// <summary>
    /// Nội dung bản cam kết KTV đang có hiệu lực, kèm số phiên bản.
    /// </summary>
    /// <remarks>
    /// Công khai vì người chưa đăng nhập cũng phải đọc được trước khi quyết định tạo
    /// hồ sơ — và vì nó là tài liệu pháp lý, không phải dữ liệu riêng của ai.
    /// </remarks>
    [HttpGet("commitments")]
    [AllowAnonymous]
    public IActionResult GetCommitments() =>
        Ok(new { Version = KtvCommitments.CurrentVersion, Items = KtvCommitments.Items });

    /// <summary>Xác nhận đã đọc và chấp nhận bản cam kết KTV.</summary>
    [HttpPost("profile/commitments")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> AcceptCommitments(
        AcceptCommitmentsDto dto, CancellationToken ct)
    {
        var profile = await service.AcceptCommitmentsAsync(
            User.GetUserId(),
            dto.Version,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            ct);

        return Ok(new { profile.CommitmentVersion, profile.CommittedAt });
    }

    /// <summary>
    /// Gửi ảnh CCCD hai mặt (multipart: <c>front</c> và <c>back</c>). Gửi lại thì ghi đè
    /// bản cũ và đưa trạng thái về chờ duyệt.
    /// </summary>
    [HttpPut("profile/identity")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> SubmitIdentityDocument(
        IFormFile? front, IFormFile? back, CancellationToken ct)
    {
        if (front is null || back is null)
            throw new BadRequestException("Cần đính kèm cả hai mặt CCCD ở trường \"front\" và \"back\"");

        var frontKey = await upload.SaveIdentityDocumentAsync(front, ct);

        string backKey;
        try
        {
            backKey = await upload.SaveIdentityDocumentAsync(back, ct);
        }
        catch
        {
            // Mặt trước đã nằm trên storage rồi. Không dọn thì mỗi lượt gửi hỏng ở mặt
            // sau (sai định dạng, quá dung lượng) bỏ lại một ảnh giấy tờ tuỳ thân không
            // ai tham chiếu — thứ tệ hơn hẳn một file rác thường.
            await storage.DeleteAsync(frontKey, ct);
            throw;
        }

        try
        {
            var (doc, previous) = await service.SubmitIdentityDocumentAsync(
                User.GetUserId(), frontKey, backKey, ct);

            // Xoá ảnh của lần gửi trước, sau khi DB đã commit.
            foreach (var key in previous)
                await storage.DeleteAsync(key, ct);

            return Ok(ToDto(doc));
        }
        catch
        {
            await storage.DeleteAsync(frontKey, ct);
            await storage.DeleteAsync(backKey, ct);
            throw;
        }
    }

    /// <summary>Đặt ảnh đại diện (multipart: ảnh ở trường <c>file</c>).</summary>
    [HttpPut("profile/avatar")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> SetAvatar(IFormFile? file, CancellationToken ct)
    {
        if (file is null)
            throw new BadRequestException("Cần đính kèm ảnh ở trường \"file\"");

        var key = await upload.SaveAvatarAsync(file, ct);
        var previous = await service.SetAvatarAsync(User.GetUserId(), key, ct);

        // Dọn ảnh cũ sau khi DB đã commit. Lỗi ở bước này chỉ để lại một file mồ côi
        // tốn vài chục KB — không đáng để trả lỗi cho một lượt đổi ảnh đã thành công.
        if (previous is not null)
            await storage.DeleteAsync(previous, ct);

        return Ok(new { AvatarUrl = urls.Public(key) });
    }

    /// <summary>Gỡ ảnh đại diện.</summary>
    [HttpDelete("profile/avatar")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> RemoveAvatar(CancellationToken ct)
    {
        var previous = await service.RemoveAvatarAsync(User.GetUserId(), ct);
        if (previous is not null)
            await storage.DeleteAsync(previous, ct);

        return NoContent();
    }

    /// <summary>
    /// Thêm một ảnh vào bộ sưu tập hồ sơ (multipart: ảnh ở trường <c>file</c>).
    /// Ảnh vào hàng đợi duyệt, chưa hiện trên trang công khai.
    /// </summary>
    [HttpPost("profile/photos")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> AddPhoto(
        IFormFile? file, CancellationToken ct, [FromForm] string? caption = null)
    {
        if (file is null)
            throw new BadRequestException("Cần đính kèm ảnh ở trường \"file\"");

        if (caption is { Length: > 200 })
            throw new BadRequestException("Chú thích tối đa 200 ký tự");

        var key = await upload.SavePhotoAsync(file, ct);

        try
        {
            var photo = await service.AddPhotoAsync(
                User.GetUserId(), key, caption, uploadOptions.Value.MaxPhotosPerKtv, ct);

            return Created($"/ktv/profile/photos/{photo.Id}", ToDto(photo));
        }
        catch
        {
            // File đã lên storage trước khi biết có vượt hạn mức hay không — kiểm hạn
            // mức trước thì hai lượt upload song song vẫn lọt qua cùng lúc. Dọn ngay
            // ở đây, nếu không mỗi lần chạm trần lại bỏ lại một file không ai tham chiếu.
            await storage.DeleteAsync(key, ct);
            throw;
        }
    }

    /// <summary>Xoá một ảnh khỏi bộ sưu tập.</summary>
    [HttpDelete("profile/photos/{photoId:guid}")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> RemovePhoto(Guid photoId, CancellationToken ct)
    {
        var key = await service.RemovePhotoAsync(User.GetUserId(), photoId, ct);
        await storage.DeleteAsync(key, ct);
        return NoContent();
    }

    /// <summary>
    /// Tải file chứng chỉ. Chỉ chính chủ hoặc ADMIN mở được.
    /// </summary>
    /// <remarks>
    /// Chỉ dùng khi chạy <c>LocalObjectStorage</c> — với R2 thì <c>MediaUrls.Signed</c>
    /// trả URL ký đi thẳng tới bucket và endpoint này không nằm trên đường nào.
    ///
    /// Nó tồn tại vì file chứng chỉ **không** được nằm sau một đường dẫn tĩnh công
    /// khai: đó là ảnh chụp giấy tờ tuỳ thân, và trước khi có lớp object storage thì
    /// cả thư mục <c>uploads</c> đúng là công khai như vậy.
    /// </remarks>
    [HttpGet("certifications/file")]
    [Authorize]
    public async Task<IActionResult> GetCertificationFile(
        [FromQuery] string key, CancellationToken ct)
    {
        // Quyền xét theo **bản ghi trong DB**, không theo hình dạng của key: một key
        // hợp lệ vẫn là key của người khác, và đây là đường đọc giấy tờ tuỳ thân.
        var cert = await service.FindCertificationByKeyAsync(key, ct)
                   ?? throw new NotFoundException("Không tìm thấy chứng chỉ");

        if (!User.IsInRole(UserRoles.Admin))
        {
            var profile = await service.GetByUserIdAsync(User.GetUserId(), ct);
            if (cert.KtvId != profile.Id)
                // 404 chứ không phải 403: 403 xác nhận key đó có thật và thuộc về ai
                // đó, tức là biến chính lời từ chối thành một kênh dò tìm.
                throw new NotFoundException("Không tìm thấy chứng chỉ");
        }

        var stream = await storage.OpenReadAsync(cert.StorageKey, ct);
        if (stream is null) throw new NotFoundException("File không còn tồn tại");

        // inline để admin xem ngay trong tab mới thay vì phải tải về rồi mở.
        return File(stream, ContentTypeOf(cert.StorageKey));
    }

    /// <summary>
    /// Tải ảnh CCCD. Chỉ chính chủ hoặc ADMIN mở được.
    /// </summary>
    /// <remarks>
    /// Song song với <c>GET /ktv/certifications/file</c> và tồn tại vì cùng một lý do:
    /// chỉ dùng khi chạy <c>LocalObjectStorage</c>, vì đĩa local không ký URL được mà
    /// ảnh giấy tờ thì không được nằm sau đường dẫn tĩnh công khai.
    /// </remarks>
    [HttpGet("profile/identity/file")]
    [Authorize]
    public async Task<IActionResult> GetIdentityDocumentFile(
        [FromQuery] string key, CancellationToken ct)
    {
        // Quyền xét theo bản ghi trong DB, không theo hình dạng của key — xem
        // GetCertificationFile. Đây là đường đọc ảnh CCCD nên còn ít khoan nhượng hơn.
        var doc = await service.FindIdentityDocumentByKeyAsync(key, ct)
                  ?? throw new NotFoundException("Không tìm thấy ảnh CCCD");

        if (!User.IsInRole(UserRoles.Admin))
        {
            var profile = await service.GetByUserIdAsync(User.GetUserId(), ct);
            if (doc.KtvId != profile.Id)
                // 404 chứ không phải 403, để lời từ chối không xác nhận key có thật.
                throw new NotFoundException("Không tìm thấy ảnh CCCD");
        }

        var stream = await storage.OpenReadAsync(key, ct);
        if (stream is null) throw new NotFoundException("File không còn tồn tại");

        return File(stream, ContentTypeOf(key));
    }

    /// <summary>
    /// Content-Type suy từ đuôi file. Danh sách trắng, mặc định về
    /// <c>application/octet-stream</c>: trả một Content-Type do dữ liệu điều khiển là
    /// mời trình duyệt thực thi thứ nó không nên thực thi.
    /// </summary>
    private static string ContentTypeOf(string key) =>
        Path.GetExtension(key).ToLowerInvariant() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream",
        };

    /// <summary>Xem hồ sơ KTV công khai theo id (không cần đăng nhập).</summary>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicProfile(Guid id, CancellationToken ct) =>
        Ok(await service.GetPublicAsync(id, null, ct));

    /// <summary>
    /// Xem hồ sơ KTV công khai theo slug — dạng dùng cho URL <c>/ktv/{slug}-{id}</c>.
    /// </summary>
    [HttpGet("by-slug/{slug}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicProfileBySlug(string slug, CancellationToken ct) =>
        Ok(await service.GetPublicAsync(null, slug, ct));

    /// <param name="coverageAreas">
    /// Chỉ truyền ở đường "hồ sơ của tôi". Với hồ sơ vừa tạo hoặc vừa sửa thì để
    /// null — client vừa gửi lên danh sách đó nên không cần nhận lại.
    /// </param>
    private object ToDto(
        KtvProfile p, List<PublicAreaDto>? coverageAreas = null, BaseAreaDto? baseArea = null) => new
        {
            p.Id,
            p.FullName,
            p.Slug,
            // Null cho hồ sơ tạo trước 2026-09-08. Form sửa dựa vào đó để bắt KTV khai
            // lần đầu — nên nó phải ra tới đây, không chỉ ra đường công khai.
            p.Gender,
            p.YearsExperience,
            // Toạ độ đầy đủ, không làm tròn: đây là hồ sơ của chính chủ, và form sửa
            // cần đúng điểm đã lưu để không dịch vị trí mỗi lần bấm lưu.
            // Bản làm tròn dành cho đường công khai, xem PublicKtvProfileDto.
            BasePoint = new { type = "Point", coordinates = new[] { p.BasePoint.X, p.BasePoint.Y } },
            p.BaseAddress,
            p.BaseWardId,
            p.BaseStreet,
            // Tỉnh/quận/phường suy từ base_ward_id, để form sửa render được lựa chọn hiện
            // tại mà không phải tự tra ngược cây khu vực.
            BaseArea = baseArea,
            p.ServiceRadiusKm,
            p.VerificationStatus,
            p.RejectionReason,
            p.RatingAvg,
            p.RatingCount,
            p.IsOnline,
            p.CreatedAt,
            AvatarUrl = urls.Public(p.AvatarKey),
            Photos = p.Photos
                .OrderBy(x => x.SortOrder).ThenBy(x => x.CreatedAt)
                .Select(ToDto),
            Certifications = p.Certifications.Select(ToDto),
            // Null khi KTV chưa gửi — frontend dựa vào đó để hiện lời nhắc bắt buộc.
            IdentityDocument = p.IdentityDocument is null ? null : ToDto(p.IdentityDocument),
            p.CommitmentVersion,
            p.CommittedAt,
            // So sánh ở server: frontend không nên tự biết bản nào đang có hiệu lực,
            // nếu không sẽ có hai nơi cùng giữ con số đó và chúng sẽ lệch nhau.
            CommitmentsUpToDate = p.CommitmentVersion == KtvCommitments.CurrentVersion,
            CoverageAreas = coverageAreas,
        };

    /// <summary>
    /// CCCD của chính chủ (hoặc của admin đang duyệt). URL ký hạn ngắn — response này
    /// không bao giờ được cache, và DTO này không bao giờ được dùng cho đường công khai.
    /// </summary>
    private object ToDto(IdentityDocument d) => new
    {
        d.Id,
        d.KtvId,
        FrontUrl = urls.Signed(d.FrontKey),
        BackUrl = urls.Signed(d.BackKey),
        d.VerifyStatus,
        d.RejectionReason,
        d.SubmittedAt,
        d.VerifiedAt,
    };

    /// <summary>
    /// Chính chủ xem chứng chỉ của mình, nên URL ký ở đây là hợp lệ — nhưng nó vẫn có
    /// hạn ngắn và response này không bao giờ được cache.
    /// </summary>
    private object ToDto(Certification c) => new
    {
        c.Id,
        c.KtvId,
        c.Name,
        c.IssuingOrg,
        c.IssuedAt,
        FileUrl = urls.Signed(c.StorageKey),
        c.VerifyStatus,
        c.RejectionReason,
        c.CreatedAt,
    };

    private object ToDto(KtvPhoto p) => new
    {
        p.Id,
        Url = urls.Public(p.StorageKey),
        p.Caption,
        p.SortOrder,
        p.VerifyStatus,
        p.RejectionReason,
        p.CreatedAt,
    };
}
