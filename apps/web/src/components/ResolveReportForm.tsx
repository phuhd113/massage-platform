'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Decision = 'ACTION_TAKEN' | 'DISMISSED';

/**
 * Chốt một báo cáo vi phạm: đã xử lý hoặc bỏ qua.
 *
 * **Không** gỡ hồ sơ — chỉ đóng dòng trong hàng đợi. Việc gỡ đi qua đúng đường duyệt
 * hồ sơ đã có (`/admin/duyet-ktv`), nơi đã ghi sẵn ai quyết định và vì sao; nhân bản
 * logic đổi trạng thái hồ sơ vào đây sẽ tạo ra hai đường phải giữ cho khớp nhau mãi
 * mãi. Vì vậy thẻ báo cáo có link riêng dẫn sang trang duyệt hồ sơ, và admin đi qua
 * đó trước khi quay lại chốt dòng này.
 *
 * Đi qua `/api/proxy` chứ không phải `/api/admin-verify`: thao tác này không đổi bất
 * cứ thứ gì trên trang hồ sơ công khai, nên xoá cache ISR ở đây là trả giá một bản
 * dựng sẵn của trang SEO mà không đổi lại được gì. Cùng lý do CCCD cố ý không đi qua
 * đường đó.
 */
export function ResolveReportForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(chosen: Decision) {
    setPending(true);
    setError(null);

    try {
      const res = await fetch(`/api/proxy/admin/reports/${reportId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: chosen, note: note.trim() || null }),
      });

      const data = (await res.json().catch(() => null)) as
        | { title?: string; message?: string; errors?: Record<string, string[]> }
        | null;

      if (!res.ok) {
        const fieldErrors = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
        // 409 có nghĩa rất cụ thể ở đây: một admin khác vừa chốt dòng này. Nói đúng
        // như vậy thay vì một câu lỗi chung, vì cách xử lý là tải lại trang chứ
        // không phải thử lại.
        setError(
          res.status === 409
            ? 'Báo cáo này vừa được người khác xử lý. Tải lại trang để xem trạng thái mới.'
            : fieldErrors || data?.message || data?.title || 'Không lưu được quyết định.',
        );
        return;
      }

      setDecision(null);
      setNote('');
      // Layout admin khai `force-dynamic` nên `refresh()` là đủ — không có cache
      // fetch nào giữ danh sách cũ lại.
      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  if (decision) {
    const takingAction = decision === 'ACTION_TAKEN';

    return (
      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-caption text-ink-600">
            Ghi chú {takingAction ? '(đã xử lý thế nào)' : '(vì sao bỏ qua)'}
          </span>
          <textarea
            autoFocus
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              takingAction
                ? 'Ví dụ: đã gỡ hồ sơ về PENDING và yêu cầu gửi lại ảnh.'
                : 'Ví dụ: đã xem ảnh và mô tả, không thấy dấu hiệu vi phạm.'
            }
            className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-body transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </label>

        {error && <p className="text-caption text-danger-fg">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(decision)}
            className={`rounded-full px-3.5 py-1.5 text-body-s font-semibold text-white transition disabled:opacity-50 ${
              takingAction ? 'bg-danger-fg' : 'bg-brand-500 shadow-button hover:bg-brand-600'
            }`}
          >
            {pending ? 'Đang lưu…' : takingAction ? 'Xác nhận đã xử lý' : 'Xác nhận bỏ qua'}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setDecision(null)}
            className="rounded-full px-3.5 py-1.5 text-body-s font-semibold text-ink-600 transition hover:text-ink-900 disabled:opacity-50"
          >
            Huỷ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {error && <p className="mb-2 text-caption text-danger-fg">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => setDecision('ACTION_TAKEN')}
          className="rounded-full bg-brand-500 px-3.5 py-1.5 text-body-s font-semibold text-white shadow-button transition hover:bg-brand-600 disabled:opacity-50"
        >
          Đã xử lý
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setDecision('DISMISSED')}
          className="rounded-full border border-ink-300 px-3.5 py-1.5 text-body-s font-semibold text-ink-700 transition hover:border-ink-400 hover:bg-ink-50 disabled:opacity-50"
        >
          Bỏ qua
        </button>
      </div>
    </div>
  );
}
