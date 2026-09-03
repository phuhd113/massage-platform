namespace Massage.Api.Modules.Areas;

/// <param name="KtvCount">Số KTV đã duyệt phủ khu vực này.</param>
/// <param name="Indexable">
/// Trang khu vực này có đủ dữ liệu để cho Google index hay không. Frontend đọc cờ
/// này thay vì tự so sánh <c>KtvCount</c> với một ngưỡng riêng — cờ đã gộp cả ngưỡng
/// số KTV lẫn điều kiện có nội dung biên tập riêng.
/// </param>
public record AreaNodeDto(
    Guid Id,
    string Name,
    string Slug,
    string Level,
    int KtvCount,
    bool Indexable,
    List<AreaNodeDto> Children);

/// <param name="EditorialNote">
/// Nội dung biên tập riêng cho khu vực. Rỗng nghĩa là trang chưa được index —
/// ~760 trang khu vực sinh từ cùng một mẫu chỉ thay tên là doorway page.
/// </param>
public record AreaDetailDto(
    Guid Id,
    string Name,
    string Slug,
    string Level,
    int KtvCount,
    bool Indexable,
    string? EditorialNote,
    AreaNodeDto? Parent,
    List<AreaNodeDto> Children,
    List<AreaNodeDto> Siblings);

/// <summary>
/// Phường/xã. Cố ý không dùng lại <see cref="AreaNodeDto"/>: phường chỉ là nhãn cho
/// địa chỉ cơ sở của KTV — không có trang riêng, không vào <c>coverage_areas</c>,
/// không mua được gói đẩy tin — nên không có khái niệm số KTV hay "được index".
/// </summary>
public record WardDto(Guid Id, string Name, string Slug);
