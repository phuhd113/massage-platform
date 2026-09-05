import { DEFAULT_LOCALE, type Locale } from '@/i18n/config';

/**
 * Chọn tên/mô tả dịch vụ theo ngôn ngữ, rơi về tiếng Việt khi chưa có bản dịch.
 *
 * Backend trả **cả hai** ngôn ngữ trong một payload thay vì nhận `?locale=`: đường
 * đọc cache ở tầng fetch theo URL, nên một tham số locale sẽ tạo hai cache key cho
 * cùng một dữ liệu và nhân đôi lượt gọi backend mỗi khi ISR revalidate.
 *
 * Cột EN là nullable, nên nhánh rơi về ở đây không phải phòng xa: một dịch vụ mới
 * được thêm vào danh mục sẽ hiện tiếng Việt trên trang tiếng Anh cho tới khi có
 * người dịch. Đó là hành vi đúng — bỏ trắng tên dịch vụ thì thẻ trở nên vô nghĩa.
 */
type ServiceLike = {
  name: string;
  nameEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
};

export const serviceName = (s: ServiceLike, locale: Locale): string =>
  locale === DEFAULT_LOCALE ? s.name : (s.nameEn ?? s.name);

export const serviceDescription = (s: ServiceLike, locale: Locale): string | null =>
  locale === DEFAULT_LOCALE
    ? (s.description ?? null)
    : (s.descriptionEn ?? s.description ?? null);

/**
 * Tên dịch vụ dùng giữa câu ("Tìm massage Thái theo khu vực").
 *
 * Tiếng Việt hạ chữ thường được vì tên dịch vụ là danh từ chung. Tiếng Anh thì
 * **không**: "Thai massage" chứa một danh từ riêng, và `toLowerCase()` biến nó
 * thành "thai massage" — sai chính tả ngay giữa thẻ h2 của một trang SEO.
 */
export const serviceNameInSentence = (s: ServiceLike, locale: Locale): string =>
  locale === DEFAULT_LOCALE ? serviceName(s, locale).toLowerCase() : serviceName(s, locale);
