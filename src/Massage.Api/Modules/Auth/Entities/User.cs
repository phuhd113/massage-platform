namespace Massage.Api.Modules.Auth.Entities;

public static class UserRoles
{
    public const string Customer = "CUSTOMER";
    public const string Ktv = "KTV";
    public const string Admin = "ADMIN";
}

public class User
{
    public Guid Id { get; set; }
    public string Phone { get; set; } = null!;
    public string? Email { get; set; }
    public string? PasswordHash { get; set; }
    public string Role { get; set; } = UserRoles.Customer;
    public DateTimeOffset? PhoneVerifiedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
