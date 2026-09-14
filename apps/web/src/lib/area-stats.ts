import { type Locale } from '@/i18n/config';
import type { Translator } from '@/i18n/t';
import { SHOW_AGGREGATE_PRICE } from '@/lib/pricing-display';
import { formatRating, formatVnd } from '@/lib/site';
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
export function buildStatCards(
  stats: AreaStats,
  locale: Locale,
  t: Translator,
): { label: string; value: string }[] {
  const cards: { label: string; value: string }[] = [];

  // Ô giá đang TẮT trong giai đoạn đầu — xem `SHOW_AGGREGATE_PRICE`. Khối vẫn tự rỗng
  // đúng cách khi tắt: `cards` chỉ còn rating và dịch vụ phổ biến, và cả hai chỗ gọi
  // vốn đã xử lý được mảng ngắn hơn (khu vực chưa ai khai giá là trạng thái bình thường
  // mà hàm này luôn phải trả lời được).
  if (SHOW_AGGREGATE_PRICE && stats.priceFromMin !== null) {
    cards.push({
      label: t('areaStats.priceRange'),
      value:
        // Một mức giá duy nhất thì hiện một số: "280.000–280.000 ₫" đọc như lỗi
        // hiển thị chứ không như thông tin.
        stats.priceFromMax !== null && stats.priceFromMax !== stats.priceFromMin
          ? `${formatVnd(stats.priceFromMin, locale)}–${formatVnd(stats.priceFromMax, locale)}`
          : formatVnd(stats.priceFromMin, locale),
    });
  }

  if (stats.ratingAvg !== null) {
    cards.push({
      label: t('areaStats.avgRating'),
      value: formatRating(stats.ratingAvg, locale),
    });
  }

  if (stats.topServiceName) {
    // Tên dịch vụ đến từ dữ liệu nên chỗ gọi tự chọn ngôn ngữ trước khi truyền vào.
    cards.push({ label: t('areaStats.topService'), value: stats.topServiceName });
  }

  return cards;
}
