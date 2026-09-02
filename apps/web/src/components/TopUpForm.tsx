'use client';

import { useState } from 'react';
import { formatVnd } from '@/lib/site';

const PRESETS = [200_000, 500_000, 1_000_000, 2_000_000];
const MIN = 10_000;
const MAX = 50_000_000;

export function TopUpForm() {
  const [amount, setAmount] = useState<number>(500_000);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch('/api/proxy/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = (await res.json().catch(() => null)) as
        | { redirectUrl?: string; title?: string }
        | null;

      if (!res.ok || !data?.redirectUrl) {
        setError(data?.title ?? 'Chưa mở được phiên thanh toán. Vui lòng thử lại.');
        return;
      }

      // Rời trang sang cổng thanh toán. Tiền chỉ vào ví khi cổng gọi IPN về
      // server — không phải khi trình duyệt quay lại trang kết quả.
      window.location.href = data.redirectUrl;
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  const valid = amount >= MIN && amount <= MAX && Number.isInteger(amount);

  return (
    <form onSubmit={submit} className="rounded-lg border border-ink-200 bg-white p-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setAmount(preset)}
            className={`rounded-full border px-4 py-1.5 text-sm ${
              amount === preset
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-ink-300 text-ink-700 hover:border-brand-500'
            }`}
          >
            {formatVnd(preset)}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm">
        <span className="text-ink-700">Hoặc nhập số tiền (VND)</span>
        <input
          type="number"
          min={MIN}
          max={MAX}
          step={1000}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="mt-1 w-full max-w-xs rounded-md border border-ink-200 bg-white px-3 py-2 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 tabular-nums"
        />
      </label>

      <p className="mt-2 text-xs text-ink-500">
        Từ {formatVnd(MIN)} đến {formatVnd(MAX)}. Tiền vào ví sau khi cổng thanh toán xác nhận, có
        thể chậm vài giây so với lúc bạn thanh toán xong.
      </p>

      <button
        type="submit"
        disabled={pending || !valid}
        className="mt-4 rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? 'Đang mở cổng thanh toán…' : `Nạp ${formatVnd(amount)}`}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
