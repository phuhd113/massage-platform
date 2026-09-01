'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AreaNode, ServiceItem } from '@/lib/types';

/**
 * Bộ lọc là phần tương tác duy nhất của trang tìm kiếm, tách riêng thành client
 * component nhỏ. Danh sách kết quả vẫn render ở server để có mặt trong HTML đầu.
 */
export function SearchFilters({
  areas,
  services,
}: {
  areas: AreaNode[];
  services: ServiceItem[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function apply(next: URLSearchParams) {
    startTransition(() => router.push(`/tim-kiem?${next.toString()}`));
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);

    // Đổi bộ lọc thì quay về trang 1: giữ nguyên page cũ sẽ cho ra trang trống khi
    // bộ lọc mới có ít kết quả hơn.
    next.delete('page');
    apply(next);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ định vị.');
      return;
    }

    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = new URLSearchParams(params.toString());
        next.set('lat', pos.coords.latitude.toFixed(6));
        next.set('lon', pos.coords.longitude.toFixed(6));
        // Toạ độ và khu vực là hai chế độ khác nhau, giữ cả hai sẽ lọc chồng lên
        // nhau và ra kết quả rỗng khó hiểu.
        next.delete('areaSlug');
        next.delete('page');
        setLocating(false);
        apply(next);
      },
      () => {
        setLocating(false);
        setGeoError('Chưa lấy được vị trí. Bạn có thể chọn quận/huyện bên dưới.');
      },
      { timeout: 10_000 },
    );
  }

  const districts = areas.flatMap((p) =>
    p.children.map((d) => ({ ...d, provinceName: p.name })),
  );

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating || pending}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {locating ? 'Đang định vị…' : 'Tìm quanh tôi'}
          </button>
        </div>

        <label className="text-sm">
          <span className="block text-stone-600">Khu vực</span>
          <select
            className="mt-1 rounded-md border border-stone-300 px-3 py-2"
            value={params.get('areaSlug') ?? ''}
            onChange={(e) => setParam('areaSlug', e.target.value)}
          >
            <option value="">Tất cả</option>
            {districts.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name} — {d.provinceName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-stone-600">Dịch vụ</span>
          <select
            className="mt-1 rounded-md border border-stone-300 px-3 py-2"
            value={params.get('service') ?? ''}
            onChange={(e) => setParam('service', e.target.value)}
          >
            <option value="">Tất cả</option>
            {services.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {params.get('lat') && (
          <label className="text-sm">
            <span className="block text-stone-600">Bán kính</span>
            <select
              className="mt-1 rounded-md border border-stone-300 px-3 py-2"
              value={params.get('radiusKm') ?? '10'}
              onChange={(e) => setParam('radiusKm', e.target.value)}
            >
              {[3, 5, 10, 20, 30].map((km) => (
                <option key={km} value={km}>
                  {km}km
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {geoError && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          {geoError}
        </p>
      )}
    </div>
  );
}
