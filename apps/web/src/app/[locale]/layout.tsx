import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Source_Sans_3 } from 'next/font/google';
import { LOCALES, OG_LOCALE, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { SITE_NAME } from '@/lib/site';

/**
 * `subsets` phải có 'vietnamese' — thiếu nó, font chỉ tải glyph latin và mọi chữ
 * có dấu rơi về font hệ thống, khiến "Trần Thị Hường" render bằng hai typeface
 * trong cùng một dòng. Rất khó thấy khi review nhanh, nhưng khách Việt thấy ngay.
 *
 * Giữ nguyên subset tiếng Việt cho **cả bản tiếng Anh**: tên KTV, phần giới thiệu
 * và nội dung đánh giá vẫn là tiếng Việt trên trang tiếng Anh.
 *
 * Tiêu đề cần cả 800: thang chữ của thiết kế dùng weight đó cho hero và h1 trang
 * hồ sơ. Thiếu weight thật thì trình duyệt tự làm đậm giả, nét bị bè và lệch hẳn
 * so với bản thiết kế.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

// Chỉ dùng cho số (tiền, id giao dịch) nên không cần subset tiếng Việt.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

/**
 * **Bắt buộc.** Thiếu nó, Next coi `[locale]` là dynamic segment không biết trước
 * giá trị và bỏ prerender/ISR cho **mọi** route con — build vẫn xanh, chỉ khác một
 * chữ trong bảng output, nên đây là loại hỏng chỉ lộ ra khi hoá đơn hạ tầng tăng.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  if (!isLocale(params.locale)) return {};
  const t = createTranslator(getDictionary(params.locale), params.locale);
  const siteName = SITE_NAME[params.locale];

  return {
    title: {
      default: t('home.metaTitle', { siteName }),
      // Mỗi trang tự đặt title theo địa danh/dịch vụ; template chỉ gắn thêm tên site.
      template: `%s | ${siteName}`,
    },
    description: t('home.metaDescription'),
    openGraph: {
      type: 'website',
      locale: OG_LOCALE[params.locale],
      siteName,
    },
  };
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Segment lạ (`/fr/...` gõ tay) phải là 404 chứ không phải 500 vì tra dictionary
  // ra undefined.
  if (!isLocale(params.locale)) notFound();

  return (
    <html
      lang={params.locale}
      className={`${jakarta.variable} ${sourceSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
