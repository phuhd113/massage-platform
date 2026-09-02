'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AreaNode, ServiceItem } from '@/lib/types';

/**
 * Ô tìm kiếm trên trang chủ.
 *
 * Client component nhưng cố ý rất nhỏ: chỉ hai select và một nút. Toàn bộ nội
 * dung Google cần (H1, mô tả, danh sách khu vực, danh sách dịch vụ) vẫn nằm ở
 * server component bọc ngoài, nên vẫn có mặt trong HTML đầu tiên.
 *
 * Không tự động định vị khi tải trang: xin quyền GPS ngay khi khách vừa vào là
 * cách nhanh nhất để bị từ chối vĩnh viễn ở cấp trình duyệt. Khách bấm thì mới
 * hỏi, lúc đó họ đã hiểu vì sao cần.
 */
export function HeroSearch({
  areas,
  services,
}: {
  areas: AreaNode[];
  services: ServiceItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [areaSlug, setAreaSlug] = useState('');
  const [service, setService] = useState('');
  const [geoError, setGeoError] = useState<string | null>(null);

  const districts = areas.flatMap((p) =>
    p.children.map((d) => ({ ...d, provinceName: p.name })),
  );

  function submit() {
    const q = new URLSearchParams();
    if (areaSlug) q.set('areaSlug', areaSlug);
    if (service) q.set('service', service);
    startTransition(() => router.push(`/tim-kiem?${q.toString()}`));
  }

  function nearMe() {
    if (!navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ định vị. Bạn có thể chọn quận/huyện.');
      return;
    }

    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const q = new URLSearchParams();
        q.set('lat', pos.coords.latitude.toFixed(6));
        q.set('lon', pos.coords.longitude.toFixed(6));
        if (service) q.set('service', service);
        setLocating(false);
        startTransition(() => router.push(`/tim-kiem?${q.toString()}`));
      },
      () => {
        setLocating(false);
        setGeoError('Chưa lấy được vị trí. Bạn có thể chọn quận/huyện bên dưới.');
      },
      { timeout: 10_000 },
    );
  }

  const busy = pending || locating;
  const selectClass =
    'w-full rounded-md border border-ink-200 bg-white px-3 py-2.5 text-body text-ink-900 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-label uppercase text-ink-500">Khu vực</span>
          <select
            value={areaSlug}
            onChange={(e) => setAreaSlug(e.target.value)}
            className={selectClass}
          >
            <option value="">Tất cả khu vực</option>
            {districts.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name} — {d.provinceName}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-label uppercase text-ink-500">Dịch vụ</span>
          <select
            value={service}
            onChange={(e) => setService(e.target.value)}
            className={selectClass}
          >
            <option value="">Tất cả dịch vụ</option>
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="h-[46px] w-full rounded-md bg-brand-500 px-6 font-medium text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60 sm:w-auto"
          >
            Tìm KTV
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-ink-100 pt-3">
        <button
          type="button"
          onClick={nearMe}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-body-s font-medium text-brand-700 transition hover:bg-brand-50 disabled:opacity-60"
        >
          <svg
            aria-hidden
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="9" />
            <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
          </svg>
          {locating ? 'Đang định vị…' : 'Tìm quanh tôi'}
        </button>

        {geoError && (
          <span role="alert" className="text-body-s text-danger-fg">
            {geoError}
          </span>
        )}
      </div>
    </div>
  );
}
