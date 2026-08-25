namespace Massage.Api.Modules.KtvProfiles.Entities;

public class Certification
{
    public Guid Id { get; set; }
    public Guid KtvId { get; set; }

    public string Name { get; set; } = null!;
    public string? IssuingOrg { get; set; }
    public DateOnly? IssuedAt { get; set; }
    public string FileUrl { get; set; } = null!;

    public string VerifyStatus { get; set; } = VerificationStatuses.Pending;
    public string? RejectionReason { get; set; }
    public Guid? VerifiedBy { get; set; }
    public DateTimeOffset? VerifiedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public KtvProfile? Ktv { get; set; }
}
