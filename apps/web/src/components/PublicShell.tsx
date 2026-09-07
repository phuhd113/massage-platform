import Link from 'next/link';
import { Suspense } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LocationNavButton } from '@/components/LocationNavButton';
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

          {/* Ba mục, cố ý.

              Trước đây có bảy: thêm TP.HCM, Hà Nội, "Cách duyệt hồ sơ" và lời mời
              đăng nhập của khách. Cả bốn đều vào được từ chỗ khác — hai thành phố
              nằm trong khối khu vực ở trang chủ và trong breadcrumb của mọi trang
              quận, khối ba bước có link ngay trên trang chủ, còn khách cần đăng nhập
              thì gần như luôn đang đứng ở một hồ sơ để viết đánh giá, nơi `ReviewForm`
              đã mời họ đúng lúc. Không đường nào của Google mất đi. */}
          <nav className="flex items-center gap-1 text-body-s">
            {/* Mục đầu tiên là vị trí: câu hỏi đầu tiên của khách luôn là "ai đang ở
                gần tôi", và đây là màn hình mà mọi trang công khai đều có. */}
            <LocationNavButton
              locale={locale}
              labels={{
                choose: t('shell.navLocation'),
                locating: t('filters.locating'),
                failed: t('filters.geoFailed'),
                unsupported: t('filters.geoUnsupported'),
              }}
              className="flex max-w-[9rem] shrink items-center gap-1.5 rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 sm:max-w-[12rem]"
            />
            {/* Trỏ vào `/dang-nhap` chứ không `/dang-ky-ktv`: phần lớn KTV bấm nút
                này là người **đã có** hồ sơ và đang muốn vào làm việc, nên đưa họ
                thẳng tới ô đăng nhập. Người chưa có tài khoản đi tiếp một bước qua
                link "Tạo tài khoản" ngay dưới form — ngược lại thì người quay lại
                mỗi ngày phải đi vòng, mà họ mới là số đông.

                Không trỏ vào `/dashboard`: người bấm từ trang công khai thường chưa
                đăng nhập, nên đó chỉ là một lần chuyển hướng thừa tới đúng chỗ này.
                KTV đã có phiên vẫn về đúng dashboard vì form điều hướng theo vai trò
                **thật** trả về từ server. */}
            <Link
              href={localePath(locale, '/dang-nhap')}
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
          {/* Những link đã rời header xuống đây, không biến mất: hai thành phố lớn
              và khối "cách duyệt hồ sơ" vẫn là đường đi hợp lệ cho cả khách lẫn
              Googlebot — chúng chỉ không còn chiếm chỗ trên thanh khách nhìn suốt
              phiên. Footer nằm trong HTML của mọi trang công khai nên giá trị liên
              kết nội bộ giữ nguyên. */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* Đường cố định tới trang tìm kiếm sau khi "Tìm KTV" rời header. Trên
                header nó thừa — mục vị trí đã dẫn thẳng vào đây, và khách đáp từ
                Google xuống một hồ sơ vẫn đi tiếp được bằng breadcrumb về trang
                quận. Nhưng vẫn phải có **một** đường không phụ thuộc vào GPS, cho cả
                khách từ chối quyền định vị lẫn Googlebot. */}
            <Link
              href={localePath(locale, '/tim-kiem')}
              className="transition hover:text-brand-700"
            >
              {t('shell.navFindKtv')}
            </Link>
            <Link
              href={areaPath(locale, 'tp-ho-chi-minh')}
              className="transition hover:text-brand-700"
            >
              {t('shell.navHcm')}
            </Link>
            <Link href={areaPath(locale, 'ha-noi')} className="transition hover:text-brand-700">
              {t('shell.navHanoi')}
            </Link>
            <Link
              href={localePath(locale, '/#cach-duyet-ho-so')}
              className="transition hover:text-brand-700"
            >
              {t('shell.navHowWeVerify')}
            </Link>

            {/* Đổi ngôn ngữ nằm ở đây thay vì header: khách chọn nó một lần rồi
                thôi, nên nó không đáng chiếm một ô trên thanh điều hướng — nhưng
                vẫn phải có mặt trên mọi trang, vì đây là **lối duy nhất** đổi ngôn
                ngữ (middleware cố ý không đoán theo Accept-Language).

                Suspense bắt buộc: LanguageSwitcher đọc `useSearchParams` để giữ
                nguyên bộ lọc khi đổi ngôn ngữ, và Next từ chối prerender bất kỳ
                trang nào có hook đó nằm ngoài ranh giới Suspense. Shell này bọc
                **mọi** trang công khai, nên thiếu nó là hỏng cả những trang không
                liên quan gì tới bộ lọc. */}
            <Suspense fallback={<span className="w-16" />}>
              <LanguageSwitcher locale={locale} label={t('shell.languageLabel')} />
            </Suspense>
          </nav>

          <p className="mt-4 max-w-prose">{t('shell.footerBlurb', { siteName })}</p>
        </div>
      </footer>
    </div>
  );
}
