'use client';

import { useState } from 'react';
import { useFormValidation } from '@/lib/use-form-validation';
import { viMessages } from '@/lib/validation-messages';
import { formatVnd } from '@/lib/site';

const PRESETS = [200_000, 500_000, 1_000_000, 2_000_000];
const MIN = 10_000;
const MAX = 50_000_000;

export function TopUpForm() {
  const formRef = useFormValidation(viMessages());
  const [amount, setAmount] = useState<number>(500_000);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ô nhập tay chỉ hiện khi khách chọn "Số khác". Bốn mức có sẵn phủ gần hết nhu
  // cầu thật, nên bày sẵn một ô số trống bên cạnh chúng chỉ làm khối này rối hơn.
  const [custom, setCustom] = useState(false);

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
    <form ref={formRef} onSubmit={submit} className="rounded-xl border border-ink-200 bg-white p-5">
      <h2 className="font-display text-h3 text-ink-900">Nạp tiền</h2>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const selected = !custom && amount === preset;
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setCustom(false);
                setAmount(preset);
              }}
              className={`tabular rounded-md font-mono text-body transition ${
                selected
                  ? // Viền 2px khi chọn, bù lại bằng padding nhỏ hơn 1px để chip
                    // không nhảy kích thước giữa hai trạng thái.
                    'border-2 border-brand-500 bg-brand-100 px-[15px] py-2 font-medium text-brand-600'
                  : 'border border-ink-200 bg-white px-4 py-[9px] text-ink-700 hover:border-brand-500'
              }`}
            >
              {formatVnd(preset, 'vi')}
            </button>
          );
        })}

        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustom(true)}
          className={`rounded-md border border-dashed px-4 py-[9px] text-body transition ${
            custom
              ? 'border-brand-500 bg-brand-50 text-brand-600'
              : 'border-ink-200 bg-white text-ink-600 hover:border-brand-500'
          }`}
        >
          Số khác
        </button>
      </div>

      {custom && (
        <label className="mt-3.5 block">
          <span className="text-body text-ink-700">Số tiền muốn nạp (VND)</span>
          <input
            type="number"
            min={MIN}
            max={MAX}
            step={1000}
            autoFocus
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="tabular mt-1 w-full max-w-xs rounded-md border border-ink-200 bg-white px-3 py-2 font-mono transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <span className="mt-1.5 block text-caption text-ink-500">
            Từ {formatVnd(MIN, 'vi')} đến {formatVnd(MAX, 'vi')}.
          </span>
        </label>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3.5 border-t border-ink-100 pt-4">
        <button
          type="submit"
          disabled={pending || !valid}
          className="shrink-0 rounded-md bg-brand-500 px-6 py-3 text-body-l font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Đang mở cổng thanh toán…' : `Nạp ${formatVnd(amount, 'vi')}`}
        </button>

        {/*
          Nói rõ tiền vào ví theo IPN chứ không theo lúc trình duyệt quay lại: KTV
          nạp xong thấy số dư chưa đổi sẽ nạp lại lần nữa nếu không được báo trước.
        */}
        <span className="text-body text-ink-600">
          Tiền vào ví sau khi cổng thanh toán xác nhận — thường trong vài giây.
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-body text-danger-fg">
          {error}
        </p>
      )}
    </form>
  );
}
