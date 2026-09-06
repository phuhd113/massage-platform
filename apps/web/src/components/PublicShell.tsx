import Link from 'next/link';
import { Suspense } from 'react';
import { AccountNavLink } from '@/components/AccountNavLink';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoMark } from '@/components/icons';
import { type Locale, localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { SITE_NAME, areaPath } from '@/lib/site';

/**
 * Khung trang công khai: header + footer.
 *
 * Tách khỏi root layout để **bảng điều khiển không dùng nó**. Dashboard trong thiết
 * kế là một màn riêng có sidebar của chính nó; đặt thêm header/footer của trang bán
 * hàng lên trên là hai bộ điều hướng chồng nhau, và KTV đang làm việc không cần lời
 * mời "Tìm KTV".
 *
 * not-found.tsx nằm ở root nên cũng dùng component này — trang 404 vẫn phải có đường
 * quay lại site.
 */
export function PublicShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const t = createTranslator(getDictionary(locale), locale);
  const siteName = SITE_NAME[locale];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header dính: trên trang kết quả dài, khách cuộn giữa chừng vẫn quay
          lại đổi khu vực được mà không phải cuộn ngược lên đầu.
          backdrop-blur giữ chữ đọc được khi nội dung trôi phía dưới. */}
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3.5">
          <Link
            href={localePath(locale, '/')}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-h4 text-brand-600 transition hover:text-brand-700"
          >
            <LogoMark className="h-6 w-6 shrink-0" />
            {siteName}
          </Link>

          <nav className="flex items-center gap-1 text-body-s">
            {/* Ẩn ở màn hẹp: 390px không đủ chỗ cho logo lẫn nav, và mọi trang
                công khai đều đã có đường vào tìm kiếm ngay trong nội dung. */}
            <Link
              href={localePath(locale, '/tim-kiem')}
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
            >
              {t('shell.navFindKtv')}
            </Link>
            <Link
              href={areaPath(locale, 'tp-ho-chi-minh')}
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
            >
              {t('shell.navHcm')}
            </Link>
            <Link
              href={areaPath(locale, 'ha-noi')}
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
            >
              {t('shell.navHanoi')}
            </Link>
            {/* Trỏ vào khối ba bước ở trang chủ chứ không mở trang riêng: nội dung
                đó chỉ dài ba đoạn, tách ra thành một trang là tự tạo thin content. */}
            <Link
              href={localePath(locale, '/#cach-duyet-ho-so')}
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 lg:block"
            >
              {t('shell.navHowWeVerify')}
            </Link>
            {/* Chữ trần, không viền như "Dành cho KTV": hai đường vào khác nhau về
                đối tượng chứ không về mức quan trọng, nhưng khách vãng lai không cần
                tài khoản để tìm và gọi — nên lời mời đăng nhập không được trông như
                hành động chính của trang.

                Client component vì nó đổi theo phiên: đọc cookie ở đây sẽ ép mọi
                trang trong (public) thành dynamic. Xem ghi chú trong component. */}
            <AccountNavLink
              locale={locale}
              labels={{ login: t('account.login'), myAccount: t('account.myAccount') }}
              className="hidden shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block" />
            {/* Trỏ thẳng vào cửa đăng ký KTV chứ không vào /dashboard: người bấm từ
                trang công khai gần như luôn chưa đăng nhập, nên /dashboard chỉ là một
                lần chuyển hướng thừa tới đúng chỗ này. KTV đã đăng nhập vào dashboard
                từ đây cũng không sai đường — LoginForm đưa họ về dashboard theo vai
                trò thật trong token. */}
            {/* Suspense bắt buộc: LanguageSwitcher đọc `useSearchParams` để giữ
                nguyên bộ lọc khi đổi ngôn ngữ, và Next từ chối prerender bất kỳ
                trang nào có hook đó nằm ngoài ranh giới Suspense. Shell này bọc
                **mọi** trang công khai, nên thiếu nó là hỏng cả những trang không
                liên quan gì tới bộ lọc. */}
            <Suspense fallback={<span className="hidden w-9 sm:block" />}>
              <LanguageSwitcher locale={locale} label={t('shell.languageLabel')} />
            </Suspense>
            <Link
              href={localePath(locale, '/dang-ky-ktv')}
              className="ml-1 shrink-0 whitespace-nowrap rounded-md border border-brand-200 px-3 py-1.5 font-medium text-brand-700 transition hover:bg-brand-50"
            >
              {t('shell.navForKtv')}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-shell flex-1 px-4 py-8 sm:py-10">{children}</main>

      <footer className="mt-auto border-t border-ink-200 bg-white">
        <div className="mx-auto max-w-shell px-4 py-8 text-body-s text-ink-500">
          <p className="max-w-prose">
            {t('shell.footerBlurb', { siteName })}
          </p>
        </div>
      </footer>
    </div>
  );
}
