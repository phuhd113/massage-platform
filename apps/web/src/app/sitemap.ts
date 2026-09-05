import type { MetadataRoute } from 'next';
import { LOCALES, localePath } from '@/i18n/config';
import { api } from '@/lib/api';
import { absolute } from '@/lib/site';

// Không prerender lúc build (xem ghi chú ở app/page.tsx); danh sách URL vẫn được
// cache ở tầng fetch.
export const dynamic = 'force-dynamic';

/**
 * Sitemap lấy thẳng danh sách URL được phép index từ backend.
 *
 * Việc lọc ngưỡng KTV nằm ở backend chứ không lặp lại ở đây: sitemap là lời khai
 * "những trang này đáng index", nên nó phải khớp chính xác với thẻ robots mà
 * trang đó render. Hai nơi tự lọc theo logic riêng thì sớm muộn cũng lệch nhau,
 * và Google sẽ thấy site tự mâu thuẫn với chính mình.
 *
 * Bản tiếng Anh sinh bằng cách gắn prefix ở **frontend**, không bắt backend biết
 * về locale: `SitemapController` khai *trang nào đáng index*, còn *URL trông thế
 * nào* là kiến thức routing của frontend. Đẩy nó xuống backend là tạo ra chỗ thứ
 * hai phải nhớ mỗi khi đường dẫn đổi.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await api.sitemap();

  /** Một entry cho mỗi ngôn ngữ, cùng độ ưu tiên — hai bản là cùng một nội dung. */
  const perLocale = <T extends { url: string }>(path: string, rest: Omit<T, 'url'>) =>
    LOCALES.map((locale) => ({ url: absolute(localePath(locale, path)), ...rest }));

  return [
    ...perLocale('/', { changeFrequency: 'daily' as const, priority: 1 }),
    ...data.areas.flatMap((a) =>
      perLocale(a.path, {
        changeFrequency: 'daily' as const,
        priority: a.district ? 0.8 : 0.7,
      }),
    ),
    ...data.ktv.flatMap((k) =>
      perLocale(k.path, {
        lastModified: new Date(k.lastModified),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }),
    ),
    ...data.services.flatMap((s) =>
      perLocale(s.path, { changeFrequency: 'weekly' as const, priority: 0.5 }),
    ),
  ];
}
