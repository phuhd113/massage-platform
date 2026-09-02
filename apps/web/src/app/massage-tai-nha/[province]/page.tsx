import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { KtvCard } from '@/components/KtvCard';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { absolute, areaPath } from '@/lib/site';

export const revalidate = AREA_REVALIDATE;

interface Props {
  params: { province: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = await api.province(params.province);
  if (!area) return {};

  const path = areaPath(params.province);

  return {
    title: `Massage trị liệu tại nhà ${area.name} — ${area.ktvCount} KTV có chứng chỉ`,
    description:
      `Tìm kỹ thuật viên massage trị liệu đến tận nhà tại ${area.name} theo từng quận/huyện. ` +
      `Chứng chỉ hành nghề đã duyệt, bảng giá và đánh giá thật của khách.`,
    alternates: { canonical: absolute(path) },
    robots: area.indexable ? undefined : { index: false, follow: true },
    openGraph: { title: `Massage tại nhà ${area.name}`, url: absolute(path), type: 'website' },
  };
}

export default async function ProvincePage({ params }: Props) {
  const area = await api.province(params.province);
  if (!area) notFound();

  const results = await api.search({ areaSlug: area.slug, size: 8 });

  // Quận có KTV lên trước: trang tỉnh là nơi khách chọn quận, danh sách xếp theo
  // tên sẽ đẩy những quận rỗng lên đầu và làm trang trông như không có ai.
  const districts = [...area.children].sort((a, b) => b.ktvCount - a.ktvCount);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Trang chủ', href: '/' },
          { name: area.name, href: areaPath(params.province) },
        ]}
      />

      <h1 className="text-h1 text-ink-900 sm:text-display">
        Massage trị liệu tại nhà {area.name}
      </h1>
      <p className="mt-3 max-w-2xl text-ink-600">
        {area.ktvCount} kỹ thuật viên đang nhận khách tại {area.name}. Chọn quận/huyện của bạn để
        xem những người ở gần nhất.
      </p>

      <section className="mt-8">
        <h2 className="text-h2 text-ink-900">Chọn quận/huyện</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {districts.map((d) => (
            <li key={d.id}>
              <Link
                href={areaPath(params.province, d.slug)}
                className="flex items-center justify-between rounded-md border border-ink-200 bg-white px-4 py-3 text-body-s shadow-card transition hover:border-brand-500 hover:shadow-card-hover"
              >
                <span>{d.name}</span>
                <span className="text-ink-500">
                  {d.ktvCount > 0 ? `${d.ktvCount} KTV` : '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {results.items.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h2 text-ink-900">Kỹ thuật viên nổi bật tại {area.name}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {results.items.map((ktv) => (
              <KtvCard key={ktv.id} ktv={ktv} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
