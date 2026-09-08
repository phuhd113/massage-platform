'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Gỡ hoặc khôi phục một đánh giá.
 *
 * Đi qua `/api/admin-verify` chứ không phải `/api/proxy` — cùng cái bẫy `revalidatePath`
 * mà `/api/reviews`, `/api/ktv-media` và đường duyệt hồ sơ đã ghi lại. Trang hồ sơ là
 * ISR 600 giây và **rating của KTV được tính lại** khi đánh giá đổi trạng thái, nên gỡ
 * một đánh giá 1 sao mà không xoá cache thì trang công khai giữ nguyên cả nội dung lẫn
 * điểm trung bình cũ thêm mười phút. Ở đây cũng đúng hình dạng nguy hiểm nhất: admin
 * bấm và KTV là người xem kết quả, nên không ai ở vị trí nhìn thấy mâu thuẫn.
 */
export function ModerateReviewForm({
  reviewId,
  ktvId,
  ktvSlug,
  status,
}: {
  reviewId: string;
  /** Hồ sơ chứa đánh giá này — dùng để xoá cache trang công khai của nó. */
  ktvId: string;
  ktvSlug: string;
  status: 'PENDING' | 'PUBLISHED' | 'REJECTED';
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(next: 'PUBLISHED' | 'REJECTED') {
    setPending(true);
    setError(null);

    try {
      const params = new URLSearchParams({ target: 'review', id: reviewId, ktvId, ktvSlug });

      const res = await fetch(`/api/admin-verify?${params}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: next,
          rejectionReason: next === 'REJECTED' ? reason.trim() : null,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { title?: string; message?: string; errors?: Record<string, string[]> }
        | null;

      if (!res.ok) {
        const fieldErrors = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
        setError(fieldErrors || data?.message || data?.title || 'Không lưu được quyết định.');
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
      <div className="mt-2 space-y-2">
        <label className="block">
          <span className="text-caption text-ink-600">Lý do gỡ</span>
          <textarea
            autoFocus
            rows={2}
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ví dụ: nội dung không nói về dịch vụ; hoặc dấu hiệu đánh giá thuê."
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-body transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        {error && <p className="text-caption text-danger-fg">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            // Người viết thấy được lý do này ở `/tai-khoan` — đó là lý do nó bắt buộc.
            // Đánh giá biến mất không lời giải thích thì họ viết lại, rồi nhận 409 vì
            // ràng buộc một-tài-khoản-một-KTV, và đọc như hệ thống tự mâu thuẫn.
            disabled={pending || reason.trim().length < 5}
            onClick={() => decide('REJECTED')}
            className="rounded-full bg-danger-fg px-3.5 py-1.5 text-body-s font-semibold text-white transition disabled:opacity-50"
          >
            {pending ? 'Đang lưu…' : 'Xác nhận gỡ'}
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
        {/* Đánh giá đã gỡ vẫn khôi phục được: gỡ nhầm mà không có đường lùi thì người
            viết mất luôn đánh giá thật của mình, và họ không có cách nào viết lại. */}
        {status !== 'PUBLISHED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => decide('PUBLISHED')}
            className="rounded-full bg-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-white shadow-button transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? 'Đang lưu…' : 'Khôi phục'}
          </button>
        )}

        {status !== 'REJECTED' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setRejecting(true)}
            className="rounded-full border border-ink-300 px-3.5 py-1.5 text-body-s font-semibold text-ink-700 transition hover:border-ink-400 hover:bg-ink-50 disabled:opacity-50"
          >
            Gỡ đánh giá
          </button>
        )}
      </div>
    </div>
  );
}
