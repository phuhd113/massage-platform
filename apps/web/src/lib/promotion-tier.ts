import type { PackageType } from './types';

/**
 * Suy hạng gói đang chạy từ `boostPoints` mà `/search` trả về.
 *
 * Vì sao phải suy ngược thay vì đọc thẳng một trường: `SearchItem` cố ý chỉ trả
 * điểm số, không trả danh sách campaign — hồ sơ công khai không lộ KTV đang mua
 * gói nào ở những khu vực nào. Nhưng thẻ listing vẫn cần biết hạng để vẽ khung
 * VIP, nên ánh xạ ngược tại đây là chỗ hẹp nhất và duy nhất.
 *
 * Ánh xạ này đúng vì backend lấy MAX (không cộng dồn) các gói đang chạy, nên
 * `boostPoints` luôn rơi đúng vào một trong ba mốc rời rạc.
 *
 * Các mốc phải khớp `PackageTypes.BoostPointsFor` ở backend. Khi ai đó đổi số
 * điểm bên đó, sửa cả bảng này — nếu không, thẻ trả phí tụt về kiểu thẻ thường
 * và KTV mất đúng thứ họ đã mua.
 */
const TIERS: { boost: number; type: PackageType }[] = [
  { boost: 500, type: 'VIP_PIN' },
  { boost: 300, type: 'INSTANT_BOOST' },
  { boost: 150, type: 'FEATURED_BADGE' },
];

/** Dải BaseScore tối đa — khớp `PackageTypes.MaxBaseScore`. */
const MAX_BASE_SCORE = 100;

/**
 * Trả loại gói đang chạy, hoặc null khi KTV không trả phí.
 *
 * So sánh theo ngưỡng chứ không so bằng: chấp nhận cả trường hợp backend cộng
 * thêm điểm khuyến mãi lẻ vào một hạng mà không đổi cấu trúc hạng.
 */
export function tierFromBoost(boostPoints: number): PackageType | null {
  if (boostPoints <= MAX_BASE_SCORE) return null;
  return TIERS.find((t) => boostPoints >= t.boost)?.type ?? null;
}

/**
 * Nhãn hiển thị trên thẻ listing.
 *
 * MỌI hạng đều đọc ra là "Tài trợ" — một từ duy nhất cho mọi vị trí trả phí.
 * Trước đây mỗi hạng một nhãn riêng ("Ghim Top khu vực", "Đang được đẩy", "Hồ sơ
 * nổi bật"), và chỉ hạng VIP mới kèm chữ giải thích là vị trí quảng cáo. Khách
 * đọc "Đang được đẩy" như một thuộc tính tự nhiên của KTV (đang hot, đang được
 * ưa chuộng) chứ không hiểu là người này trả tiền để đứng đây — dùng hai từ khác
 * nhau cho cùng một khái niệm chính là chỗ hở thành quảng cáo trá hình.
 *
 * Hạng vẫn được phân biệt bằng thị giác (khung champagne + vương miện cho VIP,
 * chip trơn + tia sét cho hạng dưới), nên thứ KTV mua không mất đi — chỉ có nhãn
 * chữ thôi không còn giả vờ là trạng thái tự nhiên.
 *
 * Giữ tham số dù mọi hạng trả cùng một chuỗi: chỗ gọi đã có sẵn hạng, và nếu sau
 * này luật quảng cáo đòi phân biệt chữ theo hạng thì sửa đúng tại đây.
 */
export function tierBadgeLabel(_type: PackageType): string {
  return 'Tài trợ';
}

/**
 * Chỉ hạng cao nhất mới được đổi cả khung thẻ sang champagne. Instant Boost và
 * Featured Badge chỉ nhận một chip.
 *
 * Lý do: nếu cả ba hạng đều có khung vàng thì khung vàng thôi hết nghĩa là "hạng
 * cao nhất trong quận", và gói đắt nhất mất đi thứ phân biệt nó với gói rẻ hơn.
 */
export const showsVipFrame = (type: PackageType | null) => type === 'VIP_PIN';
