'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { MAX_RADIUS_KM, haversineKm, type LatLon, type Scope } from '@/lib/map';
import type { SearchItem } from '@/lib/types';

/** Chiều cao cố định ở cả khung chờ lẫn bản đồ thật, để không sinh layout shift. */
const HEIGHT = 'h-[420px] lg:h-[560px]';

// Leaflet đụng `window` ngay lúc import nên không chạy được ở server. Bọc dynamic
// phải nằm trong client component: Next 14 không cho ssr:false trong Server Component.
const SearchMap = dynamic(() => import('@/components/SearchMap'), {
  ssr: false,
  loading: () => (
    <div
      className={`${HEIGHT} w-full animate-pulse rounded-lg border border-stone-200 bg-stone-100`}
    />
  ),
});

interface Props {
  items: SearchItem[];
  origin: LatLon | null;
  radiusKm: number | null;
}

/**
 * Ngưỡng coi là "khách đã kéo đi chỗ khác".
 *
 * Không có ngưỡng thì một cú chạm lệch vài pixel cũng làm nút hiện ra rồi biến mất.
 */
function movedEnough(scope: Scope, origin: LatLon | null, radiusKm: number | null) {
  if (!origin || !radiusKm) return true;
  const shifted = haversineKm(scope, origin) > radiusKm * 0.15;
  const zoomed = Math.abs(scope.radiusKm - radiusKm) / radiusKm > 0.2;
  return shifted || zoomed;
}

export function SearchMapPanel({ items, origin, radiusKm }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState<Scope | null>(null);

  function searchHere() {
    if (!scope) return;
    const next = new URLSearchParams(params.toString());
    next.set('lat', scope.lat.toFixed(6));
    next.set('lon', scope.lon.toFixed(6));
    next.set('radiusKm', String(scope.radiusKm));
    // Toạ độ và khu vực là hai chế độ khác nhau — cùng quy tắc với "Tìm quanh tôi".
    next.delete('areaSlug');
    next.delete('page');
    next.set('view', 'map');
    setScope(null);
    startTransition(() => router.push(`/tim-kiem?${next.toString()}`));
  }

  const showButton = scope !== null && movedEnough(scope, origin, radiusKm);

  return (
    <div className="relative">
      <div className={`${HEIGHT} overflow-hidden rounded-lg border border-stone-200`}>
        <SearchMap items={items} origin={origin} radiusKm={radiusKm} onUserMove={setScope} />
      </div>

      {showButton && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
          <button
            type="button"
            onClick={searchHere}
            disabled={pending}
            className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-medium text-stone-900 shadow-lg ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
          >
            {pending ? 'Đang tìm…' : 'Tìm ở khu vực này'}
          </button>
        </div>
      )}

      {scope?.clamped && (
        <p className="mt-2 text-xs text-amber-800">
          Bản đồ đang rộng hơn bán kính tìm tối đa ({MAX_RADIUS_KM}km). Tìm ở khu vực này sẽ
          chỉ quét trong {MAX_RADIUS_KM}km quanh tâm bản đồ.
        </p>
      )}
    </div>
  );
}
