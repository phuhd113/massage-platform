import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE, LOCALES } from '@/i18n/config';
import { absolute } from '@/lib/site';

/**
 * Đường dẫn không có nội dung cho khách tìm kiếm.
 *
 * `/tim-kiem` là công cụ sinh vô số biến thể tham số; để trang khu vực lo phần
 * index. `/dashboard`, `/admin`, `/api` thì không dành cho khách.
 */
const BLOCKED = [
  '/dashboard',
  '/admin',
  '/api',
  '/tim-kiem',
  '/dang-nhap',
  // `/dang-ky` đã phủ luôn `/dang-ky-ktv` vì Disallow khớp theo tiền tố, nhưng khai
  // cả hai để việc đổi tên một trong hai đường sau này không lặng lẽ mở trang kia ra
  // cho Googlebot.
  '/dang-ky',
  '/dang-ky-ktv',
  '/tai-khoan',
  '/nap-tien',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Mỗi tiền tố phải khai cho **mọi** ngôn ngữ: thiếu vế `/en` thì
      // `/en/tim-kiem` sinh ra đúng cái rừng biến thể tham số mà bản tiếng Việt
      // đang chặn — và không có gì báo lỗi, chỉ là chúng lặng lẽ vào index.
      disallow: BLOCKED.flatMap((path) =>
        LOCALES.map((locale) => (locale === DEFAULT_LOCALE ? path : `/${locale}${path}`)),
      ),
    },
    sitemap: absolute('/sitemap.xml'),
  };
}
