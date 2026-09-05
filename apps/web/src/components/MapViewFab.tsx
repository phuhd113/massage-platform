'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { useTransition } from 'react';

/**
 * Nút nổi chuyển danh sách ⇄ bản đồ, **chỉ hiện ở mobile**.
 *
 * Trên desktop đã có cặp nút "Danh sách / Bản đồ" trong khối bộ lọc và nó luôn nằm
 * trong tầm mắt. Ở 390px thì khối đó cuộn mất từ lâu khi khách đọc tới hồ sơ thứ ba
 * — đúng lúc họ nghĩ tới việc xem vị trí trên bản đồ. Nút nổi giữ hành động đó luôn
 * ở trong tầm ngón cái mà không chiếm thêm chiều cao của trang.
 *
 * Đây là nút thứ hai điều khiển cùng một tham số `view`; cả hai đọc và ghi thẳng vào
 * URL nên không có state nào phải giữ cho khớp giữa chúng.
 */
export function MapViewFab({ locale }: { locale: Locale }) {
  const t = createTranslator(getDictionary(locale), locale);
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const isMap = params.get('view') === 'map';

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (isMap) next.delete('view');
    else next.set('view', 'map');

    // Đổi cách xem không phải một trang mới trong lịch sử duyệt web: bấm Back sau
    // khi xem bản đồ phải quay về trang trước đó, không phải quay về danh sách.
    startTransition(() => router.replace(`/tim-kiem?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-white via-white/90 to-transparent px-4 pb-5 pt-6 sm:hidden">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="pointer-events-auto inline-flex items-center gap-2.5 rounded-full bg-ink-900 px-5 py-3 text-body-l font-semibold text-white shadow-[0_10px_26px_-10px_rgba(13,27,42,.5)] transition disabled:opacity-60"
      >
        {isMap ? (
          <svg
            aria-hidden
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        ) : (
          <svg
            aria-hidden
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" />
            <path d="M9 3v15M15 6v15" />
          </svg>
        )}
        {isMap ? t('map.viewList') : t('map.viewMap')}
      </button>
    </div>
  );
}
