import Link from 'next/link';
import { LogoutButton } from '@/components/LogoutButton';
import { SiteLogo } from '@/components/SiteLogo';
import { type Locale, localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { SITE_NAME } from '@/lib/site';

/**
 * Màn hình cho tài khoản **khách** đã đăng nhập bấm vào lối vào KTV.
 *
 * Thay cho một lần chuyển hướng im lặng: `redirectIfAuthenticated` đưa tài khoản
 * CUSTOMER về `/`, mà `/` thường chính là trang họ vừa bấm nút — nên cú bấm trông
 * như không có gì xảy ra. Đã đo được: `307 → http://localhost:3000/`. Nút header
 * đổi thành lời mời rõ ràng ("Trở thành KTV MasGo") làm lỗi này tệ hơn hẳn, vì người
 * bấm đang có ý định cụ thể chứ không chỉ đi lang thang.
 *
 * Cùng họ với màn hình đã có ở `/dashboard` cho tài khoản CUSTOMER, và cùng lý do:
 * "đã đăng nhập nhưng sai vai trò" là một trạng thái có thật, khác hẳn "chưa đăng
 * nhập", nên nó phải có màn hình riêng chứ không được dịch thành một redirect.
 *
 * **Nói thẳng rằng phải đăng xuất.** Vai trò chốt lúc tạo tài khoản và không đổi
 * được, nên nếu chỉ đưa họ sang `/dang-ky-ktv` thì backend trả 409 ("số đã có tài
 * khoản") — đúng lúc họ tưởng mình đang làm đúng.
 */
export function AlreadySignedIn({ locale }: { locale: Locale }) {
  const t = createTranslator(getDictionary(locale), locale);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5">
          {/* Bản logo NGANG: nó đã mang sẵn chữ "MasGo", nên KHÔNG kèm thêm một
              <span>{SITE_NAME}</span> bên cạnh — hai thứ đó cạnh nhau đọc ra "MasGo MasGo".
              Tên sàn vẫn đọc được bởi trình đọc màn hình qua `alt`. */}
          <SiteLogo alt={SITE_NAME[locale]} className="h-8 w-auto shrink-0" />
        </div>

        <h1 className="mt-8 text-h2 text-ink-900">{t('login.alreadyTitle')}</h1>
        <p className="mt-2.5 text-body-l leading-[25px] text-ink-600">{t('login.alreadyBody')}</p>

        <div className="mt-7 grid gap-3">
          {/* Đăng xuất là hành động chính: nó là bước bắt buộc để làm được việc họ
              vừa bấm nút để làm. `nextHref` trỏ thẳng cửa đăng ký KTV nên sau khi
              thoát họ ở đúng chỗ cần tới, không phải tự tìm lại. */}
          <LogoutButton
            labels={{ logout: t('login.alreadyLogout'), loggingOut: t('login.submitting') }}
            className="w-full rounded-md bg-brand-500 px-5 py-3 text-center font-semibold text-white shadow-button transition hover:bg-brand-600 disabled:opacity-60"
            nextHref={localePath(locale, '/dang-ky-ktv')}
          />

          <Link
            href={localePath(locale, '/')}
            className="w-full rounded-md border border-ink-200 px-5 py-3 text-center font-semibold text-ink-700 transition hover:bg-ink-50"
          >
            {t('login.alreadyHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
