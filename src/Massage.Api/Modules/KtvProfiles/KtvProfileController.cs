using FluentValidation;
using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.KtvProfiles;

/// <summary>Hồ sơ kỹ thuật viên và chứng chỉ hành nghề.</summary>
[ApiController]
[Route("ktv")]
[Tags("KTV Profiles")]
public class KtvProfileController(KtvProfileService service, CertificationUpload upload) : ControllerBase
{
    /// <summary>Tạo hồ sơ KTV cho tài khoản đang đăng nhập.</summary>
    [HttpPost("profile")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Create(CreateKtvProfileDto dto, CancellationToken ct)
    {
        var profile = await service.CreateAsync(User.GetUserId(), dto, ct);
        return CreatedAtAction(nameof(GetPublicProfile), new { id = profile.Id }, ToDto(profile));
    }

    /// <summary>Xem hồ sơ KTV của chính mình.</summary>
    [HttpGet("profile/me")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> MyProfile(CancellationToken ct) =>
        Ok(ToDto(await service.GetByUserIdAsync(User.GetUserId(), ct)));

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

        var fileUrl = await upload.SaveAsync(file, ct);
        var cert = await service.AddCertificationAsync(User.GetUserId(), dto, fileUrl, ct);

        return Created($"/uploads/{Path.GetFileName(fileUrl)}", ToDto(cert));
    }

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

    private static object ToDto(KtvProfile p) => new
    {
        p.Id,
        p.FullName,
        p.Slug,
        p.Bio,
        p.YearsExperience,
        // Trả GeoJSON để client web dùng trực tiếp mà không phải parse WKT.
        BasePoint = new { type = "Point", coordinates = new[] { p.BasePoint.X, p.BasePoint.Y } },
        p.BaseAddress,
        p.ServiceRadiusKm,
        p.VerificationStatus,
        p.RejectionReason,
        p.RatingAvg,
        p.RatingCount,
        p.IsOnline,
        p.CreatedAt,
        Certifications = p.Certifications.Select(ToDto),
    };

    private static object ToDto(Certification c) => new
    {
        c.Id,
        c.KtvId,
        c.Name,
        c.IssuingOrg,
        c.IssuedAt,
        c.FileUrl,
        c.VerifyStatus,
        c.RejectionReason,
        c.CreatedAt,
    };
}
