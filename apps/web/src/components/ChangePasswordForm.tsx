'use client';

import { useState } from 'react';
import { type ValidationMessages, useFormValidation } from '@/lib/use-form-validation';

const MIN_PASSWORD_LENGTH = 8;

/**
 * Đặt hoặc đổi mật khẩu từ trang tài khoản.
 *
 * `hasPassword=false` là tài khoản tạo bằng OTP — nó chưa có mật khẩu nào để mà xác
 * nhận, nên form bỏ hẳn ô "mật khẩu hiện tại" thay vì hiện một ô không điền được.
 * Đây cũng là đường **duy nhất** để những tài khoản đó có mật khẩu, và — khi chưa
 * làm "quên mật khẩu" — là đường duy nhất đổi mật khẩu.
 *
 * Nhận chuỗi đã dịch qua `labels` theo đúng convention của các client component khác
 * (`CodeInput`, `ResendTimer`, `LogoutButton`): chỉ `PasswordAuthForm` tự tra
 * dictionary, vì nó là cả một trang.
 */
export function ChangePasswordForm({
  hasPassword,
  labels,
  validation,
}: {
  hasPassword: boolean;
  /**
   * Chuỗi validate của trình duyệt, đã dịch. Nhận qua prop như `labels` thay vì tự
   * tra dictionary, để giữ đúng convention của component này — nó không có `locale`.
   */
  validation: ValidationMessages;
  labels: {
    title: string;
    intro: string;
    currentLabel: string;
    newLabel: string;
    confirmLabel: string;
    hint: string;
    submit: string;
    submitting: string;
    success: string;
    errorMismatch: string;
    errorShort: string;
    errorWrongCurrent: string;
    errorGeneric: string;
  };
}) {
  const formRef = useFormValidation(validation);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);

    if (next !== confirm) {
      setError(labels.errorMismatch);
      return;
    }
    if (next.length < MIN_PASSWORD_LENGTH) {
      setError(labels.errorShort);
      return;
    }

    setPending(true);
    try {
      // Qua proxy để token trong cookie httpOnly được gắn vào header Authorization —
      // client component không đọc được cookie đó.
      const res = await fetch('/api/proxy/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: hasPassword ? current : null,
          newPassword: next,
        }),
      });

      if (!res.ok) {
        setError(res.status === 401 ? labels.errorWrongCurrent : labels.errorGeneric);
        return;
      }

      // Xoá sạch ba ô: để lại mật khẩu mới trong DOM sau khi đã đổi xong là bày nó
      // ra cho người tiếp theo ngồi vào máy.
      setCurrent('');
      setNext('');
      setConfirm('');
      setDone(true);
    } catch {
      setError(labels.errorGeneric);
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2.5 text-body text-ink-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  return (
    <form ref={formRef} onSubmit={submit} className="mt-3 rounded-xl border border-ink-200 bg-white p-4 shadow-card">
      <p className="text-body-s text-ink-600">{labels.intro}</p>

      <div className="mt-3 grid gap-3 sm:max-w-[380px]">
        {hasPassword && (
          <label className="block">
            <span className="mb-1 block text-body-s font-semibold text-ink-700">
              {labels.currentLabel}
            </span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-body-s font-semibold text-ink-700">
            {labels.newLabel}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-caption text-ink-500">{labels.hint}</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-body-s font-semibold text-ink-700">
            {labels.confirmLabel}
          </span>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </label>

        <button
          type="submit"
          disabled={pending}
          className="justify-self-start rounded-lg bg-brand-500 px-4 py-2.5 text-body font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? labels.submitting : labels.submit}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-bd bg-danger-bg px-3 py-2 text-body-s text-danger-fg">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="mt-3 rounded-md border border-success-bd bg-success-bg px-3 py-2 text-body-s text-success-fg">
          {labels.success}
        </p>
      )}
    </form>
  );
}
