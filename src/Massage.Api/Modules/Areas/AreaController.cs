using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Massage.Api.Modules.Areas;

/// <summary>
/// Danh mục tỉnh/quận cho trang landing theo khu vực.
///
/// Đường dẫn phân cấp tỉnh → quận cố ý khớp 1:1 với URL công khai
/// <c>/massage-tan-noi/{tinh}/{quan}</c>, và slug quận **chỉ duy nhất trong phạm vi
/// tỉnh**: cả nước có 10 tỉnh cùng chứa "Huyện Châu Thành", nên không có endpoint nào
/// tra quận chỉ bằng slug — thiếu vế tỉnh là trả về một trong mười mà không có gì
/// quyết định là cái nào.
/// </summary>
[ApiController]
[Route("areas")]
[Tags("Areas")]
[AllowAnonymous]
public class AreaController(AreaService service) : ControllerBase
{
    /// <summary>
    /// Cây tỉnh/thành kèm quận trực thuộc và số KTV đã duyệt.
    /// Không chứa phường/xã — dùng <see cref="Wards"/> cho cấp đó.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Tree(CancellationToken ct) =>
        Ok(await service.GetTreeAsync(ct));

    /// <summary>
    /// Gợi ý khu vực cho ô tìm địa chỉ: gõ có dấu hay không dấu đều khớp, và "q7" ra Quận 7.
    ///
    /// Mỗi gợi ý mang đủ vế cha để dựng được URL đúng — đó là lý do endpoint này tồn tại
    /// thay vì để frontend lọc trên cây khu vực: lọc phía client chỉ có slug trần, mà
    /// slug quận thì trùng nhau giữa các tỉnh.
    ///
    /// Đặt **trước** route <c>{provinceSlug}</c> vì "suggest" cũng khớp mẫu đó; ASP.NET ưu
    /// tiên route literal hơn route có tham số nên thứ tự này chỉ để người đọc thấy rõ.
    /// </summary>
    [HttpGet("suggest")]
    public async Task<IActionResult> Suggest(
        [FromQuery] string? q, [FromQuery] int? limit, CancellationToken ct) =>
        Ok(await service.SuggestAsync(q, limit, ct));

    /// <summary>
    /// Tra ngược toạ độ GPS ra quận/huyện gần nhất, cho nút "Tìm quanh tôi" điền sẵn
    /// ô khu vực thay vì để nó trống trong khi kết quả đã lọc theo vị trí.
    ///
    /// Trả về <c>null</c> (200, thân rỗng) khi không quận nào đủ gần — khách ở ngoài
    /// lãnh thổ hoặc GPS trôi ra biển là trạng thái bình thường, không phải lỗi, và
    /// 404 ở đây sẽ hiện thành thông báo đỏ cho một tiện ích phụ trợ.
    ///
    /// Trả đúng hình dạng của một dòng gợi ý (<see cref="Suggest"/>) để frontend dùng
    /// lại nguyên đường dựng URL đã có, thay vì mọc thêm một đường thứ hai.
    ///
    /// Đặt <b>trước</b> route <c>{provinceSlug}</c>, cùng lý do với "suggest".
    /// </summary>
    [HttpGet("resolve")]
    public async Task<IActionResult> Resolve(
        [FromQuery] double lat, [FromQuery] double lon, CancellationToken ct) =>
        Ok(await service.ResolveAsync(lat, lon, ct));

    /// <summary>Một tỉnh/thành kèm danh sách quận trực thuộc.</summary>
    [HttpGet("{provinceSlug}")]
    public async Task<IActionResult> Province(string provinceSlug, CancellationToken ct) =>
        Ok(await service.GetProvinceAsync(provinceSlug, ct));

    /// <summary>Một quận/huyện kèm khu vực lân cận để liên kết chéo.</summary>
    [HttpGet("{provinceSlug}/{districtSlug}")]
    public async Task<IActionResult> District(
        string provinceSlug, string districtSlug, CancellationToken ct) =>
        Ok(await service.GetDistrictAsync(provinceSlug, districtSlug, ct));

    /// <summary>
    /// Phường/xã của một quận — cho ô chọn địa chỉ cơ sở trong form hồ sơ KTV.
    ///
    /// Tách khỏi cây khu vực vì cả nước có hơn 10.000 phường: nhét chúng vào
    /// <see cref="Tree"/> là bắt mọi trang gọi cây phải tải toàn bộ.
    /// </summary>
    [HttpGet("{provinceSlug}/{districtSlug}/wards")]
    public async Task<IActionResult> Wards(
        string provinceSlug, string districtSlug, CancellationToken ct) =>
        Ok(await service.GetWardsAsync(provinceSlug, districtSlug, ct));
}
