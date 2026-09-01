namespace Massage.Api.Modules.Areas;

/// <param name="KtvCount">Số KTV đã duyệt phủ khu vực này.</param>
/// <param name="Indexable">
/// Trang khu vực này có đủ dữ liệu để cho Google index hay không. Frontend đọc cờ
/// này thay vì tự so sánh <c>KtvCount</c> với một ngưỡng riêng.
/// </param>
public record AreaNodeDto(
    Guid Id,
    string Name,
    string Slug,
    string Level,
    int KtvCount,
    bool Indexable,
    List<AreaNodeDto> Children);

public record AreaDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string Level,
    int KtvCount,
    bool Indexable,
    AreaNodeDto? Parent,
    List<AreaNodeDto> Children,
    List<AreaNodeDto> Siblings);
