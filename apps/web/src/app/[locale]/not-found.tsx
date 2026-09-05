import { headers } from 'next/headers';
import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';

/**
 * Trang 404 bên trong nhóm `[locale]`.
 *
 * Locale đọc từ header `x-locale` do middleware đặt, **không** từ `params`: Next
 * không truyền `params` cho `not-found.tsx`. Việc gọi `headers()` biến riêng file
 * này thành dynamic — chấp nhận được, vì trang 404 vốn không cần cache và không
 * nên được index.
 *
 * Tự bọc `PublicShell` vì root layout không có header/footer: trang 404 là chỗ
 * khách cần đường quay lại nhất, bỏ điều hướng ở đúng đó là ngõ cụt.
 */
export default function NotFound() {
  const locale = normalizeLocale(headers().get('x-locale'));
  const t = createTranslator(getDictionary(locale), locale);

  return (
    <PublicShell locale={locale}>
      <div className="py-16 text-center">
        <h1 className="text-h1 text-ink-900">{t('notFound.title')}</h1>
        <p className="mt-3 text-ink-600">{t('notFound.body')}</p>
        <Link
          href={localePath(locale, '/')}
          className="mt-6 inline-block rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600"
        >
          {t('notFound.backHome')}
        </Link>
      </div>
    </PublicShell>
  );
}
