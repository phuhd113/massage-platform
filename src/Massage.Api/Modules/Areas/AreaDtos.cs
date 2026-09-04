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

/// <summary>
/// Ba con số tóm tắt một khu vực, dùng cho phần đầu trang landing.
///
/// Đây là **nội dung riêng** của từng trang khu vực, không phải trang trí: trang
/// tỉnh/quận nào cũng có cùng bộ khung chữ, nên nếu không có số liệu thật thì hàng
/// trăm trang chỉ khác nhau đúng cái địa danh — đúng định nghĩa thin content mà
/// Google hạ hạng.
/// </summary>
/// <param name="PriceFromMin">Giá khởi điểm thấp nhất trong khu vực; null khi chưa KTV nào khai giá.</param>
/// <param name="RatingAvg">Trung bình có trọng số theo số đánh giá, không phải trung bình của các trung bình.</param>
/// <param name="TopServiceName">Dịch vụ nhiều KTV cung cấp nhất.</param>
public record AreaStatsDto(
    decimal? PriceFromMin,
    decimal? PriceFromMax,
    decimal? RatingAvg,
    int RatingCount,
    string? TopServiceName);

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
    List<AreaNodeDto> Siblings,
    AreaStatsDto Stats);

/// <summary>
/// Phường/xã. Cố ý không dùng lại <see cref="AreaNodeDto"/>: phường chỉ là nhãn cho
/// địa chỉ cơ sở của KTV — không có trang riêng, không vào <c>coverage_areas</c>,
/// không mua được gói đẩy tin — nên không có khái niệm số KTV hay "được index".
/// </summary>
public record WardDto(Guid Id, string Name, string Slug);

/// <summary>
/// Một dòng gợi ý trong ô tìm khu vực.
///
/// <b>Luôn mang đủ vế cha</b> (<paramref name="ProvinceSlug"/>, <paramref name="DistrictSlug"/>)
/// chứ không chỉ slug của chính nó. Slug quận chỉ duy nhất trong phạm vi tỉnh — cả nước
/// có 10 tỉnh cùng chứa "Huyện Châu Thành" — nên một gợi ý thiếu vế tỉnh là thứ frontend
/// không thể dựng thành URL đúng, và <c>/search</c> sẽ hiểu nó thành slug tỉnh.
/// </summary>
/// <param name="ProvinceSlug">NULL khi chính nó là tỉnh.</param>
/// <param name="DistrictSlug">Chỉ có khi <paramref name="Level"/> là WARD.</param>
/// <param name="ParentPath">
/// Đường dẫn cha đã dựng sẵn để hiển thị ("Quận 1, TP. Hồ Chí Minh"). Dựng ở server vì
/// đây chính là thứ phân biệt mười "Huyện Châu Thành" với nhau trên màn hình — để client
/// tự ghép thì mười dòng giống hệt nhau và khách chọn ngẫu nhiên.
/// </param>
public record AreaSuggestionDto(
    Guid Id,
    string Name,
    string Slug,
    string Level,
    string? ProvinceSlug,
    string? DistrictSlug,
    string ParentPath,
    int KtvCount,
    bool Indexable);
