'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckIcon } from '@/components/icons';
import { SiteLogo } from '@/components/SiteLogo';
import { type Locale, localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { VN_PHONE_PATTERN, normalizePhone } from '@/lib/phone';
import { SITE_NAME } from '@/lib/site';
import { useFormValidation } from '@/lib/use-form-validation';
import { messagesFor } from '@/lib/validation-messages';

/**
 * Vai trò xin cấp cho **tài khoản mới**. Chỉ có tác dụng ở chế độ đăng ký; đăng nhập
 * thì vai trò đã nằm sẵn trên tài khoản.
 */
export type AuthRole = 'CUSTOMER' | 'KTV';

type Mode = 'login' | 'register';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Cột phải của cửa KTV, nạp riêng vì **chỉ một trong ba cửa dùng tới nó**.
 *
 * Import tĩnh thì webpack gom nó vào chunk chung của form, và chunk đó được nạp ở cả
 * `/dang-nhap` lẫn `/dang-ky` — hai màn hình của khách, nơi `isKtv` luôn false nên
 * khối này không bao giờ render. Đã đo trên bản build trước khi sửa: chuỗi nội dung
 * thông báo có mặt trong bundle của cả ba cửa.
 *
 * **Giữ SSR** (không `ssr: false`): khối này chiếm hẳn cột phải trên desktop, nên bỏ
 * nó khỏi HTML server-render là để cột phải trống ở lần vẽ đầu rồi mới hiện — một
 * cú chớp ngay cạnh ô nhập, đổi lấy đúng một lượt tải mà `dynamic` vốn đã lo. Cái
 * cần tránh là gửi mã này cho hai cửa khách, và tách chunk đã đủ làm việc đó.
 */
const KtvBetaAside = dynamic(() =>
  import('@/components/KtvBetaAside').then((m) => m.KtvBetaAside),
);

/**
 * Đăng nhập / đăng ký bằng số điện thoại + mật khẩu.
 *
 * Đây là lối vào của giai đoạn đầu: Zalo ZNS đòi giấy phép kinh doanh mà dự án chưa
 * có, nên đường OTP tuy còn nguyên ở backend nhưng không dùng được với người thật.
 * `LoginForm` (bản OTP) vẫn nằm cạnh file này để bật lại khi có giấy phép.
 *
 * **Đăng nhập và đăng ký là hai màn hình tách biệt**, khác hẳn OTP. Với OTP thì hai
 * thao tác là một — số chưa có tài khoản thì backend tạo mới. Với mật khẩu thì không:
 * hệ thống không biết người gõ sai mật khẩu là ai, nên gộp lại sẽ hoặc phải lộ "số
 * này đã có tài khoản" (mở đường dò), hoặc trả một câu lỗi không nói được gì.
 */
export function PasswordAuthForm({
  mode: initialMode,
  role = 'CUSTOMER',
  redirectTo,
  locale,
  showTabs = false,
}: {
  mode: Mode;
  role?: AuthRole;
  locale: Locale;
  /**
   * Hiện hàng tab Đăng nhập / Đăng ký ngay trên form.
   *
   * Chỉ `/dang-nhap` bật cờ này. Hai trang `/dang-ky` và `/dang-ky-ktv` cố ý KHÔNG
   * bật: chúng là cửa theo **đối tượng** (khách / KTV) và mỗi cửa quyết định vai trò
   * của tài khoản sẽ tạo ra, nên một tab "Đăng nhập" ở đó chỉ là đường rời khỏi việc
   * người dùng vừa chọn — trong khi dòng "Đã có tài khoản?" ở đáy đã làm đúng việc đó
   * mà không chiếm chỗ đầu màn hình.
   */
  showTabs?: boolean;
  /**
   * Nơi đưa khách về sau khi vào được. Bỏ trống thì về trang chủ — khách bấm đăng
   * nhập từ một hồ sơ KTV để viết đánh giá cần quay đúng về hồ sơ đó.
   *
   * KTV luôn về `/dashboard` bất kể tham số này, xem `submit()`.
   */
  redirectTo?: string;
}) {
  const router = useRouter();
  const t = createTranslator(getDictionary(locale), locale);
  /*
    `mode` là state chứ không còn là prop thuần: hàng tab đổi nó tại chỗ, không điều
    hướng. Chuyển trang cho một thao tác đổi form là bắt người dùng chờ một vòng server
    chỉ để thấy đúng hai ô nhập họ đang nhìn, và mất luôn số điện thoại vừa gõ.

    Khởi tạo từ prop nên ba trang vẫn vào đúng chế độ của mình, và `/dang-nhap` mở ra
    vẫn là tab Đăng nhập — đúng thứ đường dẫn đó hứa.
  */
  const [mode, setMode] = useState<Mode>(initialMode);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Thay thông báo validate của trình duyệt bằng chuỗi theo ngôn ngữ trang.
  const formRef = useFormValidation(messagesFor(locale));

  /**
   * Đổi tab.
   *
   * Xoá `error` là bắt buộc, không phải dọn dẹp cho gọn: câu lỗi của lần đăng nhập
   * hỏng ("Sai số điện thoại hoặc mật khẩu") mà còn nằm lại trên tab Đăng ký vừa mở
   * sẽ đọc như lời từ chối chính thao tác người dùng chưa hề thực hiện.
   *
   * Giữ nguyên `phone`: người bấm nhầm tab rồi đổi sang tab kia gần như luôn muốn
   * dùng lại đúng số vừa gõ. Nhưng xoá `password`/`confirm` — hai chế độ có ràng
   * buộc khác nhau (đăng ký cần tối thiểu 8 ký tự và ô nhập lại), nên mang mật khẩu
   * cũ sang là để một ô đã điền nhưng không thoả điều kiện của form mới.
   */
  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setPassword('');
    setConfirm('');
  }

  const isRegister = mode === 'register';
  const isKtv = role === 'KTV';

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // Kiểm ở client trước khi gọi mạng: hai lỗi này người dùng sửa được ngay, và
    // bắt họ chờ một vòng đi server để nghe "hai mật khẩu không khớp" là phí.
    // Backend vẫn kiểm lại — đây chỉ là để phản hồi nhanh, không phải chốt chặn.
    if (isRegister && password !== confirm) {
      setError(t('login.errorPasswordMismatch'));
      return;
    }
    if (isRegister && password.length < MIN_PASSWORD_LENGTH) {
      setError(t('login.errorPasswordShort', { length: MIN_PASSWORD_LENGTH }));
      return;
    }

    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Chuẩn hoá ở đường gửi, không phải lúc gõ: sửa giá trị dưới tay người đang
        // gõ làm nhảy con trỏ. Dấu cách và "+84" người dùng (hoặc trình duyệt tự
        // điền) đưa vào không đổi nghĩa của số, nhưng đủ để regex backend từ chối.
        body: JSON.stringify({ mode, phone: normalizePhone(phone), password, role }),
      });
      const data = (await res.json()) as { role?: string };

      if (!res.ok) {
        // Map theo HTTP status, không hiện message của backend: message ấy chỉ có
        // tiếng Việt, nên đẩy ra là để một câu tiếng Việt hiện giữa giao diện tiếng
        // Anh. Bốn nhánh này dẫn tới bốn hành động khác nhau của người dùng, nên gộp
        // thành một câu chung là bắt họ tự đoán nên làm gì tiếp.
        //
        // 400 là **dữ liệu không hợp lệ** (FluentValidation), không phải "bị khoá".
        // Nhầm hai thứ này là lỗi đã cắn: số điện thoại sai định dạng ở lần thử đầu
        // tiên hiện ra "sai quá nhiều lần nên tài khoản tạm khoá", khiến người dùng
        // ngồi chờ 15 phút cho một lỗi họ sửa được ngay. Khoá tài khoản nay là 429.
        setError(
          res.status === 401
            ? t('login.errorWrongCredentials')
            : res.status === 409
              ? t('login.errorPhoneTaken')
              : res.status === 429
                ? t('login.errorLocked')
                : res.status === 400
                  ? t('login.errorInvalidPhone')
                  : t('login.errorNetwork'),
        );
        return;
      }

      // refresh trước push để server component đọc được cookie vừa đặt, nếu không
      // dashboard render bằng phiên cũ và đá ngược về đây.
      router.refresh();

      // Đi theo vai trò **thật** trả về từ server, không phải cửa vừa bước vào: KTV
      // đăng nhập ở trang khách vẫn phải về dashboard, còn khách thì không — dashboard
      // gọi API ví, và tài khoản khách nhận 403 ở đó rồi bị đá ngược lại đây thành
      // một vòng lặp đăng nhập không lối thoát.
      router.push(data.role === 'KTV' ? '/dashboard' : (redirectTo ?? localePath(locale, '/')));
    } catch {
      setError(t('login.errorNetwork'));
    } finally {
      setPending(false);
    }
  }

  const heading = isRegister
    ? isKtv
      ? t('login.headingRegisterKtv')
      : t('login.headingRegisterCustomer')
    : t('login.headingLogin');

  /**
   * "Chưa có tài khoản?" đưa đi đâu — quyết định theo cách khách tới trang này.
   *
   * `/dang-nhap` có hai lối vào rất khác nhau: KTV bấm "Trở thành KTV MasGo" trên header
   * (không `?next=`), và khách bấm mời đăng nhập ở `ReviewForm` trên một hồ sơ
   * (luôn kèm `?next=` trỏ về hồ sơ đó).
   *
   * Vai trò **chốt lúc tạo tài khoản** và không tự đổi được sau đó, nên gửi nhầm cửa
   * là hỏng im lặng: KTV tạo phải tài khoản CUSTOMER sẽ vào `/dashboard` chỉ thấy
   * màn hình giải thích, trong khi cả hai bước đều báo thành công.
   *
   * `redirectTo` chính là dấu hiệu phân biệt: có nghĩa là khách được mời từ một hồ
   * sơ — giữ nguyên nó qua trang đăng ký để họ quay lại đúng chỗ đang viết đánh giá.
   */
  const registerHref = redirectTo
    ? localePath(locale, `/dang-ky?next=${encodeURIComponent(redirectTo)}`)
    : localePath(locale, '/dang-ky-ktv');

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12 sm:px-12">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2.5">
            {/* Bản logo NGANG: nó đã mang sẵn chữ "MasGo", nên KHÔNG kèm thêm một
                <span>{SITE_NAME}</span> bên cạnh — hai thứ đó cạnh nhau đọc ra "MasGo MasGo".
                Tên sàn vẫn đọc được bởi trình đọc màn hình qua `alt`. */}
            <SiteLogo alt={SITE_NAME[locale]} className="h-8 w-auto shrink-0" />
          </div>

          {showTabs && (
            /*
              Hai tab đặt TRƯỚC tiêu đề, không phải sau: chúng quyết định phần bên dưới
              nói gì, nên đọc được thứ tự thì tiêu đề mới có nghĩa. Đây cũng là lý do
              tiêu đề và câu mở đổi theo tab thay vì đứng yên — một tiêu đề cố định phía
              trên hai tab sẽ mâu thuẫn với đúng một trong hai.

              `role="tablist"` + `aria-selected` chứ không phải hai <button> trần: trình
              đọc màn hình cần biết đây là hai lựa chọn loại trừ nhau, không phải hai
              hành động rời.
            */
            <div
              role="tablist"
              aria-label={t('login.tabAriaLabel')}
              className="mt-8 grid grid-cols-2 gap-1 rounded-lg bg-ink-100 p-1"
            >
              {(['login', 'register'] as const).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => switchMode(m)}
                    className={`rounded-md px-3 py-2 text-body font-semibold transition ${
                      active
                        ? 'bg-white text-ink-900 shadow-sm'
                        : 'text-ink-600 hover:text-ink-900'
                    }`}
                  >
                    {m === 'login' ? t('login.tabLogin') : t('login.tabRegister')}
                  </button>
                );
              })}
            </div>
          )}

          <h1
            className={`text-h1 text-ink-900 sm:text-[30px] sm:leading-9 ${
              showTabs ? 'mt-6' : 'mt-8'
            }`}
          >
            {heading}
          </h1>
          <p className="mt-2.5 text-body-l leading-[25px] text-ink-600">
            {isRegister ? t('login.introRegister') : t('login.introLogin')}
          </p>

          <form ref={formRef} onSubmit={submit} className="mt-7 grid gap-4">
            <label className="block">
              <span className="mb-1.5 block text-body font-semibold text-ink-700">
                {t('login.phoneLabel')}
              </span>
              {/* Cố ý KHÔNG có tiền tố "+84" đứng trước ô nhập.

                  Nó từng là một nhãn tĩnh: hiển thị nhưng **không** được gửi đi, trong
                  khi placeholder lại gợi ý "901 234 567". Người dùng làm đúng như được
                  gợi ý thì gửi lên chuỗi thiếu số 0 đầu, backend từ chối bằng 400 — và
                  400 lúc đó được map thành "tài khoản tạm khoá", một câu không liên
                  quan gì tới việc vừa xảy ra. Hệ thống lưu số ở dạng 0xxxxxxxxx, nên ô
                  nhập hỏi thẳng đúng dạng đó. */}
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                required
                autoFocus
                // Trình duyệt chặn ngay tại chỗ, kèm câu giải thích theo ngôn ngữ của
                // trang (`useFormValidation`) — thay vì phải đi một vòng gọi mạng rồi
                // dịch ngược một mã HTTP thành câu tiếng Việt.
                pattern={VN_PHONE_PATTERN}
                // `title` là câu hiện ra khi `pattern` không khớp (xem
                // `useFormValidation`) — nói thẳng dạng đúng thay vì "định dạng chưa
                // đúng", vốn không giúp người đang không biết mình sai ở đâu.
                title={t('login.errorInvalidPhone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0901 234 567"
                className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 font-mono text-h4 tracking-[0.02em] text-ink-900 transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-body font-semibold text-ink-700">
                {t('login.passwordLabel')}
              </span>
              <input
                type="password"
                // Nói cho trình quản lý mật khẩu biết đây là lượt tạo mới hay lượt
                // đăng nhập: sai giá trị thì nó đề nghị lưu mật khẩu cũ đè lên mật
                // khẩu mới, hoặc không đề nghị gì lúc đáng ra phải đề nghị.
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? MIN_PASSWORD_LENGTH : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-h4 text-ink-900 transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {isRegister && (
                <span className="mt-1.5 block text-body-s text-ink-500">
                  {t('login.passwordHint', { length: MIN_PASSWORD_LENGTH })}
                </span>
              )}
            </label>

            {isRegister && (
              <label className="block">
                <span className="mb-1.5 block text-body font-semibold text-ink-700">
                  {t('login.passwordConfirmLabel')}
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 text-h4 text-ink-900 transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            )}

            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-500 px-4 py-3.5 text-h4 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {pending
                ? t('login.submitting')
                : isRegister
                  ? t('login.submitRegister')
                  : t('login.submitLogin')}
            </button>
          </form>

          {error && (
            <p role="alert" className="mt-4 text-body-l text-danger-fg">
              {error}
            </p>
          )}

          <div className="mt-8 grid gap-2 border-t border-ink-100 pt-5 text-body text-ink-500">
            {/* Đường sang màn hình còn lại của cùng đối tượng. Với mật khẩu thì
                người dùng phải tự biết mình đã có tài khoản hay chưa, nên hai lối
                này là bắt buộc — không có chúng thì người đăng ký nhầm ở trang đăng
                nhập chỉ nhận được "sai số điện thoại hoặc mật khẩu". */}
            {/*
              Có tab rồi thì KHÔNG còn dòng "Chưa có tài khoản?" / "Đã có tài khoản?".
              Chúng làm đúng việc tab vừa làm, nhưng bằng một lần chuyển trang — để cả
              hai là cho cùng một thao tác hai lối đi ngay trên một màn hình, và lối
              kém hơn lại nằm đúng chỗ mắt dừng cuối cùng.
            */}
            {showTabs ? null : isRegister ? (
              <p>
                {t('login.hasAccountQuestion')}{' '}
                <Link
                  // Giữ `?next=` sang trang đăng nhập, cùng lý do với `registerHref`:
                  // khách bấm nhầm vào trang đăng ký từ một hồ sơ vẫn phải quay về
                  // đúng hồ sơ đó sau khi đăng nhập, chứ không rơi ra trang chủ.
                  href={
                    redirectTo
                      ? localePath(locale, `/dang-nhap?next=${encodeURIComponent(redirectTo)}`)
                      : localePath(locale, '/dang-nhap')
                  }
                  className="font-semibold text-brand-500 transition hover:text-brand-600"
                >
                  {t('login.hasAccountAction')}
                </Link>
              </p>
            ) : (
              <p>
                {t('login.noAccountQuestion')}{' '}
                <Link
                  href={registerHref}
                  className="font-semibold text-brand-500 transition hover:text-brand-600"
                >
                  {t('login.noAccountAction')}
                </Link>
              </p>
            )}
            {/* Cố ý KHÔNG có đường sang "cửa của đối tượng kia".

                Bản này chỉ mời KTV đăng nhập: header trỏ thẳng "Trở thành KTV MasGo" vào
                đây, nên một dòng hỏi ngược "bạn là khách à?" là mời người ta rời
                đúng màn hình họ vừa được dẫn tới. Khách cần đăng nhập thì vào từ
                `ReviewForm` trên trang hồ sơ, kèm `?next=` quay lại đúng chỗ đó —
                họ không đi qua đây. */}
          </div>
        </div>
      </div>

      {/*
        Cột phải là nội dung thuyết phục, nên ẩn hẳn ở mobile thay vì xếp xuống dưới:
        người đã tới trang đăng nhập là người đang muốn đăng nhập, bắt họ cuộn qua một
        khối bán hàng để tới ô nhập là đặt sai thứ tự ưu tiên.
      */}
      <aside className="hidden items-center justify-center border-l border-ink-200 bg-brand-50 p-12 lg:flex">
        <div className="max-w-[420px]">
          {/* Cửa KTV bán chương trình Beta thay vì bán sàn nói chung: người mở
              `/dang-ky-ktv` gần như luôn tới từ một lời mời tham gia, và thứ họ cần
              biết trước khi gõ số điện thoại là chương trình đang chạy có gì cùng
              lộ trình thu phí về sau. Ba dòng `asideKtv*` cũ mô tả cách sàn vận hành
              — đúng nhưng không trả lời "bây giờ tôi được gì".

              Cửa khách (`/dang-ky`, `/dang-nhap`) giữ nguyên khối cũ: chương trình
              này không liên quan gì tới họ. */}
          {isKtv ? (
            <KtvBetaAside />
          ) : (
            <>
          <div
            aria-hidden
            className="flex h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-ink-200 bg-gradient-to-br from-brand-100 to-brand-200"
          >
            <span className="flex flex-col items-center gap-2 px-6 text-center text-body-s text-brand-600">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-70"
              >
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <circle cx="8.5" cy="9.5" r="1.75" />
                <path d="m3.5 17 4.5-4.5 3.5 3.5 3-3 6 6" />
              </svg>
              {t('login.asideImageAlt')}
            </span>
          </div>

          {/* Chỉ còn nhánh khách, nên không còn ternary theo `isKtv`: giữ lại một
              lựa chọn không bao giờ chạy sẽ đọc như thể cửa KTV vẫn dùng khối này.

              Bốn key `login.asideTitleKtv` / `asideKtv1..3` vẫn nằm trong i18n dù
              không nơi nào đọc — chúng là bản mô tả sàn không phụ thuộc thời gian,
              còn `KtvBetaAside` gắn với một chương trình có hạn. Kết thúc Beta là
              trả khối cũ về đây, và xoá key đi thì phải viết lại từ đầu ở cả hai
              ngôn ngữ. Cùng lý do với `login.crossLink*` đang chờ bản OTP. */}
          <h2 className="mt-6 font-display text-2xl font-bold leading-8 tracking-[-0.02em] text-ink-900">
            {t('login.asideTitleCustomer')}
          </h2>

          <ul className="mt-4 grid gap-3">
            {[
              t('login.asideCustomer1'),
              t('login.asideCustomer2'),
              t('login.asideCustomer3'),
            ].map((line) => (
              <li key={line} className="flex gap-2.5 text-body-l leading-[25px] text-ink-700">
                <CheckIcon size={16} className="mt-1 h-[17px] w-[17px] shrink-0 text-success-fg" />
                {line}
              </li>
            ))}
          </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
