'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Duyệt hoặc từ chối một ảnh hồ sơ.
 *
 * Cùng hình dạng hai bước với <c>VerifyProfileForm</c>, và cùng lý do: lý do từ chối
 * là thứ **duy nhất** KTV nhìn thấy để biết phải sửa gì. Từ chối không kèm lý do thì
 * họ tải lên đúng tấm ảnh đó lần nữa.
 */
export function VerifyPhotoForm({ photoId }: { photoId: string }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'VERIFIED' | 'REJECTED') {
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/proxy/admin/photos/${photoId}/verify`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reason: decision === 'REJECTED' ? reason.trim() : null,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { title?: string; errors?: Record<string, string[]> }
        | null;

      if (!res.ok) {
        const fieldErrors = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
        setError(fieldErrors || data?.title || 'Không lưu được quyết định.');
        return;
      }

      setRejecting(false);
      setReason('');
      // Ảnh vừa xử lý phải rời khỏi tab đang mở. Layout admin khai `force-dynamic`
      // nên `refresh()` là đủ — không có cache fetch nào giữ lại danh sách cũ.
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  if (rejecting) {
    return (
      <div className="mt-2 space-y-2">
        <label className="block">
          <span className="text-caption text-ink-600">Lý do từ chối</span>
          <textarea
            autoFocus
            rows={2}
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: ảnh không liên quan tới dịch vụ trị liệu"
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-body transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        {error && <p className="text-caption text-danger-fg">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending || reason.trim().length < 5}
            onClick={() => decide('REJECTED')}
            className="rounded-full bg-danger-fg px-3.5 py-1.5 text-body-s font-semibold text-white transition disabled:opacity-50"
          >
            {pending ? 'Đang lưu…' : 'Xác nhận từ chối'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting(false)}
            className="rounded-full px-3.5 py-1.5 text-body-s font-semibold text-ink-600 transition hover:text-ink-900 disabled:opacity-50"
          >
            Huỷ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      {error && <p className="mb-2 text-caption text-danger-fg">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('VERIFIED')}
          className="rounded-full bg-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-white shadow-button transition hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? 'Đang lưu…' : 'Duyệt'}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setRejecting(true)}
          className="rounded-full border border-ink-300 px-3.5 py-1.5 text-body-s font-semibold text-ink-700 transition hover:border-ink-400 hover:bg-ink-50 disabled:opacity-50"
        >
          Từ chối
        </button>
      </div>
    </div>
  );
}
