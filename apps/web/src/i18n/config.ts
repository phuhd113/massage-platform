/**
 * Hai ngôn ngữ của sàn. Tiếng Việt là mặc định và **không có prefix trong URL**.
 *
 * Đây là ràng buộc cứng, không phải sở thích: mọi URL tiếng Việt hiện tại đã được
 * Google index, và SEO là kênh acquisition chính. Đổi chúng — hay chèn thêm một
 * lượt redirect vào chúng — là đánh đổi thứ đang nuôi sàn lấy sự gọn gàng của
 * đường dẫn.
 */
export const LOCALES = ['vi', 'en'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'vi';

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** Rơi về tiếng Việt cho mọi giá trị lạ — dùng ở chỗ không được phép ném lỗi. */
export const normalizeLocale = (value: unknown): Locale =>
  isLocale(value) ? value : DEFAULT_LOCALE;

/**
 * Gắn prefix locale vào một đường dẫn nội bộ.
 *
 * **Mọi** nơi dựng URL — `<Link href>`, `router.push`, canonical, sitemap — phải đi
 * qua đây thay vì tự ghép chuỗi. Đó là cùng một bài học với `lib/area-search.ts`:
 * đường dựng URL thứ hai là nơi một nửa tham số bị bỏ quên, và lỗi chỉ lộ ra ở
 * đúng nhánh ít người đi nhất.
 */
export const localePath = (locale: Locale, path: string) =>
  locale === DEFAULT_LOCALE ? path : `/${locale}${path === '/' ? '' : path}`;

/**
 * Bỏ prefix locale khỏi một pathname để lấy lại đường dẫn "trần".
 *
 * Dùng cho nút chuyển ngôn ngữ và cho hreflang: cả hai cần biết "cùng trang này ở
 * ngôn ngữ kia là URL nào".
 */
export function stripLocale(pathname: string): { locale: Locale; path: string } {
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (pathname === `/${locale}`) return { locale, path: '/' };
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: DEFAULT_LOCALE, path: pathname };
}

/** Thẻ ngôn ngữ đầy đủ cho `openGraph.locale`. */
export const OG_LOCALE: Record<Locale, string> = { vi: 'vi_VN', en: 'en_US' };

/**
 * Locale để đưa vào `Intl.*`.
 *
 * Ngày dùng `en-GB` chứ không `en-US`: `en-US` cho `9/9/2026` (tháng/ngày), dễ đọc
 * nhầm thành ngày/tháng như mọi con số khác trên trang. `en-GB` cho `09/09/2026` —
 * cùng thứ tự với bản tiếng Việt, chỉ khác dấu phân cách.
 */
export const INTL_LOCALE: Record<Locale, string> = { vi: 'vi-VN', en: 'en-GB' };
