import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { translateAreaName } from '@/i18n/area-name';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { alternatesFor } from '@/lib/seo';
import { SERVICE_IMAGES } from '@/lib/service-images';
import { serviceDescription, serviceName, serviceNameInSentence } from '@/lib/service-i18n';
import { absolute, areaPath } from '@/lib/site';

export const revalidate = AREA_REVALIDATE;

interface Props {
  params: { slug: string; locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = await api.service(params.slug);
  if (!service) return {};

  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const name = serviceName(service, locale);

  // Chỉ đoạn đầu tiên: mô tả biên tập nhiều đoạn (xem ServiceSeeder.cs) cách
  // nhau bằng "\n\n", và thẻ <meta description> phải là một đoạn ngắn, không
  // chứa ký tự xuống dòng thô.
  const firstParagraph = serviceDescription(service, locale)?.split('\n\n')[0];

  return {
    title: t('servicePage.metaTitle', { name }),
    description:
      firstParagraph ??
      t('servicePage.metaDescriptionFallback', {
        nameLower: serviceNameInSentence(service, locale),
      }),
    alternates: alternatesFor(locale, `/dich-vu/${service.slug}`),
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
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const name = serviceName(service, locale);
  const description = serviceDescription(service, locale);
  const image = SERVICE_IMAGES[service.slug];

  // Mô tả biên tập tách đoạn bằng "\n\n" (xem ServiceSeeder.cs) — cần bọc từng
  // đoạn trong <p> riêng, một <p> chứa "\n\n" thô sẽ không xuống dòng trong HTML.
  const paragraphs = description?.split('\n\n') ?? [];

  return (
    <>
      <Breadcrumbs
        label={t('breadcrumbs.label')}
        items={[
          { name: t('common.home'), href: localePath(locale, '/') },
          { name, href: localePath(locale, `/dich-vu/${service.slug}`) },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          <h1 className="text-h1 text-ink-900 sm:text-display">{t('servicePage.h1', { name })}</h1>
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="mt-3 max-w-2xl text-ink-600">
              {paragraph}
            </p>
          ))}
        </div>

        {image && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-ink-200 bg-brand-50 shadow-card lg:aspect-square">
            <Image
              src={image}
              alt={t(`servicePage.imageAlt.${service.slug}`)}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        )}
      </div>

      <section className="mt-10">
        <h2 className="text-h2 text-ink-900">
          {t('servicePage.byArea', { nameLower: serviceNameInSentence(service, locale) })}
        </h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {areas.map((province) => (
            <div key={province.id}>
              <h3 className="font-medium">{translateAreaName(province.name, locale)}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {province.children
                  .filter((d) => d.ktvCount > 0)
                  .map((d) => (
                    <li key={d.id}>
                      <Link
                        href={areaPath(locale, province.slug, d.slug)}
                        className="inline-block rounded-full border border-ink-200 bg-white px-3 py-1.5 text-body-s text-ink-700 shadow-card transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                      >
                        {translateAreaName(d.name, locale)}
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
