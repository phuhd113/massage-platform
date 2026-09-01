import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KtvCard } from '@/components/KtvCard';
import { SearchFilters } from '@/components/SearchFilters';
import { api } from '@/lib/api';
import { absolute } from '@/lib/site';
import type { SearchResponse } from '@/lib/types';

// Kết quả phụ thuộc toạ độ khách nên không ISR được — render mỗi request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tìm kỹ thuật viên massage tại nhà',
  description:
    'Tìm kỹ thuật viên massage trị liệu nhận đến tận nhà theo vị trí hiện tại hoặc theo quận/huyện.',
  // Mọi biến thể bộ lọc (?areaSlug=, ?service=, ?page=) canonical về URL gốc —
  // nếu không, một trang duy nhất sinh ra hàng trăm bản gần giống nhau trong index.
  alternates: { canonical: absolute('/tim-kiem') },
  // Trang này là công cụ cho khách, không phải trang nội dung để xếp hạng. Trang
  // khu vực mới là trang được tối ưu để index.
  robots: { index: false, follow: true },
};

interface Props {
  searchParams: Record<string, string | string[] | undefined>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SearchPage({ searchParams }: Props) {
  const [areas, services] = await Promise.all([api.areaTree(), api.services()]);

  const lat = one(searchParams.lat);
  const lon = one(searchParams.lon);
  const areaSlug = one(searchParams.areaSlug);
  const service = one(searchParams.service);
  const radiusKm = one(searchParams.radiusKm) ?? '10';
  const page = Number(one(searchParams.page) ?? '1') || 1;

  const hasScope = (lat && lon) || areaSlug;

  let results: SearchResponse | null = null;
  let error: string | null = null;

  if (hasScope) {
    try {
      results = await api.search(
        { lat, lon, areaSlug, service, radiusKm, page, size: 20 },
        // Kết quả theo toạ độ là riêng của từng khách, không cache dùng chung.
        0,
      );
    } catch {
      error = 'Không tải được kết quả. Vui lòng thử lại.';
    }
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Tìm kỹ thuật viên</h1>

      <div className="mt-6">
        <Suspense fallback={<div className="h-24 rounded-lg border border-stone-200 bg-white" />}>
          <SearchFilters areas={areas} services={services} />
        </Suspense>
      </div>

      <section className="mt-8">
        {!hasScope && (
          <p className="text-stone-600">
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
            <p className="text-sm text-stone-500">{results.total} kết quả</p>
            {results.items.length > 0 ? (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {results.items.map((ktv) => (
                  <KtvCard key={ktv.id} ktv={ktv} />
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-stone-600">
                Chưa có KTV nào khớp. Thử tăng bán kính hoặc bỏ bớt bộ lọc dịch vụ.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
