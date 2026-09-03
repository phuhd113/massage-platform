namespace Massage.Api.Modules.Analytics;

/// <summary>
/// Số liệu 7 ngày gần nhất cho dashboard KTV, kèm mức thay đổi so với 7 ngày liền
/// trước đó.
/// </summary>
/// <param name="ProfileViews">Lượt xem trang hồ sơ công khai trong 7 ngày qua.</param>
/// <param name="ProfileViewsChangePct">
/// Phần trăm thay đổi so với tuần trước. <c>null</c> khi tuần trước bằng 0 — chia cho
/// 0 không có nghĩa, và "+∞%" hay "+100%" đều là con số bịa. Tuần đầu tiên của mọi
/// KTV đều rơi vào trường hợp này.
/// </param>
/// <param name="Leads">Lượt khách bấm liên hệ trong 7 ngày qua.</param>
/// <param name="LeadRatePct">
/// Tỉ lệ người xem bấm liên hệ. <c>null</c> khi chưa có lượt xem nào — mẫu số 0.
/// </param>
/// <param name="Impressions">
/// Số lần hồ sơ xuất hiện trong kết quả tìm kiếm trong 7 ngày qua. Đây là bậc đầu của
/// phễu và là thứ gói đẩy tin trực tiếp mua — không có nó thì KTV chỉ thấy "ít khách"
/// mà không biết mình không được hiện ra hay được hiện ra mà không ai bấm.
/// </param>
/// <param name="ImpressionsChangePct">
/// Thay đổi so với tuần trước. <c>null</c> khi tuần trước bằng 0.
/// </param>
/// <param name="ClickRatePct">
/// Trong số lần hiện ra, bao nhiêu phần trăm dẫn tới mở hồ sơ. <c>null</c> khi chưa
/// hiện ra lần nào.
/// </param>
public record KtvStatsDto(
    int ProfileViews,
    decimal? ProfileViewsChangePct,
    int Leads,
    decimal? LeadRatePct,
    int Impressions,
    decimal? ImpressionsChangePct,
    decimal? ClickRatePct);
