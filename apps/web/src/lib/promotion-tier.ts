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
 * Nhãn hiển thị trên thẻ listing — viết theo góc nhìn khách ("vì sao hồ sơ này
 * đứng đây"), không dùng tên kỹ thuật của gói.
 */
export function tierBadgeLabel(type: PackageType): string {
  switch (type) {
    case 'VIP_PIN':
      return 'Ghim Top khu vực';
    case 'INSTANT_BOOST':
      return 'Đang được đẩy';
    case 'FEATURED_BADGE':
      return 'Hồ sơ nổi bật';
    default:
      return 'Hồ sơ nổi bật';
  }
}

/**
 * Chỉ hạng cao nhất mới được đổi cả khung thẻ sang champagne. Instant Boost và
 * Featured Badge chỉ nhận một chip.
 *
 * Lý do: nếu cả ba hạng đều có khung vàng thì khung vàng thôi hết nghĩa là "hạng
 * cao nhất trong quận", và gói đắt nhất mất đi thứ phân biệt nó với gói rẻ hơn.
 */
export const showsVipFrame = (type: PackageType | null) => type === 'VIP_PIN';
