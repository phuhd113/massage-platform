import Link from 'next/link';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';

/**
 * 404 ở tầng root — nhánh dự phòng cho request không khớp được `[locale]`.
 *
 * Phải tự render `<html>`/`<body>`: root layout không còn dựng chúng (xem ghi chú
 * ở `layout.tsx`), và một trang không có `<html>` là HTML hỏng chứ không chỉ xấu.
 *
 * Không dùng `PublicShell` ở đây vì shell cần locale và font variable của
 * `[locale]/layout.tsx`, cả hai đều không có ở nhánh này. Bản 404 mà khách thật sự
 * gặp là `[locale]/not-found.tsx`; bản này chỉ để không bao giờ trả về trang trắng.
 */
export default function RootNotFound() {
  const t = createTranslator(getDictionary(DEFAULT_LOCALE), DEFAULT_LOCALE);

  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <div style={{ padding: '64px 16px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <h1>{t('notFound.title')}</h1>
          <p>{t('notFound.body')}</p>
          <Link href="/">{t('notFound.backHome')}</Link>
        </div>
      </body>
    </html>
  );
}
