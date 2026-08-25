using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;

namespace Massage.Api.Common;

/// <summary>
/// Gắn một tiền tố chung (vd "api/v1") cho mọi controller, để việc lên phiên bản
/// API sau này chỉ sửa một dòng thay vì mọi thuộc tính [Route].
/// </summary>
public class RoutePrefixConvention(string prefix) : IApplicationModelConvention
{
    private readonly AttributeRouteModel _prefix = new(new RouteAttribute(prefix));

    public void Apply(ApplicationModel application)
    {
        foreach (var selector in application.Controllers.SelectMany(c => c.Selectors))
        {
            selector.AttributeRouteModel = selector.AttributeRouteModel is null
                ? _prefix
                : AttributeRouteModel.CombineAttributeRouteModel(_prefix, selector.AttributeRouteModel);
        }
    }
}

public static class MvcOptionsExtensions
{
    public static void UseGeneralRoutePrefix(this MvcOptions options, string prefix) =>
        options.Conventions.Insert(0, new RoutePrefixConvention(prefix));
}
