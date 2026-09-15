'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { type Locale, localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { hasDismissedBetaNotice, markBetaNoticeDismissed } from '@/lib/beta-notice';
import { SITE_NAME } from '@/lib/site';

/**
 * Thông báo giai đoạn thử nghiệm, tự hiện **một lần** cho khách vào trang công khai.
 *
 * Đây là chỗ **thứ hai** trong dự án có popup tự bật, sau `KtvAnnouncement` (dashboard
 * KTV). Hai cái khác nhau ở người đọc và ở nội dung: bản kia nói với KTV đã đăng nhập
 * về chính sách thu phí, bản này nói với **khách chưa đăng nhập** về việc danh sách
 * còn đang được bổ sung. Cố ý không gộp — gộp thì một trong hai nhóm đọc phải nửa
 * không dành cho mình.
 *
 * **Luật hiển thị lặp lại đúng bốn điều đã rút ra từ `KtvAnnouncement` và popup lọc
 * ở `/tim-kiem`**, đừng vô tình đảo ngược cái nào:
 *
 * - **Ghi nhận đã đọc ngay lúc MỞ, không đợi lúc đóng.** Khách đóng tab giữa chừng vẫn
 *   là đã thấy; hiện lại ở lần vào sau đọc như lỗi lặp.
 * - **Đọc localStorage trong `useEffect`, không lúc khởi tạo state.** Server không có
 *   localStorage nên đọc ở lần render đầu cho hai kết quả khác nhau giữa server và
 *   client → hydration mismatch. Cùng bẫy đã ghi ở `lib/saved-area.ts`.
 * - **Nội dung KHÔNG nằm trong HTML ban đầu**, khác hẳn bản dải ghim trước đó. Đó là
 *   cái giá đã cân nhắc khi chọn popup: câu chữ ở đây là lời chào và lời mời, không
 *   phải nội dung Google cần đọc — lời hứa "hồ sơ đã đối chiếu danh tính" vẫn nằm ở
 *   footer và `/an-toan`, nơi nó ở trong HTML thô của mọi trang.
 * - **Khoá cuộn nền và Esc để đóng**, cùng lý do đã ghi ở `BetaAnnouncementDialog`:
 *   nội dung dài nên hộp tự cuộn, mà không khoá thì cuộn hết hộp là cuộn tiếp trang
 *   bên dưới — trên điện thoại đọc như hộp thoại bị trôi đi.
 *
 * Không dùng lại `BetaAnnouncementDialog`: file đó là **nội dung** dành cho KTV (chính
 * sách thu phí, hai số Ban quản trị) và chỉ có tiếng Việt. Ở đây cần song ngữ và cần
 * hai lối ra khác nhau cho hai nhóm người. Chung nhau phần luật hiển thị thì có, nhưng
 * gộp nội dung là để một bản trôi khỏi bản kia — đúng điều ghi chú ở file đó cảnh báo.
 */
export function BetaNoticeDialog({ locale }: { locale: Locale }) {
  // Nhận `locale` rồi tự dựng translator, KHÔNG nhận `t` qua prop: `t` là một hàm và
  // hàm không đi qua được ranh giới server → client component. Cùng mẫu với
  // `HeroSearch`, `ContactButtons` và mọi client component khác có chữ trong dự án.
  const t = createTranslator(getDictionary(locale), locale);
  const siteName = SITE_NAME[locale];

  // Mặc định đóng để khớp HTML server — lần render đầu không có popup, nó xuất hiện
  // ngay sau đó. Đúng thứ tự mong muốn: nội dung trang hiện trước rồi thông báo chồng
  // lên, chứ không chặn bằng một màn hình trắng.
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasDismissedBetaNotice()) return;
    markBetaNoticeDismissed();
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const close = () => setOpen(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-0 sm:items-center sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="beta-notice-title"
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-[600px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-card focus:outline-none sm:max-h-[88vh] sm:rounded-2xl"
      >
        {/* Đầu hộp thoại dính trên: nội dung dài nên nút đóng phải luôn trong tầm với,
            không bắt cuộn xuống đáy mới thoát được. Cùng mẫu với BetaAnnouncementDialog. */}
        <div className="flex items-start gap-3 bg-brand-500 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-label uppercase tracking-wide text-brand-200">
              {t('betaNotice.badge')}
            </p>
            <h2 id="beta-notice-title" className="mt-1 text-h4 text-white sm:text-h3">
              {t('betaNotice.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('betaNotice.dismiss')}
            className="-mr-1.5 -mt-1 shrink-0 rounded-full p-2 text-brand-200 transition hover:bg-brand-600 hover:text-white"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <p className="text-body text-ink-700">{t('betaNotice.summary', { siteName })}</p>

          <p className="mt-3 text-body-s text-ink-600">{t('betaNotice.intro')}</p>

          {/* Hai đoạn đối tượng dựng bằng `<dl>`: nhãn và nội dung là cặp thật, và cấu
              trúc đó nói đúng điều đang xảy ra cho trình đọc màn hình — hai khối thông
              tin cho hai nhóm người, không phải một đoạn văn dài.

              Xếp DỌC ở mọi cỡ, khác bản dải ghim trước: hộp thoại chỉ rộng 600px nên
              hai cột cạnh nhau còn ~260px mỗi cột, đủ hẹp để mọi tiêu đề ngắt hai dòng. */}
          <dl className="mt-4 space-y-3">
            <Audience
              label={t('betaNotice.forCustomersLabel')}
              body={t('betaNotice.forCustomers')}
            />
            {/* Champagne dành riêng cho đặc quyền mua được / vị trí trả phí — xem ghi
                chú token trong tailwind.config.ts. Quyền lợi của nhóm KTV tham gia sớm
                đúng là loại đó, và cùng lý do `BetaAnnouncementDialog` đã dùng nó. */}
            <Audience
              label={t('betaNotice.forKtvLabel')}
              body={t('betaNotice.forKtv')}
              accent
            />
          </dl>

          <p className="mt-4 text-body text-ink-700">{t('betaNotice.closing', { siteName })}</p>
        </div>

        {/* Chân dính đáy, cùng lý do với đầu dính trên. `pb-[max(...)]` chừa chỗ cho
            thanh cử chỉ ở iPhone — không có thì nút nằm đúng dưới vạch home.

            Hai lối ra, mỗi nhóm một lối: thông báo này nói với hai đối tượng nên kết
            bằng một nút chung là bỏ rơi một trong hai. Cả hai đích đều là trang đã có,
            không dựng luồng mới — cùng nguyên tắc đã ghi ở `/lien-he`: mỗi mục dẫn tới
            một luồng đã tồn tại, KHÔNG thay thế nó. Bấm vào link là rời hộp thoại, nên
            cả hai cũng đóng nó luôn — để lại lớp phủ trên trang đích là một popup không
            ai mở còn chắn đường. */}
        <div className="border-t border-ink-100 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={localePath(locale, '/dang-ky-ktv')}
              onClick={close}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-brand-500 px-5 py-3 text-body font-semibold text-white shadow-button transition hover:bg-brand-600"
            >
              {t('betaNotice.ctaKtv')}
            </Link>
            <Link
              href={localePath(locale, '/tim-kiem')}
              onClick={close}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-brand-300 px-5 py-3 text-body font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              {t('betaNotice.ctaCustomer')}
            </Link>
          </div>
          <button
            type="button"
            onClick={close}
            className="mt-2 w-full rounded-full px-5 py-2 text-body-s font-medium text-ink-500 transition hover:text-ink-700"
          >
            {t('betaNotice.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Audience({
  label,
  body,
  accent = false,
}: {
  label: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? 'rounded-xl border border-champagne-200 bg-champagne-50 px-4 py-3'
          : 'rounded-xl border border-ink-200 bg-ink-25 px-4 py-3'
      }
    >
      <dt
        className={`text-body font-semibold ${accent ? 'text-champagne-600' : 'text-ink-900'}`}
      >
        {label}
      </dt>
      <dd className="mt-1 text-body-s text-ink-600">{body}</dd>
    </div>
  );
}
