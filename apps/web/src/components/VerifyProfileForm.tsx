'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Duyệt hoặc từ chối một hồ sơ KTV.
 *
 * Duyệt là một bước, từ chối là hai: từ chối mở ô nhập lý do trước. `rejectionReason`
 * là thứ **duy nhất** KTV nhìn thấy để biết phải sửa gì — từ chối không kèm lý do thì
 * hồ sơ quay lại y nguyên ở lần nộp sau, và cả hai bên cùng làm lại từ đầu.
 */
export function VerifyProfileForm({
  ktvId,
  ktvSlug,
  currentStatus,
}: {
  ktvId: string;
  /** Chỉ dùng để xoá cache trang công khai của hồ sơ này. */
  ktvSlug: string;
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
      // `/api/admin-verify` chứ không phải `/api/proxy`: duyệt hồ sơ là lần đầu trang
      // công khai của KTV này tồn tại, và gỡ xuống thì nó phải biến mất. Trang là ISR
      // 600 giây nên qua proxy sẽ có một khoảng mười phút mà trạng thái hồ sơ và trang
      // công khai nói hai điều khác nhau — kể cả với hồ sơ vừa bị gỡ vì nghi vấn.
      const params = new URLSearchParams({
        target: 'profile',
        id: ktvId,
        ktvId,
        ktvSlug,
      });

      const res = await fetch(`/api/admin-verify?${params}`, {
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
      // Hồ sơ vừa xử lý phải rời khỏi tab đang mở. Layout khai `force-dynamic` nên
      // `refresh()` là đủ — không có cache fetch nào giữ lại danh sách cũ.
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  if (rejecting) {
    return (
      <div className="w-full max-w-[300px] shrink-0">
        <label
          htmlFor={`reason-${ktvId}`}
          className="block text-body-s font-semibold text-ink-700"
        >
          Lý do từ chối
        </label>
        <textarea
          id={`reason-${ktvId}`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Ví dụ: ảnh chứng chỉ mờ, không đọc được tên người được cấp."
          className="mt-1 w-full rounded-md border border-ink-300 px-3 py-2 text-body text-ink-900 outline-none focus:border-brand-500"
        />

        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => decide('REJECTED')}
            // Không cho gửi lý do rỗng: backend chấp nhận null, nhưng một hồ sơ bị
            // từ chối mà không nói vì sao là chỗ KTV không có cách nào sửa được.
            disabled={pending || reason.trim().length === 0}
            className="rounded-md bg-danger-fg px-3.5 py-2 text-body-s font-semibold text-white transition disabled:opacity-60"
          >
            {pending ? 'Đang lưu…' : 'Xác nhận từ chối'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRejecting(false);
              setError(null);
            }}
            className="rounded-md border border-ink-300 px-3.5 py-2 text-body-s text-ink-700 transition hover:border-ink-400"
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
    <div className="shrink-0 text-right">
      <div className="flex flex-wrap justify-end gap-2">
        {currentStatus !== 'VERIFIED' && (
          <button
            type="button"
            onClick={() => decide('VERIFIED')}
            disabled={pending}
            className="rounded-md bg-brand-500 px-3.5 py-2.5 text-body-s font-semibold text-white shadow-button transition hover:bg-brand-600 disabled:opacity-60"
          >
            {pending ? 'Đang lưu…' : 'Duyệt'}
          </button>
        )}

        {currentStatus !== 'REJECTED' && (
          <button
            type="button"
            onClick={() => setRejecting(true)}
            disabled={pending}
            className="rounded-md border border-danger-bd bg-white px-3.5 py-2.5 text-body-s font-semibold text-danger-fg transition hover:bg-danger-bg disabled:opacity-60"
          >
            Từ chối
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-body-s text-danger-fg">
          {error}
        </p>
      )}
    </div>
  );
}
