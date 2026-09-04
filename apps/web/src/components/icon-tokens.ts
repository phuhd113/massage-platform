/**
 * Token dùng chung cho bộ icon "Huyệt" (nguồn: `design/Bo icon Huyet - standalone.html`).
 *
 * Tách riêng khỏi component để `ServiceIcon` và `icons.tsx` không tự khai lại
 * hai hằng số này mỗi nơi một kiểu.
 */

/** Vàng điểm huyệt. Chỉ dùng cho chấm tròn tô đặc, không dùng cho nét. */
export const ACCENT = '#c2952f';

/**
 * Độ dày nét theo kích thước hiển thị.
 *
 * Bộ icon vẽ ở khung 24 với nét 1.75. Dưới 20px nét phải **dày lên** để không bị
 * bệt trên màn hình 1×, và ở 40px phải mảnh đi để không trông thô — nên đây là
 * quan hệ nghịch, dễ sửa nhầm thành thuận khi đọc lướt.
 *
 * Bốn mốc lấy đúng từ bảng "Kích thước" của artboard; kích thước khác rơi về mốc
 * gần nhất phía dưới thay vì nội suy, để hai icon cạnh nhau không bao giờ lệch nét.
 */
export function iconStrokeWidth(size: number): number {
  if (size <= 16) return 2.25;
  if (size <= 20) return 2;
  if (size <= 24) return 1.75;
  return 1.5;
}
