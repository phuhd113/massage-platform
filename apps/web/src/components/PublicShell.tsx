import Link from 'next/link';
import { Suspense } from 'react';
import { LanguageFlags } from '@/components/LanguageFlags';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LEGAL_PAGES } from '@/components/LegalPage';
import { LocationNavButton } from '@/components/LocationNavButton';
import { SiteLogo } from '@/components/SiteLogo';
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
        {/* Đệm ngang và khoảng cách logo↔nav thu lại dưới `sm`: sau khi cụm cờ vào
            thanh này, 16px mỗi bên là khoảng trống lớn nhất còn cắt được mà không
            đụng tới bất kỳ chữ nào. Đo ở 360px trước và sau — xem ghi chú ở nút vị trí. */}
        <div className="mx-auto flex max-w-shell items-center justify-between gap-2 px-3 py-3.5 sm:gap-4 sm:px-4">
          {/*
              Khối logo: logo MasGo ở trên, một dòng định vị nhỏ ở dưới. Header cao
              thêm ~10px, nhưng nó là `sticky top-0` và có mặt ngay từ lần vẽ đầu nên
              đó không phải layout shift, và mọi `scroll-mt-20` trên trang vẫn dư chỗ.

              **Hai biến thể logo, đổi theo breakpoint.** Ở 360px thanh này còn phải
              chứa nút vị trí (rộng tới 9rem) và nút "Trở thành KTV MasGo", nên logo ngang
              (181px ở chiều cao 32px) sẽ bóp cả hai; dưới `sm` dùng bản chỉ có phần
              hình, rộng ~42px. Cả hai đều nằm trong DOM và ẩn bằng CSS chứ không
              render có điều kiện: `useMediaQuery` ở đây nghĩa là server và client vẽ
              hai thứ khác nhau ở lần render đầu — đúng bẫy hydration đã ghi ở
              `lib/saved-area.ts`. Vì cả hai cùng trong DOM nên chỉ **một** bản mang
              `alt`; bản kia `alt=""` để trình đọc màn hình không đọc tên sàn hai lần.

              Tên sàn nay nằm trong chính ảnh logo, nên khối `<span>` render `siteName`
              đã bỏ — giữ lại là hiện tên sàn hai lần cạnh nhau. Nó không biến mất khỏi
              accessibility tree: `alt` của logo ngang chính là tên sàn.

              Dòng tagline **ẩn ở mobile**, cùng lý do chỗ hẹp. Nó là chữ bổ trợ chứ
              không phải điều hướng — mất ở mobile không mất đường đi nào. Cố ý giữ
              dạng **text thật** thay vì dùng bản logo có sẵn tagline: tagline trong
              file logo gốc là chữ **trắng**, tàng hình trên nền trắng của header (đã
              dựng thử trước khi chốt), và chữ trong ảnh thì Google lẫn trình đọc màn
              hình đều không đọc được.

              Tagline nằm trong CÙNG một `<Link>` và mang `aria-hidden`: tách thành hai
              link tới cùng một đích là hai điểm dừng tab và hai lần đọc cho trình đọc
              màn hình, đổi lấy đúng không gì cả.
          */}
          <Link
            href={localePath(locale, '/')}
            className="flex shrink-0 items-center gap-2 transition hover:opacity-80"
          >
            {/*
              Bản logo NGANG ở mọi cỡ màn hình, kể cả điện thoại.

              Trước đây mobile dùng riêng `SiteLogoMark` (chỉ phần hình) để nhường chỗ
              cho nút vị trí và nút KTV. Đổi lại: tên sàn phải đọc được ngay trên header
              ở đúng thiết bị chiếm phần lớn traffic — một dấu hình không kèm chữ thì
              người lần đầu vào không biết mình đang ở đâu.

              Cỡ **đo ra chứ không chọn theo cảm giác**. Bản ngang tỉ lệ ~5.64:1 nên
              chiều cao quyết định bề ngang: `h-7` cho logo rộng 159px, và ở 360px thì
              159 + 96 (nút vị trí) + 103 (nút KTV) + đệm = 399px, tức **tràn 39px** —
              đã đo trong trình duyệt thật ở 360px và 390px, cả hai đều tràn. `h-5` đưa
              logo về ~113px và cả ba cỡ đều vừa.

              Không thu bằng cách bỏ chữ trên nút KTV: nhãn đó là lời mời, còn logo chỉ
              cần đọc được tên sàn.

              Dòng tagline **chỉ** hiện từ `md` — thêm nó ở mobile là ép header cao hai
              dòng trên đúng màn hình hẹp nhất. Mốc là `md` chứ không `sm` vì **bản EN
              tràn ở đúng dải 640–767px**: đã đo, header 645/640 với tagline
              "Need a massage - Open MasGo.vn". Nav tiếng Anh dài hơn tiếng Việt
              ("Become a therapist"), nên `sm` đúng cho vi lại chật với en — và gate
              theo ngôn ngữ thì hai bản lệch nhau ở cùng một bề rộng.
            */}
            <span className="flex min-w-0 flex-col items-center leading-none">
              <SiteLogo alt={siteName} className="h-5 w-auto shrink-0 sm:h-8" />
              {/* KHÔNG `uppercase`: chuỗi này là slogan chứa tên sàn, và viết hoa toàn
                  bộ sẽ biến "MasGo.vn" thành "MASGO.VN" — nghiền mất cách viết thương
                  hiệu ở đúng chỗ nó đứng cạnh logo. Chữ hoa nay do chính chuỗi trong
                  `i18n` mang, xem ghi chú ở `shell.logoTagline`. */}
              <span
                aria-hidden
                className="mt-1 hidden whitespace-nowrap text-label text-ink-500 md:block"
              >
                {t('shell.logoTagline')}
              </span>
            </span>
          </Link>

          {/* Hai mục, cố ý.

              Trước đây có bảy: thêm TP.HCM, Hà Nội, "Cách duyệt hồ sơ" và lời mời
              đăng nhập của khách. Cả bốn đều vào được từ chỗ khác — hai thành phố
              nằm trong khối khu vực ở trang chủ và trong breadcrumb của mọi trang
              quận, khối ba bước có link ngay trên trang chủ, còn khách cần đăng nhập
              thì gần như luôn đang đứng ở một hồ sơ để viết đánh giá, nơi `ReviewForm`
              đã mời họ đúng lúc. Không đường nào của Google mất đi. */}
          <nav className="flex min-w-0 items-center gap-0.5 text-body-s sm:gap-1">
            {/* Trang chủ đứng trước mục vị trí: nó là đường lui chung cho khách đáp
                thẳng từ Google xuống một hồ sơ hay một trang quận — ở đó breadcrumb
                chỉ dẫn ngược lên trang khu vực chứ không về trang chủ.

                Logo vốn đã trỏ về cùng đích, nhưng "logo bấm được" là quy ước người
                dùng phải **biết trước** mới dùng được; một link có chữ thì không.
                Hai link cùng đích trong một trang không phải trùng lặp SEO — Google
                gộp chúng lại.

                Ẩn dưới `sm`: ở 360px thanh này đã phải chứa logo, cụm cờ, nút vị trí
                và nút KTV. Mobile không mất đường về — logo vẫn ở đó, và footer có
                nguyên hàng link. */}
            <Link
              href={localePath(locale, '/')}
              className="hidden shrink-0 rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
            >
              {t('shell.navHome')}
            </Link>

            {/* Mục thứ hai là vị trí: câu hỏi đầu tiên của khách luôn là "ai đang ở
                gần tôi", và đây là màn hình mà mọi trang công khai đều có. */}
            <LocationNavButton
              locale={locale}
              labels={{
                choose: t('shell.navLocation'),
                locating: t('filters.locating'),
                failed: t('filters.geoFailed'),
                unsupported: t('filters.geoUnsupported'),
                denied: t('filters.geoDenied'),
                dismiss: t('filters.geoDismiss'),
              }}
              // `max-w` ba bậc, **đo ra chứ không chọn theo cảm giác**. Cụm cờ thêm
              // vào thanh này 64px, và ở 360px thì logo 114 + vị trí 119 + KTV 103 +
              // cờ 64 + đệm = 400px trên 345px khả dụng, tức **tràn 99px** (đã đo
              // trong trình duyệt thật trước khi thu). Nút vị trí là mục duy nhất co
              // được mà không mất thông tin: nhãn của nó đã `truncate`, nên thu
              // `max-w` chỉ cắt ngắn tên quận chứ không bỏ mất chữ nào khác.
              //
              // Không thu bằng cách bỏ hẳn chữ để còn icon: một dấu ống ngắm trần
              // không nói được rằng nó đang giữ **tên quận đã lưu** của khách — mà
              // đó chính là lý do nhãn này hiện tên chứ không hiện "Chọn vị trí".
              className="flex min-w-0 max-w-[4.75rem] shrink items-center gap-1 rounded-md px-1.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60 sm:max-w-[9rem] sm:gap-1.5 sm:px-2.5 lg:max-w-[12rem]"
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
              // Đệm ngang hẹp hơn dưới `sm` (`px-2` thay `px-3`): cùng phép đo với
              // nút vị trí ngay trên — sau khi cụm cờ vào thanh, 4px mỗi bên ở đây là
              // phần cuối cùng còn cắt được mà không đụng tới chữ.
              className="shrink-0 whitespace-nowrap rounded-md border border-brand-200 px-2 py-1.5 font-medium text-brand-700 transition hover:bg-brand-50 sm:ml-1 sm:px-3"
            >
              {/* Bản ngắn dưới `sm`, bản đủ từ `sm` trở lên: chuỗi mới dài gần gấp đôi
                  chuỗi cũ, mà ở 360px thanh này còn phải chứa nút vị trí rộng tới 9rem.
                  Hai chuỗi rời từ i18n chứ không cắt bằng JS — xem ghi chú ở `vi.ts`. */}
              <span className="sm:hidden">{t('shell.navForKtvShort')}</span>
              <span className="hidden sm:inline">{t('shell.navForKtv')}</span>
            </Link>

            {/* Cụm cờ đứng **cuối** nav, sau nút KTV: nó không phải điều hướng mà là
                một tuỳ chọn hiển thị, và khách chọn nó nhiều nhất một lần mỗi phiên.
                Đặt trước hai mục kia là để thứ ít dùng nhất chắn đường thứ dùng liên tục.

                Bản chữ ở footer **giữ nguyên**, không bị thay thế: cờ là hình không
                kèm chữ, nên người dùng trình đọc màn hình và người không nhận ra cờ
                vẫn cần một lối gọi tên ngôn ngữ ra bằng chữ. Hai lối, một đích.

                Suspense bắt buộc, cùng lý do đã ghi ở khối footer: component đọc
                `useSearchParams` để giữ nguyên bộ lọc khi đổi ngôn ngữ, và Next từ
                chối prerender bất kỳ trang nào có hook đó nằm ngoài ranh giới
                Suspense. Fallback giữ đúng kích thước cụm cờ để header không nhảy
                một nhịp khi nó hiện ra. */}
            <Suspense
              fallback={
                <span className="ml-0.5 h-[1.875rem] w-[2rem] shrink-0 sm:ml-1 sm:w-[3.75rem]" />
              }
            >
              <LanguageFlags locale={locale} label={t('shell.languageLabel')} />
            </Suspense>
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

          {/* Hàng pháp lý tách khỏi hàng điều hướng ở trên, không trộn chung.
              Hai nhóm trả lời hai câu hỏi khác hẳn nhau — "đi đâu tiếp" và "sàn này
              cam kết gì" — và gộp lại thì ba link pháp lý lẫn giữa các link khu vực,
              tức người đi tìm chính sách dữ liệu phải đọc hết cả hàng.

              Footer nằm trong HTML của **mọi** trang công khai, nên đây cũng là thứ
              làm ba trang này thật sự tồn tại với cả khách lẫn Googlebot. Không có
              đường vào từ giao diện thì một trang không tồn tại với người dùng —
              lỗi đã cắn bốn lần trong dự án này, xem rules. Dựng từ LEGAL_PAGES nên
              thêm trang pháp lý thứ tư là nó tự có mặt ở đây. */}
          <nav className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-100 pt-4">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.path}
                href={localePath(locale, page.path)}
                className="transition hover:text-brand-700"
              >
                {t(page.labelKey)}
              </Link>
            ))}
          </nav>

          <p className="mt-4 max-w-prose">{t('shell.footerBlurb', { siteName })}</p>
        </div>
      </footer>
    </div>
  );
}
