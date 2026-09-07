/**
 * Nhớ việc KTV đã đọc thông báo chương trình Beta chưa.
 *
 * Đây là chỗ **thứ hai** trong codebase dùng localStorage (chỗ đầu là
 * `lib/saved-area.ts`, có ghi chú vì sao mọi trạng thái khác đi qua URL hoặc cookie
 * httpOnly). Cùng lý do như ở đó: mất nó thì popup hiện lại một lần, không hỏng gì.
 *
 * **Cố ý KHÔNG lưu xuống DB.** Đây là thông báo marketing, không phải bằng chứng
 * pháp lý — thứ cần chứng minh "đã đồng ý với đúng những dòng này" là bản cam kết
 * KTV (`commitment_version` trên `ktv_profiles`, nội dung ở backend `KtvCommitments`).
 * Thêm một cột chỉ để đếm lần đóng popup là trả giá một migration cho một tiện ích
 * hiển thị, và hệ quả kèm theo là mỗi lần sửa câu chữ lại phải backfill.
 *
 * Đánh đổi đã cân nhắc: nhớ theo **trình duyệt**, không theo tài khoản. KTV đổi máy
 * hoặc xoá dữ liệu site sẽ thấy lại một lần — chấp nhận được với một thông báo có
 * thời hạn, và rẻ hơn nhiều so với đường ghi phía server.
 */

const KEY = 'masgo_ktv_announcement';

/**
 * Phiên bản nội dung thông báo.
 *
 * **Sửa câu chữ trong `KtvAnnouncement` phải tăng số này**, nếu không KTV đã đóng
 * bản cũ sẽ không bao giờ thấy bản mới — mà lý do duy nhất để sửa một thông báo là
 * muốn người ta đọc phần đã đổi. Tăng số nghĩa là mọi KTV thấy lại đúng một lần.
 */
export const ANNOUNCEMENT_VERSION = 1;

/**
 * Đã đọc bản hiện tại chưa.
 *
 * Trả `false` khi storage bị chặn (chế độ riêng tư) — thà hiện thừa một lần còn hơn
 * nuốt mất thông báo, vì đây là đường duy nhất KTV biết về chương trình.
 */
export function hasSeenAnnouncement(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    // Bản cũ hơn thì coi như chưa đọc: nội dung đã đổi.
    return Number.parseInt(raw, 10) >= ANNOUNCEMENT_VERSION;
  } catch {
    return false;
  }
}

/** Ghi nhận đã đọc. Nuốt lỗi: không ghi được thì popup hiện lại, không hỏng gì. */
export function markAnnouncementSeen(): void {
  try {
    localStorage.setItem(KEY, String(ANNOUNCEMENT_VERSION));
  } catch {
    // Hết quota hoặc storage bị chặn. Không có gì để làm và không có gì để báo.
  }
}
