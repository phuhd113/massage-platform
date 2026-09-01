using FluentValidation;
using Massage.Api.Modules.Leads.Entities;

namespace Massage.Api.Modules.Leads;

public record CreateLeadDto(Guid KtvId, string Channel, Guid? AreaId, string? SourceUrl);

public class CreateLeadDtoValidator : AbstractValidator<CreateLeadDto>
{
    public CreateLeadDtoValidator()
    {
        RuleFor(x => x.KtvId).NotEmpty();
        RuleFor(x => x.Channel).NotEmpty()
            .Must(c => LeadChannels.All.Contains(c))
            .WithMessage($"Kênh liên hệ phải là một trong: {string.Join(", ", LeadChannels.All)}");
        RuleFor(x => x.SourceUrl).MaximumLength(500);
    }
}

/// <param name="Deduplicated">
/// True khi lần bấm này được gộp vào một lead vừa ghi trước đó của cùng thiết bị.
/// Trả về cho client biết thay vì im lặng, để dashboard KTV và số liệu tính phí
/// sau này không phải đoán vì sao hai lần bấm chỉ ra một lead.
/// </param>
/// <param name="Phone">
/// Số điện thoại KTV, chỉ lộ ra ở đây chứ không nằm trong hồ sơ công khai.
///
/// Hai lý do: số không nằm sẵn trong HTML nên không bị quét hàng loạt để spam,
/// và mọi lượt liên hệ đều buộc phải đi qua đường ghi lead — tới Phase 2, đây là
/// con số KTV dùng để đánh giá gói quảng cáo có đáng tiền không, nên nó không
/// được phép có đường vòng.
/// </param>
public record LeadCreatedDto(Guid Id, DateTimeOffset CreatedAt, bool Deduplicated, string Phone);
