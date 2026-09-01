import Link from 'next/link';
import { JsonLd } from '@/components/JsonLd';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { SITE_NAME, absolute, areaPath } from '@/lib/site';

// Render theo request thay vì prerender lúc build: build không được phụ thuộc vào
// một API đang chạy, nếu không CI phải dựng cả stack chỉ để đóng gói frontend.
// Dữ liệu vẫn đi qua cache fetch (revalidate trong lib/api) nên API không bị gọi
// lại mỗi request.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [areas, services] = await Promise.all([api.areaTree(), api.services()]);

  return (
    <>
      <section>
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Massage trị liệu tại nhà, kỹ thuật viên có chứng chỉ
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-stone-600">
          Tìm kỹ thuật viên ở gần bạn, xem chứng chỉ hành nghề và đánh giá thật của khách trước khi
          gọi. Không mất phí đặt lịch.
        </p>
        <Link
          href="/tim-kiem"
          className="mt-6 inline-block rounded-md bg-brand-500 px-6 py-3 font-medium text-white transition hover:bg-brand-600"
        >
          Tìm KTV gần tôi
        </Link>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Tìm theo khu vực</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {areas.map((province) => (
            <div key={province.id}>
              <h3 className="font-medium">
                <Link href={areaPath(province.slug)} className="hover:text-brand-600">
                  {province.name}
                </Link>
                <span className="ml-2 text-sm font-normal text-stone-500">
                  {province.ktvCount} KTV
                </span>
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {province.children.slice(0, 8).map((d) => (
                  <li key={d.id}>
                    <Link
                      href={areaPath(province.slug, d.slug)}
                      className="inline-block rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:border-brand-500 hover:text-brand-600"
                    >
                      {d.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold">Dịch vụ</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dich-vu/${s.slug}`}
                className="block h-full rounded-lg border border-stone-200 bg-white p-4 hover:border-brand-500"
              >
                <div className="font-medium">{s.name}</div>
                {s.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-stone-600">{s.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: absolute('/'),
          inLanguage: 'vi-VN',
          // Chưa khai báo SearchAction: Phase 1 chỉ tìm theo toạ độ và khu vực, chưa
          // có ô tìm kiếm bằng từ khoá. Khai báo một hành động mà site không xử lý
          // được là structured data không khớp thực tế, và Google kiểm tra nó thật.
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: SITE_NAME,
          url: absolute('/'),
        }}
      />
    </>
  );
}
