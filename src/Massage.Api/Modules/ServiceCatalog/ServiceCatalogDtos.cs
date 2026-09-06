using FluentValidation;

namespace Massage.Api.Modules.ServiceCatalog;

public record KtvServiceItemDto(Guid ServiceId, decimal PriceFrom, short DurationMin);

public record ReplaceKtvServicesDto(List<KtvServiceItemDto> Items);

public class KtvServiceItemDtoValidator : AbstractValidator<KtvServiceItemDto>
{
    public KtvServiceItemDtoValidator()
    {
        RuleFor(x => x.ServiceId).NotEmpty();
        // Trần 50 triệu là để chặn lỗi nhập liệu (thừa số 0), không phải giới hạn
        // kinh doanh — giá thật của dịch vụ tận nơi nằm dưới mức này rất xa.
        RuleFor(x => x.PriceFrom).InclusiveBetween(0, 50_000_000)
            .WithMessage("Giá phải trong khoảng 0 – 50.000.000đ");
        RuleFor(x => x.PriceFrom).Must(p => p == decimal.Truncate(p))
            .WithMessage("Giá tính bằng VND nên không có phần lẻ");
        RuleFor(x => x.DurationMin).InclusiveBetween((short)15, (short)300)
            .WithMessage("Thời lượng phải trong khoảng 15 – 300 phút");
    }
}

public class ReplaceKtvServicesDtoValidator : AbstractValidator<ReplaceKtvServicesDto>
{
    public ReplaceKtvServicesDtoValidator()
    {
        RuleFor(x => x.Items).NotNull();
        RuleFor(x => x.Items).Must(i => i.Count <= 20).WithMessage("Tối đa 20 dịch vụ");
        RuleFor(x => x.Items).Must(i => i.Select(x => x.ServiceId).Distinct().Count() == i.Count)
            .WithMessage("Không được khai báo trùng một dịch vụ");
        RuleForEach(x => x.Items).SetValidator(new KtvServiceItemDtoValidator());
    }
}
