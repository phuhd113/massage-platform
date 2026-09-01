import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { absolute, areaPath } from '@/lib/site';

export const revalidate = AREA_REVALIDATE;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = await api.service(params.slug);
  if (!service) return {};

  return {
    title: `${service.name} tại nhà — KTV có chứng chỉ`,
    description:
      service.description ??
      `Tìm kỹ thuật viên ${service.name.toLowerCase()} nhận đến tận nhà, có chứng chỉ hành nghề.`,
    alternates: { canonical: absolute(`/dich-vu/${service.slug}`) },
  };
}

export default async function ServicePage({ params }: Props) {
  const service = await api.service(params.slug);
  if (!service) notFound();

  // Trang dịch vụ là trang trung chuyển, không phải trang danh sách: nó nối
  // "massage Thái" với từng quận để phủ long-tail "massage Thái Quận 7".
  //
  // Cố ý không liệt kê KTV toàn quốc ở đây. Search luôn phải có phạm vi (toạ độ
  // hoặc khu vực) nên truy vấn đó sẽ bị backend từ chối; và kể cả cho phép, mọi
  // trang dịch vụ sẽ hiện gần như cùng một danh sách — đúng kiểu nội dung trùng
  // lặp mà mô hình khu-vực × dịch-vụ dễ sinh ra nhất.
  const areas = await api.areaTree();

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Trang chủ', href: '/' },
          { name: service.name, href: `/dich-vu/${service.slug}` },
        ]}
      />

      <h1 className="text-2xl font-semibold sm:text-3xl">{service.name} tại nhà</h1>
      {service.description && (
        <p className="mt-3 max-w-2xl text-stone-600">{service.description}</p>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Tìm {service.name.toLowerCase()} theo khu vực</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {areas.map((province) => (
            <div key={province.id}>
              <h3 className="font-medium">{province.name}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {province.children
                  .filter((d) => d.ktvCount > 0)
                  .map((d) => (
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
    </>
  );
}
