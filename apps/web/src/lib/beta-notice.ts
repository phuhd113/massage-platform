/**
 * Nhớ việc khách đã xem popup thông báo giai đoạn thử nghiệm chưa.
 *
 * Đây là chỗ **thứ tư** trong codebase dùng browser storage, sau `lib/saved-area.ts`,
 * `lib/ktv-announcement.ts` và cờ popup lọc (`sessionStorage`) ở `/tim-kiem`. Mục 8
 * của chính sách bảo mật kê **đúng từng chỗ** đang có — thêm chỗ này mà quên sửa mục
 * đó thì chính sách kê thiếu, tức kê sai. Đã cập nhật cùng đợt.
 *
 * **localStorage, không phải sessionStorage** — khác cờ popup lọc. Popup lọc là lời
 * mời cho *lần đi tìm này*; còn popup này là một thông báo về sàn, và bật lại ở mỗi
 * phiên là biến một lời chào thành phiền toái định kỳ. Cùng lựa chọn với
 * `lib/ktv-announcement.ts`.
 *
 * **Cố ý KHÔNG lưu xuống DB.** Phần lớn người đọc popup này chưa đăng nhập — đó là
 * chính nhóm khách đáp từ Google xuống — nên không có tài khoản nào để gắn cờ vào.
 * Cùng lý do đã ghi ở `lib/ktv-announcement.ts`: một cột DB cho một tiện ích hiển
 * thị là trả giá một migration kèm nghĩa vụ backfill mỗi lần sửa câu chữ.
 */

const KEY = 'masgo_beta_notice';

/**
 * Phiên bản nội dung thông báo.
 *
 * **Sửa câu chữ trong namespace `betaNotice` của i18n phải tăng số này**, nếu không
 * người đã đóng bản cũ sẽ không bao giờ thấy bản mới — mà lý do duy nhất để sửa một
 * thông báo là muốn người ta đọc phần đã đổi.
 *
 * Cùng hình dạng với `ANNOUNCEMENT_VERSION` và `KtvCommitments.CurrentVersion`, khác
 * ở chỗ bản này không cần bằng chứng phía server: nó chỉ công bố, không thu chữ ký.
 */
export const BETA_NOTICE_VERSION = 1;

/**
 * Đã xem bản hiện tại chưa.
 *
 * Trả `false` khi storage bị chặn (chế độ riêng tư) — thà hiện thừa một lần còn hơn
 * nuốt mất thông báo, vì đây là đường duy nhất khách biết sàn đang chạy thử nghiệm.
 * Cùng chiều đánh đổi với `hasSeenAnnouncement`.
 */
export function hasDismissedBetaNotice(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    // Bản cũ hơn thì coi như chưa đọc: nội dung đã đổi.
    return Number.parseInt(raw, 10) >= BETA_NOTICE_VERSION;
  } catch {
    return false;
  }
}

/**
 * Ghi nhận đã xem. Gọi **ngay lúc mở**, không đợi lúc đóng: khách đóng tab giữa chừng
 * vẫn là đã thấy, và bật lại ở lần vào sau đọc như lỗi lặp. Cùng luật với
 * `markAnnouncementSeen`.
 *
 * Nuốt lỗi: không ghi được thì popup hiện lại, không hỏng gì.
 */
export function markBetaNoticeDismissed(): void {
  try {
    localStorage.setItem(KEY, String(BETA_NOTICE_VERSION));
  } catch {
    // Hết quota hoặc storage bị chặn. Không có gì để làm và không có gì để báo.
  }
}
