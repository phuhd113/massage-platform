import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { KtvCard } from '@/components/KtvCard';
import { AREA_REVALIDATE, api } from '@/lib/api';
import { buildStatCards } from '@/lib/area-stats';
import { translateAreaName } from '@/i18n/area-name';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { alternatesFor } from '@/lib/seo';
import { SITE_NAME, absolute, areaPath, ktvPath } from '@/lib/site';

export const revalidate = AREA_REVALIDATE;

interface Props {
  params: { province: string; district: string; locale: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const area = await api.district(params.province, params.district);
  if (!area) return {};

  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const name = translateAreaName(area.name, locale);
  const province = area.parent ? translateAreaName(area.parent.name, locale) : '';
  const basePath = areaPath('vi', params.province, params.district);

  return {
    title: t('areaDistrict.metaTitle', { name, count: area.ktvCount }),
    description: t('areaDistrict.metaDescription', { name, province, count: area.ktvCount }),
    alternates: alternatesFor(locale, basePath),
    // Ngưỡng do backend quyết định (trường indexable). Trang thưa dữ liệu vẫn cho
    // follow để link chảy tiếp sang quận lân cận, và tự mở index khi đủ KTV.
    robots: area.indexable ? undefined : { index: false, follow: true },
    openGraph: {
      title: t('areaDistrict.ogTitle', { name }),
      url: absolute(areaPath(locale, params.province, params.district)),
      type: 'website',
    },
  };
}

export default async function DistrictPage({ params }: Props) {
  const area = await api.district(params.province, params.district);
  if (!area) notFound();

  // Slug quận chỉ duy nhất trong phạm vi tỉnh — riêng "huyen-chau-thanh" có ở 10
  // tỉnh — nên phải gửi kèm tỉnh, không thì trang gộp KTV của cả mười.
  const results = await api.search({
    areaSlug: area.slug,
    provinceSlug: params.province,
    size: 20,
  });
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const name = translateAreaName(area.name, locale);
  const tỉnh = area.parent;
  const provinceName = tỉnh ? translateAreaName(tỉnh.name, locale) : '';
  const path = areaPath(locale, params.province, params.district);
  const statCards = buildStatCards(area.stats, locale, t);

  return (
    <>
      <Breadcrumbs
        label={t('breadcrumbs.label')}
        items={[
          { name: t('common.home'), href: localePath(locale, '/') },
          ...(tỉnh ? [{ name: provinceName, href: areaPath(locale, tỉnh.slug) }] : []),
          { name, href: path },
        ]}
      />

      <h1 className="mt-4 max-w-[24ch] text-display text-ink-900">
        {t('areaDistrict.h1', { name })}
      </h1>

      <p className="mt-3 max-w-prose text-body-l text-ink-600">
        {area.ktvCount > 0 ? (
          <>
            {t('areaDistrict.leadPre')}
            <strong>{area.ktvCount}</strong>
            {t('areaDistrict.leadPost', {
              count: area.ktvCount,
              name,
              province: provinceName ? `, ${provinceName}` : '',
            })}
          </>
        ) : (
          <>
            {t('areaDistrict.leadEmpty', { name })}
          </>
        )}
      </p>

      {/* Cùng khối số liệu với trang tỉnh — xem buildStatCards. */}
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

      {!area.indexable && area.ktvCount > 0 && (
        <p className="mt-4 rounded-lg border border-warning-bd bg-warning-bg px-4 py-3 text-body-s text-warning-fg">
          {t('areaDistrict.thinNotice')}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-h2 text-ink-900">{t('areaDistrict.listTitle', { name })}</h2>
        {results.items.length > 0 ? (
          <ul className="mt-4 grid gap-3">
            {results.items.map((ktv) => (
              <KtvCard key={ktv.id} ktv={ktv} locale={locale} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-body text-ink-500">{t('areaDistrict.listEmpty')}</p>
        )}
      </section>

      {area.siblings.length > 0 && (
        <section className="mt-10">
          <h2 className="text-h2 text-ink-900">{t('areaDistrict.nearby')}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {area.siblings.map((s) => (
              <li key={s.id}>
                <Link
                  href={areaPath(locale, params.province, s.slug)}
                  className="inline-block rounded-full border border-ink-200 bg-white px-3 py-1.5 text-body-s text-ink-700 shadow-card transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                >
                  {translateAreaName(s.name, locale)}
                  {s.ktvCount > 0 && <span className="text-ink-400"> · {s.ktvCount}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 max-w-prose">
        <h2 className="text-h2 text-ink-900">{t('areaDistrict.howToTitle', { name })}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-body text-ink-600">
          <li>{t('areaDistrict.howTo1')}</li>
          <li>{t('areaDistrict.howTo2')}</li>
          <li>{t('areaDistrict.howTo3')}</li>
          <li>{t('areaDistrict.howTo4', { name })}</li>
        </ul>
      </section>

      {results.items.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: t('areaDistrict.jsonLdItemList', { name }),
            numberOfItems: results.items.length,
            itemListElement: results.items.map((ktv, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              url: absolute(ktvPath(locale, ktv.slug, ktv.id)),
              name: ktv.fullName,
            })),
          }}
        />
      )}

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: t('areaDistrict.h1', { name }),
          url: absolute(path),
          isPartOf: {
            '@type': 'WebSite',
            name: SITE_NAME[locale],
            url: absolute(localePath(locale, '/')),
          },
        }}
      />
    </>
  );
}
