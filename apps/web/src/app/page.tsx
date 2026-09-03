import Link from 'next/link';
import { HeroSearch } from '@/components/HeroSearch';
import { JsonLd } from '@/components/JsonLd';
import { ServiceIcon } from '@/components/ServiceIcon';
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
      {/* Hero tràn ra ngoài padding của <main> bằng margin âm để dải nền chạy
          hết chiều rộng màn hình, trong khi nội dung vẫn thẳng hàng với phần
          còn lại của trang. */}
      <section className="-mx-4 -mt-8 border-b border-ink-100 bg-gradient-to-b from-brand-50 to-ink-50 px-4 py-10 sm:-mt-10 sm:py-14">
        <div className="mx-auto max-w-shell">
          <h1 className="max-w-3xl text-h1 text-ink-900 sm:text-display">
            Massage trị liệu tại nhà, kỹ thuật viên có chứng chỉ
          </h1>
          <p className="mt-4 max-w-prose text-body-l text-ink-600">
            Tìm kỹ thuật viên ở gần bạn, xem chứng chỉ hành nghề và đánh giá thật của khách trước
            khi gọi. Không mất phí đặt lịch.
          </p>

          <div className="mt-6 max-w-3xl">
            <HeroSearch services={services} />
          </div>

          {/* Ba tín hiệu tin cậy đặt ngay dưới ô tìm kiếm — đây là chỗ khách
              quyết định có đi tiếp hay không, không phải ở footer. */}
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-body-s text-ink-600">
            {[
              'Chứng chỉ hành nghề đã đối chiếu',
              'Đánh giá thật từ khách đã dùng',
              'Thanh toán sau buổi trị liệu',
            ].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <svg
                  aria-hidden
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 text-success-fg"
                >
                  <path d="m9 12 2 2 4-4" />
                  <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
                </svg>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-h2 text-ink-900">Tìm theo khu vực</h2>
        <p className="mt-1.5 text-body-s text-ink-500">
          Chọn quận/huyện để xem kỹ thuật viên nhận khách ở đó.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {areas.map((province) => (
            <div
              key={province.id}
              className="rounded-lg border border-ink-200 bg-white p-4 shadow-card"
            >
              <h3 className="flex items-baseline justify-between gap-2 text-h4">
                <Link
                  href={areaPath(province.slug)}
                  className="text-ink-900 transition hover:text-brand-600"
                >
                  {province.name}
                </Link>
                <span className="tabular shrink-0 text-caption font-normal text-ink-500">
                  {province.ktvCount} KTV
                </span>
              </h3>

              <ul className="mt-3 flex flex-wrap gap-1.5">
                {province.children.slice(0, 8).map((d) => (
                  <li key={d.id}>
                    <Link
                      href={areaPath(province.slug, d.slug)}
                      className="inline-block rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-body-s text-ink-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
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
        <h2 className="text-h2 text-ink-900">Dịch vụ</h2>
        <p className="mt-1.5 text-body-s text-ink-500">
          Mỗi kỹ thuật viên tự công bố bảng giá cho từng dịch vụ trên hồ sơ.
        </p>

        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dich-vu/${s.slug}`}
                className="group flex h-full gap-3 rounded-lg border border-ink-200 bg-white p-4 shadow-card transition hover:border-brand-500 hover:shadow-card-hover"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
                  <ServiceIcon slug={s.slug} className="h-5 w-5" />
                </span>

                <span className="min-w-0">
                  <span className="block font-display text-h4 text-ink-900 transition group-hover:text-brand-700">
                    {s.name}
                  </span>
                  {s.description && (
                    <span className="mt-1 line-clamp-2 block text-body-s text-ink-600">
                      {s.description}
                    </span>
                  )}
                </span>
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
