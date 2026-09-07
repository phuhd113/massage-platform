'use client';

import { useFormValidation } from '@/lib/use-form-validation';
import { viMessages } from '@/lib/validation-messages';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDateTime } from '@/lib/site';

/**
 * Cam kết của kỹ thuật viên.
 *
 * **Nội dung đến từ backend** (`GET /ktv/commitments`), không viết cứng ở đây. Đây là
 * tài liệu pháp lý: khi có tranh chấp, thứ cần chứng minh là "người này đã đồng ý với
 * đúng những dòng này". Nếu danh sách nằm trong JSX thì bản đã ký không tái dựng được,
 * vì code frontend đã đổi nhiều lần kể từ đó và không có gì gắn phiên bản với nội dung.
 *
 * **Phải tick từng dòng, không phải một ô "tôi đồng ý tất cả".** Bảy dòng này là bảy
 * nghĩa vụ khác nhau, trong đó có dòng về mại dâm — thứ quyết định cả việc tên miền có
 * bị Google phân loại nhầm hay không. Một ô gộp biến việc đọc thành một cú bấm.
 */
export function CommitmentsSection({
  items,
  version,
  accepted,
  committedAt,
}: {
  items: string[];
  version: number;
  /** Đã chấp nhận **đúng bản đang có hiệu lực** hay chưa (server tự so, xem `commitmentsUpToDate`). */
  accepted: boolean;
  committedAt: string | null;
}) {
  const router = useRouter();
  // Thông báo validate tiếng Việt — dashboard/admin cố ý chỉ có một ngôn ngữ.
  const formRef = useFormValidation(viMessages());
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checked.length > 0 && checked.every(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!allChecked) return;

    setPending(true);
    setError(null);

    try {
      // Gửi **số phiên bản vừa đọc**, không gửi một cờ "đã đồng ý": nếu nội dung được
      // cập nhật trong lúc tab này đang mở, backend từ chối thay vì ghi nhận người dùng
      // đồng ý với một bản họ chưa nhìn thấy.
      const res = await fetch('/api/proxy/ktv/profile/commitments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      const data = (await res.json().catch(() => null)) as
        | { title?: string; message?: string }
        | null;

      if (!res.ok) {
        setError(data?.title || data?.message || 'Không ghi nhận được cam kết.');
        return;
      }

      router.refresh();
    } catch {
      setError('Không kết nối được máy chủ.');
    } finally {
      setPending(false);
    }
  }

  if (accepted) {
    return (
      <div className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Đã chấp nhận bản cam kết</div>
            {committedAt && (
              <div className="text-sm text-ink-500">Lúc {formatDateTime(committedAt, 'vi')}</div>
            )}
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            Đã cam kết
          </span>
        </div>

        {/* Vẫn hiện lại nội dung: người đã ký phải đọc lại được thứ mình đã ký, không
            phải nhớ. Bỏ ô tick vì không còn gì để quyết định. */}
        <ul className="mt-4 space-y-2">
          {items.map((t) => (
            <li key={t} className="flex gap-2.5 text-sm text-ink-700">
              <span aria-hidden className="mt-0.5 shrink-0 text-brand-600">
                ✓
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="rounded-lg border border-ink-200 bg-white p-5 shadow-card">
      <p className="text-sm text-ink-600">
        Đọc và tick từng dòng. Hồ sơ <strong>chưa được duyệt</strong> cho tới khi bạn xác nhận đủ.
      </p>

      <ul className="mt-4 space-y-3">
        {items.map((t, i) => (
          <li key={t}>
            <label className="flex cursor-pointer gap-3 text-sm text-ink-800">
              <input
                type="checkbox"
                checked={checked[i] ?? false}
                onChange={(e) =>
                  setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                }
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-ink-300 text-brand-500 focus:ring-2 focus:ring-brand-500/30"
              />
              <span>{t}</span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="submit"
        disabled={pending || !allChecked}
        className="mt-5 rounded-md bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {pending ? 'Đang ghi nhận…' : 'Tôi cam kết'}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger-fg">
          {error}
        </p>
      )}
    </form>
  );
}
