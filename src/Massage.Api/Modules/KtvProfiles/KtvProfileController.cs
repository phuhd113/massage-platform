using FluentValidation;
using Massage.Api.Common;
using Massage.Api.Modules.Auth.Entities;
using Massage.Api.Modules.KtvProfiles.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.KtvProfiles;

[ApiController]
[Route("ktv")]
public class KtvProfileController(KtvProfileService service, CertificationUpload upload) : ControllerBase
{
    [HttpPost("profile")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Create(CreateKtvProfileDto dto, CancellationToken ct)
    {
        var profile = await service.CreateAsync(User.GetUserId(), dto, ct);
        return CreatedAtAction(nameof(GetPublicProfile), new { id = profile.Id }, ToDto(profile));
    }

    [HttpGet("profile/me")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> MyProfile(CancellationToken ct) =>
        Ok(ToDto(await service.GetByUserIdAsync(User.GetUserId(), ct)));

    [HttpPatch("profile")]
    [Authorize(Roles = UserRoles.Ktv)]
    public async Task<IActionResult> Update(UpdateKtvProfileDto dto, CancellationToken ct) =>
        Ok(ToDto(await service.UpdateAsync(User.GetUserId(), dto, ct)));

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

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicProfile(Guid id, CancellationToken ct) =>
        Ok(ToDto(await service.GetByIdAsync(id, ct)));

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
