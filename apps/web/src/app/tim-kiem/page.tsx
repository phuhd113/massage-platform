import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KtvCard } from '@/components/KtvCard';
import { SearchFilters } from '@/components/SearchFilters';
import { SearchMapPanel } from '@/components/SearchMapPanel';
import { api } from '@/lib/api';
import type { LatLon } from '@/lib/map';
import { absolute } from '@/lib/site';
import type { SearchResponse } from '@/lib/types';

// Kết quả phụ thuộc toạ độ khách nên không ISR được — render mỗi request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tìm kỹ thuật viên massage tại nhà',
  description:
    'Tìm kỹ thuật viên massage trị liệu nhận đến tận nhà theo vị trí hiện tại hoặc theo quận/huyện.',
  // Mọi biến thể bộ lọc (?areaSlug=, ?service=, ?page=, ?view=) canonical về URL gốc
  // — nếu không, một trang duy nhất sinh ra hàng trăm bản gần giống nhau trong index.
  alternates: { canonical: absolute('/tim-kiem') },
  // Trang này là công cụ cho khách, không phải trang nội dung để xếp hạng. Trang
  // khu vực mới là trang được tối ưu để index.
  robots: { index: false, follow: true },
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const numeric = (v: string | undefined) => {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default async function SearchPage({ searchParams }: Props) {
  const [areas, services] = await Promise.all([api.areaTree(), api.services()]);

  const lat = one(searchParams.lat);
  const lon = one(searchParams.lon);
  const areaSlug = one(searchParams.areaSlug);
  const service = one(searchParams.service);
  const radiusKm = one(searchParams.radiusKm) ?? '10';
  const page = Number(one(searchParams.page) ?? '1') || 1;
  const isMapView = one(searchParams.view) === 'map';

  const hasScope = (lat && lon) || areaSlug;

  let results: SearchResponse | null = null;
  let error: string | null = null;

  if (hasScope) {
    try {
      results = await api.search(
        // Bản đồ và danh sách cố ý dùng chung một `size`: chúng phải luôn hiển thị
        // đúng cùng một tập kết quả, nếu không thì bấm đổi cách nhìn lại ra số khác.
        { lat, lon, areaSlug, service, radiusKm, page, size: 20 },
        // Kết quả theo toạ độ là riêng của từng khách, không cache dùng chung.
        0,
      );
    } catch {
      error = 'Không tải được kết quả. Vui lòng thử lại.';
    }
  }

  const originLat = numeric(lat);
  const originLon = numeric(lon);
  const origin: LatLon | null =
    originLat !== null && originLon !== null ? { lat: originLat, lon: originLon } : null;
  // Bán kính chỉ có ý nghĩa khi có toạ độ gốc; chế độ khu vực không có vòng nào để vẽ.
  const mapRadiusKm = origin ? numeric(radiusKm) : null;

  const emptyMessage = (
    <p className="text-ink-600">
      Chưa có KTV nào khớp. Thử tăng bán kính hoặc bỏ bớt bộ lọc dịch vụ.
    </p>
  );

  const showMap = isMapView && results !== null && (results.items.length > 0 || origin !== null);

  return (
    <>
      <h1 className="text-h1 text-ink-900">Tìm kỹ thuật viên</h1>

      <div className="mt-6">
        <Suspense fallback={<div className="h-24 rounded-lg border border-ink-200 bg-white" />}>
          <SearchFilters areas={areas} services={services} />
        </Suspense>
      </div>

      <section className="mt-8">
        {!hasScope && (
          <p className="text-ink-600">
            Bấm <strong>Tìm quanh tôi</strong> để tìm theo vị trí hiện tại, hoặc chọn quận/huyện.
          </p>
        )}

        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}

        {results && (
          <>
            <p className="text-sm text-ink-500">{results.total} kết quả</p>

            {showMap ? (
              // Danh sách vẫn render ở server và vẫn nằm trong HTML đầu tiên — bản
              // đồ là lớp phủ thêm bên cạnh, không thay thế nó.
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Suspense
                  fallback={<div className="h-[420px] rounded-lg bg-ink-100 lg:h-[560px]" />}
                >
                  <SearchMapPanel
                    items={results.items}
                    origin={origin}
                    radiusKm={mapRadiusKm}
                  />
                </Suspense>

                <div className="lg:max-h-[560px] lg:overflow-y-auto lg:pr-1">
                  {results.items.length > 0 ? (
                    <ul className="grid gap-3">
                      {results.items.map((ktv) => (
                        <KtvCard key={ktv.id} ktv={ktv} />
                      ))}
                    </ul>
                  ) : (
                    emptyMessage
                  )}
                </div>
              </div>
            ) : results.items.length > 0 ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {results.items.map((ktv) => (
                  <KtvCard key={ktv.id} ktv={ktv} />
                ))}
              </ul>
            ) : (
              <div className="mt-4">{emptyMessage}</div>
            )}
          </>
        )}
      </section>
    </>
  );
}
