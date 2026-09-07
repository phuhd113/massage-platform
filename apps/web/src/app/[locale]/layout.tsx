import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LOCALES, OG_LOCALE, isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { fontVariables } from '@/lib/fonts';
import { SITE_NAME } from '@/lib/site';

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
    <html lang={params.locale} className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
