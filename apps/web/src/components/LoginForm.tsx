'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Step = 'phone' | 'code';

export function LoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json()) as { message?: string; debugCode?: string };

      if (!res.ok) {
        setError(data.message ?? 'Không gửi được mã. Kiểm tra lại số điện thoại.');
        return;
      }

      setDebugCode(data.debugCode ?? null);
      setStep('code');
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        setError(data.message ?? 'Mã OTP không đúng hoặc đã hết hạn.');
        return;
      }

      // refresh trước push để server component đọc được cookie vừa đặt, nếu không
      // dashboard render bằng phiên cũ và đá ngược về đây.
      router.refresh();
      router.push('/dashboard');
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm rounded-lg border border-ink-200 bg-white p-6 shadow-card">
      <h1 className="text-h2 text-ink-900">Đăng nhập cho kỹ thuật viên</h1>
      <p className="mt-2 text-sm text-ink-600">
        Nhập số điện thoại, chúng tôi gửi mã xác thực gồm 6 chữ số.
      </p>

      {step === 'phone' ? (
        <form onSubmit={requestOtp} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="text-ink-700">Số điện thoại</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0901234567"
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {pending ? 'Đang gửi…' : 'Gửi mã xác thực'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="text-ink-700">Mã xác thực gửi tới {phone}</span>
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 tracking-[0.4em]"
            />
          </label>

          {debugCode && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-warning-fg">
              Chế độ thử nghiệm: mã là <strong>{debugCode}</strong>. Ở production, mã chỉ gửi qua SMS.
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {pending ? 'Đang kiểm tra…' : 'Đăng nhập'}
          </button>

          <button
            type="button"
            onClick={() => { setStep('phone'); setCode(''); setError(null); }}
            className="w-full text-sm text-ink-600 hover:text-brand-600"
          >
            Đổi số điện thoại
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
