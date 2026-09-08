'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const STATUSES = [
  { value: '', label: 'Mọi trạng thái' },
  { value: 'PENDING', label: 'Chờ duyệt' },
  { value: 'VERIFIED', label: 'Đã duyệt' },
  { value: 'REJECTED', label: 'Đã từ chối' },
] as const;

const GENDERS = [
  { value: '', label: 'Mọi giới tính' },
  { value: 'FEMALE', label: 'Nữ' },
  { value: 'MALE', label: 'Nam' },
] as const;

/**
 * Ô tìm và bộ lọc của trang tra cứu KTV.
 *
 * **Trạng thái nằm ở URL, không ở state của component.** Cùng lý do với
 * `SearchFilterDialog` ở `/tim-kiem`: giữ một bản sao trong state thì bấm Back sẽ làm
 * bản sao đó lệch khỏi danh sách bên dưới — hai thứ trên cùng màn hình nói hai điều
 * khác nhau, và không có gì báo lỗi. URL cũng là thứ admin gửi cho nhau được ("xem hộ
 * cái này").
 *
 * Ngoại lệ có chủ ý là **ô nhập**: nó giữ bản nháp cục bộ để gõ không bị giật, rồi mới
 * đẩy vào URL lúc submit. Đẩy mỗi phím gõ vào URL nghĩa là mỗi ký tự một lượt gọi
 * server và một mục trong lịch sử trình duyệt.
 */
export function KtvSearchFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const urlQuery = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const gender = params.get('gender') ?? '';

  const [draft, setDraft] = useState(urlQuery);

  // Đồng bộ lại khi URL đổi từ bên ngoài (bấm Back, hoặc xoá bộ lọc). Thiếu cái này
  // thì ô nhập giữ nguyên chữ cũ trong khi danh sách đã là kết quả khác.
  useEffect(() => setDraft(urlQuery), [urlQuery]);

  function apply(next: Partial<{ q: string; status: string; gender: string }>) {
    const merged = { q: urlQuery, status, gender, ...next };
    const sp = new URLSearchParams();

    // Chỉ ghi tham số có giá trị: `?status=` rỗng vẫn là một tham số, và nó làm URL
    // chia sẻ trông như đang lọc trong khi không lọc gì.
    for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);

    const qs = sp.toString();
    router.push(qs ? `/admin/ktv?${qs}` : '/admin/ktv');
  }

  const dangLọc = Boolean(urlQuery || status || gender);

  return (
    <div className="mt-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply({ q: draft.trim() });
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Tìm theo tên hoặc số điện thoại…"
          aria-label="Tìm KTV theo tên hoặc số điện thoại"
          className="min-w-0 flex-1 rounded-full border border-ink-200 bg-white px-4 py-2 text-body transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
        <button
          type="submit"
          className="rounded-full bg-brand-500 px-5 py-2 text-body font-semibold text-white shadow-button transition hover:bg-brand-600"
        >
          Tìm
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          label="Trạng thái"
          value={status}
          options={STATUSES}
          onChange={(v) => apply({ status: v })}
        />
        <Select
          label="Giới tính"
          value={gender}
          options={GENDERS}
          onChange={(v) => apply({ gender: v })}
        />

        {dangLọc && (
          <button
            type="button"
            onClick={() => router.push('/admin/ktv')}
            className="text-body font-semibold text-ink-600 underline underline-offset-2 transition hover:text-ink-900"
          >
            Xoá bộ lọc
          </button>
        )}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-ink-200 bg-white px-3.5 py-2 text-body text-ink-700 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
