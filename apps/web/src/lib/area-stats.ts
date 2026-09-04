import { formatVnd } from '@/lib/site';
import type { AreaStats } from '@/lib/types';

/**
 * Dựng các ô số liệu cho đầu trang khu vực.
 *
 * Chỉ trả về ô **có dữ liệu thật**. Khu vực chưa ai khai giá hoặc chưa ai đánh giá
 * là trạng thái bình thường của một sàn đang lớn, không phải lỗi — và hiện một ô
 * "—" ở đó vẫn là thin content, chỉ trông đầy đủ hơn.
 *
 * Dùng chung cho cả trang tỉnh và trang quận: hai trang cùng một khối, tách ra hai
 * bản sao sẽ lệch nhau ngay lần chỉnh đầu tiên.
 */
export function buildStatCards(stats: AreaStats): { label: string; value: string }[] {
  const cards: { label: string; value: string }[] = [];

  if (stats.priceFromMin !== null) {
    cards.push({
      label: 'Giá phổ biến',
      value:
        // Một mức giá duy nhất thì hiện một số: "280.000–280.000 ₫" đọc như lỗi
        // hiển thị chứ không như thông tin.
        stats.priceFromMax !== null && stats.priceFromMax !== stats.priceFromMin
          ? `${formatVnd(stats.priceFromMin)}–${formatVnd(stats.priceFromMax)}`
          : formatVnd(stats.priceFromMin),
    });
  }

  if (stats.ratingAvg !== null) {
    cards.push({
      label: 'Đánh giá trung bình',
      // Dấu phẩy thập phân theo cách viết số tiếng Việt.
      value: stats.ratingAvg.toFixed(1).replace('.', ','),
    });
  }

  if (stats.topServiceName) {
    cards.push({ label: 'Dịch vụ phổ biến nhất', value: stats.topServiceName });
  }

  return cards;
}
