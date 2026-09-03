import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { KtvCard } from '@/components/KtvCard';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { SITE_NAME, absolute, areaPath, ktvPath } from '@/lib/site';

export const revalidate = AREA_REVALIDATE;

interface Props {
  params: { province: string; district: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = await api.district(params.province, params.district);
  if (!area) return {};

  const path = areaPath(params.province, params.district);
  const tỉnh = area.parent?.name ?? '';

  return {
    title: `Massage trị liệu tại nhà ${area.name} — ${area.ktvCount} KTV có chứng chỉ`,
    description:
      `Danh sách kỹ thuật viên massage trị liệu nhận đến tận nhà tại ${area.name}, ${tỉnh}. ` +
      `Xem chứng chỉ hành nghề, bảng giá và đánh giá của khách trước khi gọi.`,
    alternates: { canonical: absolute(path) },
    // Ngưỡng do backend quyết định (trường indexable). Trang thưa dữ liệu vẫn cho
    // follow để link chảy tiếp sang quận lân cận, và tự mở index khi đủ KTV.
    robots: area.indexable ? undefined : { index: false, follow: true },
    openGraph: {
      title: `Massage tại nhà ${area.name}`,
      url: absolute(path),
      type: 'website',
    },
  };
}

export default async function DistrictPage({ params }: Props) {
  const area = await api.district(params.province, params.district);
  if (!area) notFound();

  const results = await api.search({ areaSlug: area.slug, size: 20 });
  const tỉnh = area.parent;
  const path = areaPath(params.province, params.district);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Trang chủ', href: '/' },
          ...(tỉnh ? [{ name: tỉnh.name, href: areaPath(tỉnh.slug) }] : []),
          { name: area.name, href: path },
        ]}
      />

      <h1 className="text-h1 text-ink-900 sm:text-display">
        Massage trị liệu tại nhà {area.name}
      </h1>

      <p className="mt-3 max-w-prose text-body-l text-ink-600">
        {area.ktvCount > 0 ? (
          <>
            Hiện có <strong>{area.ktvCount}</strong> kỹ thuật viên nhận đến tận nhà tại {area.name}
            {tỉnh ? `, ${tỉnh.name}` : ''}. Mọi hồ sơ đều đã được duyệt chứng chỉ hành nghề trước
            khi hiển thị.
          </>
        ) : (
          <>
            Chưa có kỹ thuật viên nào nhận khu vực {area.name}. Bạn có thể xem các quận lân cận bên
            dưới — nhiều KTV nhận đi trong bán kính 10km.
          </>
        )}
      </p>

      {!area.indexable && area.ktvCount > 0 && (
        <p className="mt-4 rounded-md border border-warning-bd bg-warning-bg px-4 py-3 text-body-s text-warning-fg">
          Khu vực này còn ít kỹ thuật viên. Thử mở rộng sang quận lân cận để có nhiều lựa chọn hơn.
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-h2 text-ink-900">Kỹ thuật viên tại {area.name}</h2>
        {results.items.length > 0 ? (
          <ul className="mt-4 grid gap-3">
            {results.items.map((ktv) => (
              <KtvCard key={ktv.id} ktv={ktv} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-body text-ink-500">Chưa có hồ sơ nào trong khu vực này.</p>
        )}
      </section>

      {area.siblings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h2 text-ink-900">Khu vực lân cận</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {area.siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={areaPath(params.province, s.slug)}
                  className="inline-block rounded-full border border-ink-200 bg-white px-3 py-1.5 text-body-s text-ink-700 shadow-card transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                >
                  {s.name}
                  {s.ktvCount > 0 && <span className="text-ink-400"> · {s.ktvCount}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 max-w-prose">
        <h2 className="text-h2 text-ink-900">Chọn kỹ thuật viên ở {area.name} thế nào</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body text-ink-600">
          <li>
            Ưu tiên hồ sơ có chứng chỉ hành nghề đã duyệt — chứng chỉ hiển thị công khai ngay trên
            trang hồ sơ.
          </li>
          <li>
            Đọc đánh giá thật của khách trước đó. Hồ sơ mới có ít đánh giá không đồng nghĩa với kém,
            nhưng nên hỏi kỹ hơn về kinh nghiệm.
          </li>
          <li>
            Trao đổi rõ dịch vụ, thời lượng và giá trước khi hẹn giờ. Bảng giá trên hồ sơ là giá khởi
            điểm.
          </li>
          <li>
            Nếu KTV ở xa {area.name}, hãy xác nhận lại phí di chuyển — bán kính nhận khách của mỗi
            người khác nhau.
          </li>
        </ul>
      </section>

      {results.items.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: `Kỹ thuật viên massage tại nhà ${area.name}`,
            numberOfItems: results.items.length,
            itemListElement: results.items.map((ktv, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: absolute(ktvPath(ktv.slug, ktv.id)),
              name: ktv.fullName,
            })),
          }}
        />
      )}

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `Massage trị liệu tại nhà ${area.name}`,
          url: absolute(path),
          isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: absolute('/') },
        }}
      />
    </>
  );
}
