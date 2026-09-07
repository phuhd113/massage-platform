'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Duyệt hoặc từ chối ảnh CCCD của một hồ sơ.
 *
 * Tách khỏi `VerifyProfileForm` vì đây là **quyết định khác**: duyệt CCCD là xác nhận
 * "người này đúng là người trong giấy tờ", còn duyệt hồ sơ là "hồ sơ này được lên
 * sóng". Gộp thành một nút sẽ khiến admin duyệt cả hai bằng một cú bấm, tức là bỏ
 * chính bước đối chiếu mà việc bắt buộc CCCD sinh ra để có.
 *
 * Duyệt cho **cả hai mặt cùng lúc** — backend lưu chúng chung một hàng, vì duyệt riêng
 * từng mặt là để lọt trường hợp ghép hai nửa của hai thẻ khác nhau.
 */
export function VerifyIdentityForm({
  ktvId,
  currentStatus,
}: {
  ktvId: string;
  currentStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'VERIFIED' | 'REJECTED') {
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/proxy/admin/ktv/${ktvId}/identity/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'REJECTED' ? reason.trim() : null,
        }),
      });

      const data = (await res.json().catch(() => null)) as { title?: string } | null;

      if (!res.ok) {
        setError(data?.title ?? 'Không lưu được quyết định.');
        return;
      }

      setRejecting(false);
      setReason('');
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  if (rejecting) {
    return (
      <div className="mt-2 max-w-[320px]">
        <label
          htmlFor={`id-reason-${ktvId}`}
          className="block text-body-s font-semibold text-ink-700"
        >
          Lý do từ chối CCCD
        </label>
        <textarea
          id={`id-reason-${ktvId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Ví dụ: ảnh mờ, không đọc được số; hoặc thiếu góc thẻ."
          className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-body text-ink-900 outline-none focus:border-brand-500"
        />

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => decide('REJECTED')}
            // Lý do là thứ duy nhất KTV thấy để biết phải chụp lại thế nào; thiếu nó
            // thì họ gửi lại đúng tấm ảnh cũ.
            disabled={pending || reason.trim().length === 0}
            className="rounded-md bg-danger-fg px-3 py-1.5 text-body-s font-semibold text-white transition disabled:opacity-60"
          >
            {pending ? 'Đang lưu…' : 'Xác nhận từ chối'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRejecting(false);
              setError(null);
            }}
            className="rounded-md border border-ink-300 px-3 py-1.5 text-body-s text-ink-700 transition hover:border-ink-400"
          >
            Quay lại
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-body-s text-danger-fg">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {currentStatus !== 'VERIFIED' && (
        <button
          type="button"
          onClick={() => decide('VERIFIED')}
          disabled={pending}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-body-s font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {pending ? 'Đang lưu…' : 'Xác minh CCCD'}
        </button>
      )}

      {currentStatus !== 'REJECTED' && (
        <button
          type="button"
          onClick={() => setRejecting(true)}
          disabled={pending}
          className="rounded-md border border-ink-300 px-3 py-1.5 text-body-s text-ink-700 transition hover:border-ink-400 disabled:opacity-60"
        >
          Từ chối CCCD
        </button>
      )}

      {error && (
        <p role="alert" className="w-full text-body-s text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
