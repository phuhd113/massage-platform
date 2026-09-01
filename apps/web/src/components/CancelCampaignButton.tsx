'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CancelCampaignButton({
  campaignId,
  endAt,
}: {
  campaignId: string;
  endAt: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ước lượng hiển thị cho người dùng; số hoàn thật do backend tính, vì đó là con
  // số đi vào sổ cái.
  const remainingDays = Math.max(
    0,
    Math.floor((new Date(endAt).getTime() - Date.now()) / 86_400_000),
  );

  async function cancel() {
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/proxy/campaigns/${campaignId}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => null)) as
        | { refundedAmount?: number; title?: string }
        | null;

      if (!res.ok) {
        setError(data?.title ?? 'Không huỷ được chiến dịch.');
        return;
      }

      setConfirming(false);
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-stone-600 hover:text-red-700"
      >
        Huỷ
      </button>
    );
  }

  return (
    <div className="text-right">
      <p className="text-xs text-stone-600">
        Huỷ và hoàn {remainingDays} ngày còn lại?
        {remainingDays === 0 && ' Không còn ngày trọn vẹn nào nên sẽ không hoàn tiền.'}
      </p>
      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          disabled={pending}
          className="rounded-md bg-red-700 px-3 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-60"
        >
          {pending ? 'Đang huỷ…' : 'Xác nhận huỷ'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-md border border-stone-300 px-3 py-1 text-xs text-stone-700"
        >
          Không
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
