import type { MetadataRoute } from 'next';
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
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await api.sitemap();

  return [
    {
      url: absolute('/'),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...data.areas.map((a) => ({
      url: absolute(a.path),
      changeFrequency: 'daily' as const,
      priority: a.district ? 0.8 : 0.7,
    })),
    ...data.ktv.map((k) => ({
      url: absolute(k.path),
      lastModified: new Date(k.lastModified),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...data.services.map((s) => ({
      url: absolute(s.path),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];
}
