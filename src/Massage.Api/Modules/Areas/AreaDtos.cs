using FluentValidation;

namespace Massage.Api.Modules.Areas;

/// <summary>
/// Nội dung biên tập admin gửi lên cho một khu vực.
///
/// Null hoặc chuỗi rỗng nghĩa là **gỡ** nội dung, không phải "bỏ qua, giữ nguyên" — khác
/// với <c>UpdateKtvProfileDto</c> nơi null nghĩa là không đổi. Ở đây chỉ có một trường,
/// nên không có thao tác nào khác để nhầm lẫn với việc gỡ, và việc gỡ phải làm được:
/// thiếu nó thì mở index là một chiều.
/// </summary>
/// <remarks>
/// Khai thuộc tính tường minh chứ **không** dùng positional record
/// (<c>record SetEditorialNoteDto(string? EditorialNote)</c>). Với record một tham số,
/// <c>System.Text.Json</c> cố dựng đối tượng từ chính giá trị JSON thay vì từ object bọc
/// ngoài, nên <c>{"editorialNote":"..."}</c> trả 400 "The JSON value could not be
/// converted". Đã cắn: lỗi đọc như body sai định dạng chứ không như lỗi khai kiểu.
/// </remarks>
public record SetEditorialNoteDto
{
    public string? EditorialNote { get; init; }
}

public class SetEditorialNoteDtoValidator : AbstractValidator<SetEditorialNoteDto>
{
    public SetEditorialNoteDtoValidator()
    {
        // Chỉ chặn trần trên ở đây. Ngưỡng **tối thiểu** nằm ở service
        // (`AreaService.MinEditorialNoteLength`) chứ không ở đây, vì nó chỉ áp cho việc
        // ghi chứ không áp cho việc gỡ — diễn đạt "rỗng thì được, mà ngắn thì không"
        // bằng một rule FluentValidation sẽ tối nghĩa hơn là một câu if ở service.
        RuleFor(x => x.EditorialNote).MaximumLength(4000);
    }
}

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
/// Một dòng trong trang biên tập nội dung khu vực của admin.
///
/// Mang **cả hai vế** của điều kiện index (<paramref name="KtvCount"/> và nội dung) chứ
/// không chỉ cờ tổng: người viết cần biết mình đang thiếu vế nào. Một trang "chưa index"
/// vì thiếu KTV thì viết bao nhiêu chữ cũng không đổi được trạng thái, còn thiếu nội dung
/// thì đúng là việc của họ — gộp hai ca đó vào một chữ "chưa" là giấu mất sự khác biệt
/// duy nhất có ích trên màn hình này.
/// </summary>
/// <param name="ParentName">NULL khi chính nó là tỉnh. Dùng để phân biệt mười "Huyện Châu Thành".</param>
/// <param name="Indexable">Cờ đã gộp cả hai vế, tính ở server — frontend không tự so ngưỡng.</param>
public record AreaEditorialRowDto(
    Guid Id,
    string Name,
    string Slug,
    string Level,
    string? ParentName,
    string? ParentSlug,
    int KtvCount,
    string? EditorialNote,
    bool Indexable);

/// <summary>
/// Kết quả sau khi ghi nội dung biên tập.
///
/// Trả về <paramref name="ProvinceSlug"/> và <paramref name="DistrictSlug"/> vì lớp gọi
/// cần dựng đúng đường dẫn công khai để xoá cache ISR — trang khu vực dựng sẵn 600 giây
/// và không tự biết nội dung vừa đổi. Không trả hai slug này thì frontend phải tự ghép
/// từ dữ liệu nó đang có, và đó chính là chỗ cặp slug tỉnh/quận từng bị gửi thiếu vế.
/// </summary>
public record AreaEditorialUpdatedDto(
    Guid Id,
    string Name,
    string ProvinceSlug,
    string? DistrictSlug,
    int KtvCount,
    bool Indexable,
    string? EditorialNote);

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
