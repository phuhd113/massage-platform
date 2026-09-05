import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { KtvCard } from '@/components/KtvCard';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { buildStatCards } from '@/lib/area-stats';
import { translateAreaName } from '@/i18n/area-name';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { alternatesFor } from '@/lib/seo';
import { absolute, areaPath } from '@/lib/site';

export const revalidate = AREA_REVALIDATE;

interface Props {
  params: { province: string; locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = await api.province(params.province);
  if (!area) return {};

  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const name = translateAreaName(area.name, locale);
  const basePath = areaPath('vi', params.province);

  return {
    title: t('areaProvince.metaTitle', { name, count: area.ktvCount }),
    description: t('areaProvince.metaDescription', { name, count: area.ktvCount }),
    alternates: alternatesFor(locale, basePath),
    robots: area.indexable ? undefined : { index: false, follow: true },
    openGraph: {
      title: t('areaProvince.ogTitle', { name }),
      url: absolute(areaPath(locale, params.province)),
      type: 'website',
    },
  };
}

export default async function ProvincePage({ params }: Props) {
  const area = await api.province(params.province);
  if (!area) notFound();

  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const name = translateAreaName(area.name, locale);

  const results = await api.search({ areaSlug: area.slug, size: 8 });

  // Quận có KTV lên trước: trang tỉnh là nơi khách chọn quận, danh sách xếp theo
  // tên sẽ đẩy những quận rỗng lên đầu và làm trang trông như không có ai.
  const districts = [...area.children].sort((a, b) => b.ktvCount - a.ktvCount);

  const statCards = buildStatCards(area.stats, locale, t);

  return (
    <>
      <Breadcrumbs
        label={t('breadcrumbs.label')}
        items={[
          { name: t('common.home'), href: localePath(locale, '/') },
          { name, href: areaPath(locale, params.province) },
        ]}
      />

      <h1 className="mt-4 max-w-[24ch] text-display text-ink-900">
        {t('areaProvince.h1', { name })}
      </h1>
      <p className="mt-3 max-w-prose text-body-l text-ink-600">
        {t('areaProvince.lead', { count: area.ktvCount, name })}
      </p>

      {/*
        Ba con số ngay dưới tiêu đề. Đây là nội dung riêng của từng khu vực, không
        phải trang trí: ~760 trang khu vực dùng chung một bộ khung chữ, nên không có
        số liệu thật thì chúng chỉ khác nhau đúng cái địa danh — đúng định nghĩa thin
        content. Ô nào chưa có dữ liệu thì bỏ hẳn, không hiện "—": một hàng gạch ngang
        cũng là thin content, chỉ là trông có vẻ đầy đủ hơn.
      */}
      {statCards.length > 0 && (
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 rounded-xl border border-ink-200 bg-white px-5 py-4 shadow-card">
          {statCards.map((s) => (
            <div key={s.label}>
              <dt className="text-caption text-ink-500">{s.label}</dt>
              <dd className="tabular mt-0.5 text-h4 text-ink-900">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <section className="mt-9">
        <h2 className="text-h2 text-ink-900">{t('areaProvince.pickDistrict')}</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {districts.map((d) => (
            <li key={d.id}>
              <Link
                href={areaPath(locale, params.province, d.slug)}
                className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 bg-white px-4 py-3 text-body-s text-ink-700 shadow-card transition hover:border-brand-300 hover:shadow-card-hover"
              >
                <span className="font-medium">{translateAreaName(d.name, locale)}</span>
                {/*
                  Số KTV, không kèm chữ "KTV": cột số thẳng hàng đọc nhanh hơn nhiều
                  khi có 20+ quận xếp lưới. Quận rỗng hiện gạch ngang mờ chứ không ẩn
                  đi — khách cần biết quận của mình có trong danh sách nhưng chưa có ai.
                */}
                <span
                  className={`tabular shrink-0 ${d.ktvCount > 0 ? 'font-semibold text-ink-900' : 'text-ink-400'}`}
                >
                  {d.ktvCount > 0 ? d.ktvCount : '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {results.items.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h2 text-ink-900">{t('areaProvince.featured', { name })}</h2>
          <ul className="mt-4 grid gap-3">
            {results.items.map((ktv) => (
              <KtvCard key={ktv.id} ktv={ktv} locale={locale} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
