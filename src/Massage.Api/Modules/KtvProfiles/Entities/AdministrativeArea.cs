namespace Massage.Api.Modules.KtvProfiles.Entities;

public static class AreaLevels
{
    public const string Province = "PROVINCE";
    public const string District = "DISTRICT";
    public const string Ward = "WARD";
}

public class AdministrativeArea
{
    public Guid Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public string Level { get; set; } = null!;
    public Guid? ParentId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public AdministrativeArea? Parent { get; set; }
}

public class CoverageArea
{
    public Guid KtvId { get; set; }
    public Guid AreaId { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
