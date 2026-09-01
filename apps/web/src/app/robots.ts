import type { MetadataRoute } from 'next';
import { absolute } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Dashboard KTV và admin không có nội dung cho khách; /tim-kiem là công cụ
      // sinh vô số biến thể tham số, để trang khu vực lo phần index.
      disallow: ['/dashboard', '/admin', '/api', '/tim-kiem'],
    },
    sitemap: absolute('/sitemap.xml'),
  };
}
