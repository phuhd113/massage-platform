'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon, LogoMark } from '@/components/icons';
import { type Locale, localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { VN_PHONE_PATTERN, normalizePhone } from '@/lib/phone';
import { useFormValidation } from '@/lib/use-form-validation';
import { messagesFor } from '@/lib/validation-messages';
import { SITE_NAME } from '@/lib/site';

type Step = 'phone' | 'code';

const CODE_LENGTH = 6;

/**
 * Vai trò xin cấp cho **tài khoản mới**. Số đã có tài khoản thì backend giữ nguyên
 * vai trò cũ, nên đây không phải đường đổi vai trò — chỉ là câu trả lời cho "người
 * lần đầu vào bằng cửa này là ai".
 */
export type LoginRole = 'CUSTOMER' | 'KTV';

export function LoginForm({
  role = 'CUSTOMER',
  redirectTo,
  locale,
}: {
  role?: LoginRole;
  locale: Locale;
  /**
   * Nơi đưa khách về sau khi đăng nhập. Bỏ trống thì quay lại trang trước đó —
   * khách bấm đăng nhập từ một hồ sơ KTV để viết đánh giá cần quay đúng về hồ sơ
   * đó, chứ không phải về trang chủ rồi tự tìm lại.
   *
   * KTV luôn về `/dashboard` bất kể tham số này, xem `finish()`.
   */
  redirectTo?: string;
}) {
  const router = useRouter();
  const t = createTranslator(getDictionary(locale), locale);
  const formRef = useFormValidation(messagesFor(locale));
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isKtv = role === 'KTV';

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      });
      const data = (await res.json()) as {
        message?: string;
        debugCode?: string;
        expiresAt?: string;
      };

      if (!res.ok) {
        // Map theo HTTP status, không hiện message của backend: message ấy chỉ có
        // tiếng Việt và ở nhánh 503 còn nêu tên khoá cấu hình.
        //
        // 503 = nhà cung cấp (ZNS) đang hỏng, người dùng không làm gì sai và thử lại
        // là hợp lý — khác hẳn 400 (số không hợp lệ) và 429 (xin mã quá dày). Gộp cả
        // ba thành một câu "không gửi được mã" là bắt người ta đoán nên làm gì tiếp.
        setError(
          res.status === 503
            ? t('login.errorProviderDown')
            : res.status === 429
              ? t('login.errorTooManyRequests')
              : data.message ?? t('login.errorSendFailed'),
        );
        return;
      }

      setDebugCode(data.debugCode ?? null);
      setExpiresAt(data.expiresAt ?? null);
      setCode('');
      setStep('code');
    } catch {
      setError(t('login.errorNetwork'));
    } finally {
      setPending(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone), code, role }),
      });
      const data = (await res.json()) as { message?: string; role?: string };

      if (!res.ok) {
        setError(data.message ?? t('login.errorBadCode'));
        // Xoá mã sai để khách gõ lại từ đầu thay vì phải tự xoá 6 ô — và để lần
        // submit sau không gửi lại đúng cái mã vừa bị từ chối.
        setCode('');
        return;
      }

      // refresh trước push để server component đọc được cookie vừa đặt, nếu không
      // dashboard render bằng phiên cũ và đá ngược về đây.
      router.refresh();

      // Đi theo vai trò **thật** của tài khoản, không phải cửa vừa bước vào: KTV
      // đăng nhập nhầm ở trang khách vẫn phải về dashboard, còn khách thì không —
      // dashboard gọi API ví, và tài khoản khách nhận 403 ở đó rồi bị đá ngược lại
      // đây thành một vòng lặp đăng nhập không lối thoát.
      router.push(data.role === 'KTV' ? '/dashboard' : (redirectTo ?? localePath(locale, '/')));
    } catch {
      setError(t('login.errorNetwork'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <div className="flex items-center justify-center px-5 py-12 sm:px-12">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-[30px] w-[30px] shrink-0" />
            <span className="font-display text-h4 font-bold text-ink-900">{SITE_NAME[locale]}</span>
          </div>

          <h1 className="mt-8 text-h1 text-ink-900 sm:text-[30px] sm:leading-9">
            {isKtv ? t('login.headingKtv') : t('login.headingCustomer')}
          </h1>
          <p className="mt-2.5 text-body-l leading-[25px] text-ink-600">
            {/* Không hỏi "bạn đã có tài khoản chưa": với OTP thì đăng ký và đăng
                nhập là cùng một thao tác, và bắt người dùng tự phân loại mình vào
                một trong hai cửa là tạo ra một quyết định không dẫn tới hành động
                nào khác nhau. */}
            {t('login.intro', { length: CODE_LENGTH })}
          </p>

          {step === 'phone' ? (
            <form ref={formRef} onSubmit={requestOtp} className="mt-7 grid gap-4">
              <label className="block">
                <span className="mb-1.5 block text-body font-semibold text-ink-700">
                  {t('login.phoneLabel')}
                </span>
                {/* Cố ý KHÔNG có tiền tố "+84" — xem chú thích dài ở
                    `PasswordAuthForm`. Nhãn tĩnh không được gửi đi cộng với
                    placeholder thiếu số 0 đầu là một cặp bẫy nhau, và hệ thống lưu
                    số ở dạng 0xxxxxxxxx nên ô nhập hỏi thẳng đúng dạng đó. */}
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  autoFocus
                  pattern={VN_PHONE_PATTERN}
                  title={t('login.errorInvalidPhone')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901 234 567"
                  className="w-full rounded-lg border border-ink-200 bg-white px-4 py-3 font-mono text-h4 tracking-[0.02em] text-ink-900 transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>

              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-brand-500 px-4 py-3.5 text-h4 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {pending ? t('login.sending') : t('login.sendCode')}
              </button>
            </form>
          ) : (
            <form ref={formRef} onSubmit={verify} className="mt-7">
              <div className="text-label uppercase text-ink-500">{t('login.step2')}</div>

              <CodeInput
                labels={{ codeInputLabel: t('login.codeInputLabel', { length: CODE_LENGTH }) }}
                value={code}
                onChange={setCode}
                onComplete={() => void verify()}
                disabled={pending}
              />

              <div className="mt-3 flex flex-wrap items-center gap-4 text-body-l text-ink-600">
                <ResendTimer
                  labels={{ resend: t('login.resend'), resendIn: t('login.resendIn') }}
                  expiresAt={expiresAt}
                  pending={pending}
                  onResend={() => void requestOtp(new Event('submit') as unknown as React.FormEvent)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setCode('');
                    setError(null);
                  }}
                  className="font-semibold text-brand-500 transition hover:text-brand-600"
                >
                  {t('login.changePhone')}
                </button>
              </div>

              {debugCode && (
                <p className="mt-4 rounded-md border border-warning-bd bg-warning-bg px-3.5 py-2.5 text-body text-warning-fg">
                  {t('login.stubNotice', { code: debugCode })}
                </p>
              )}

              <button
                type="submit"
                disabled={pending || code.length < CODE_LENGTH}
                className="mt-5 w-full rounded-lg bg-brand-500 px-4 py-3.5 text-h4 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
              >
                {pending ? t('login.verifying') : t('login.submit')}
              </button>
            </form>
          )}

          {error && (
            <p role="alert" className="mt-4 text-body-l text-danger-fg">
              {error}
            </p>
          )}

          {/* Đường sang cửa còn lại. Chỉ hiện ở bước nhập số: khi đã gửi mã đi rồi
              thì một liên kết rời trang là đường làm mất mã vừa nhận. */}
          {step === 'phone' && (
            <p className="mt-8 border-t border-ink-100 pt-5 text-body text-ink-500">
              {isKtv ? (
                <>
                  {t('login.crossLinkKtvQuestion')}{' '}
                  <Link
                    href={localePath(locale, '/dang-nhap')}
                    className="font-semibold text-brand-500 transition hover:text-brand-600"
                  >
                    {t('login.crossLinkKtvAction')}
                  </Link>
                </>
              ) : (
                <>
                  {t('login.crossLinkCustomerQuestion')}{' '}
                  <Link
                    href={localePath(locale, '/dang-ky-ktv')}
                    className="font-semibold text-brand-500 transition hover:text-brand-600"
                  >
                    {t('login.crossLinkCustomerAction')}
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>

      {/*
        Cột phải là nội dung thuyết phục KTV đăng ký, nên ẩn hẳn ở mobile thay vì
        xếp xuống dưới: người đã tới trang đăng nhập là người đang muốn đăng nhập,
        bắt họ cuộn qua một khối bán hàng để tới ô nhập là đặt sai thứ tự ưu tiên.
      */}
      <aside className="hidden items-center justify-center border-l border-ink-200 bg-brand-50 p-12 lg:flex">
        <div className="max-w-[420px]">
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

          <h2 className="mt-6 font-display text-2xl font-bold leading-8 tracking-[-0.02em] text-ink-900">
            {isKtv ? t('login.asideTitleKtv') : t('login.asideTitleCustomer')}
          </h2>

          <ul className="mt-4 grid gap-3">
            {(isKtv
              ? [t('login.asideKtv1'), t('login.asideKtv2'), t('login.asideKtv3')]
              // Nói đúng thứ tài khoản khách hiện có, không hứa tính năng chưa
              // làm: đánh giá cần đăng nhập, còn tìm và gọi thì không.
              : [t('login.asideCustomer1'), t('login.asideCustomer2'), t('login.asideCustomer3')]
            ).map((t) => (
              <li key={t} className="flex gap-2.5 text-body-l leading-[25px] text-ink-700">
                <CheckIcon size={16} className="mt-1 h-[17px] w-[17px] shrink-0 text-success-fg" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

/**
 * Sáu ô nhập mã OTP.
 *
 * **Một `<input>` thật nằm trong suốt phía trên sáu ô hiển thị**, không phải sáu
 * input riêng. Sáu input riêng thì phải tự viết logic nhảy ô, xoá lùi, và dán mã —
 * và bản dán luôn hỏng ở đâu đó, trong khi dán mã từ SMS là cách phần lớn người
 * dùng nhập OTP. Cách này giữ nguyên hành vi gõ, xoá, dán và autofill của trình
 * duyệt (`autocomplete="one-time-code"` để iOS gợi ý mã ngay trên bàn phím).
 */
function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: () => void;
  disabled: boolean;
  /** Chuỗi đã dịch — hàm con không tự tra dictionary. */
  labels: { codeInputLabel: string };
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Đủ 6 số thì gửi luôn, không bắt bấm nút: mã OTP không có gì để xem lại trước
  // khi xác nhận. Vẫn giữ nút "Đăng nhập" cho trường hợp submit tự động thất bại.
  const submitted = useRef('');
  useEffect(() => {
    if (value.length === CODE_LENGTH && submitted.current !== value) {
      submitted.current = value;
      onComplete();
    }
  }, [value, onComplete]);

  return (
    <div className="relative mt-3">
      <input
        ref={ref}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`[0-9]{${CODE_LENGTH}}`}
        maxLength={CODE_LENGTH}
        required
        autoFocus
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label={labels.codeInputLabel}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />

      <div aria-hidden className="flex gap-2">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          // Ô "đang nhập" là ô kế tiếp, trừ khi đã gõ đủ thì giữ sáng ô cuối.
          const active = focused && (i === value.length || (value.length === CODE_LENGTH && i === CODE_LENGTH - 1));

          return (
            <span
              key={i}
              className={`flex h-14 w-12 items-center justify-center rounded-lg font-mono text-[22px] text-ink-900 transition ${
                active ? 'border-2 border-brand-500 bg-brand-50' : 'border border-ink-200 bg-white'
              }`}
            >
              {value[i] ?? ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Đếm ngược tới lúc gửi lại được mã.
 *
 * Mốc lấy từ `expiresAt` của server chứ không đếm lùi từ một hằng số ở client: mã
 * hết hạn theo giờ server, nên một con số tự đặt sẽ hoặc mời khách gửi lại khi
 * backend vẫn còn giữ mã cũ, hoặc bắt họ chờ thêm sau khi mã đã hết hạn.
 */
function ResendTimer({
  expiresAt,
  pending,
  onResend,
  labels,
}: {
  expiresAt: string | null;
  pending: boolean;
  onResend: () => void;
  labels: { resend: string; resendIn: string };
}) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setLeft(null);
      return;
    }

    const tick = () =>
      setLeft(Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000)));

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  // Không biết hạn (backend không trả về) thì cho gửi lại ngay — thà gửi thừa một
  // lần còn hơn khoá nút vĩnh viễn vì thiếu một trường dữ liệu.
  if (left === null || left <= 0) {
    return (
      <button
        type="button"
        onClick={onResend}
        disabled={pending}
        className="font-semibold text-brand-500 transition hover:text-brand-600 disabled:opacity-60"
      >
        {labels.resend}
      </button>
    );
  }

  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');

  return (
    <span>
      {labels.resendIn} <strong className="tabular font-mono font-medium text-ink-900">{mm}:{ss}</strong>
    </span>
  );
}
