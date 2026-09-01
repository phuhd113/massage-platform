import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ContactButtons } from '@/components/ContactButtons';
import { JsonLd } from '@/components/JsonLd';
import { PROFILE_REVALIDATE, api } from '@/lib/api';
import { absolute, areaPath, formatVnd, ktvPath, parseKtvSlugId } from '@/lib/site';
import type { PublicKtvProfile, ReviewList } from '@/lib/types';

export const revalidate = PROFILE_REVALIDATE;

interface Props {
  params: { slugId: string };
}

async function load(slugId: string): Promise<PublicKtvProfile | null> {
  const parsed = parseKtvSlugId(slugId);
  if (!parsed) return null;

  const profile = await api.ktvBySlug(parsed.slug);
  // Slug là nguồn tra cứu, id trong URL phải khớp: nếu không, cùng một hồ sơ có
  // vô số URL hợp lệ khác nhau và Google phải tự đoán bản nào là chính.
  return profile && profile.id === parsed.id ? profile : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await load(params.slugId);
  if (!profile) return {};

  const khuVực = profile.coverageAreas.map((a) => a.name).slice(0, 2).join(', ');
  const path = ktvPath(profile.slug, profile.id);

  return {
    title: `${profile.fullName} — KTV massage tại nhà${khuVực ? ` ${khuVực}` : ''}`,
    description:
      `${profile.fullName}, ${profile.yearsExperience} năm kinh nghiệm massage trị liệu tại nhà` +
      `${khuVực ? ` khu vực ${khuVực}` : ''}. ` +
      `Chứng chỉ hành nghề đã duyệt, bảng giá công khai, đánh giá thật từ khách.`,
    alternates: { canonical: absolute(path) },
    openGraph: { title: profile.fullName, url: absolute(path), type: 'profile' },
  };
}

export default async function KtvPage({ params }: Props) {
  const profile = await load(params.slugId);
  if (!profile) notFound();

  let reviews: ReviewList = { items: [], page: 1, size: 0, total: 0 };
  try {
    reviews = await api.reviews(profile.id);
  } catch {
    // Đánh giá là phần phụ của trang. Mất nó không đáng để cả trang hồ sơ trả lỗi
    // và rơi khỏi index.
  }

  const quận = profile.coverageAreas.find((a) => a.level === 'DISTRICT');
  const path = ktvPath(profile.slug, profile.id);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Trang chủ', href: '/' },
          ...(quận?.provinceSlug
            ? [{ name: quận.name, href: areaPath(quận.provinceSlug, quận.slug) }]
            : []),
          { name: profile.fullName, href: path },
        ]}
      />

      <article>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{profile.fullName}</h1>
            <p className="mt-2 text-stone-600">
              {profile.yearsExperience} năm kinh nghiệm · nhận đi trong bán kính{' '}
              {profile.serviceRadiusKm}km
            </p>
          </div>

          {profile.ratingCount > 0 && (
            <div className="text-right">
              <div className="text-2xl font-semibold">★ {profile.ratingAvg.toFixed(1)}</div>
              <div className="text-sm text-stone-500">{profile.ratingCount} đánh giá</div>
            </div>
          )}
        </header>

        <div className="mt-6">
          <ContactButtons ktvId={profile.id} ktvName={profile.fullName} />
        </div>

        {profile.bio && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Giới thiệu</h2>
            <p className="mt-2 whitespace-pre-line text-stone-700">{profile.bio}</p>
          </section>
        )}

        {profile.services.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Dịch vụ và bảng giá</h2>
            <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
              {profile.services.map((s) => (
                <li key={s.serviceId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <Link href={`/dich-vu/${s.slug}`} className="font-medium hover:text-brand-600">
                      {s.name}
                    </Link>
                    <div className="text-sm text-stone-500">{s.durationMin} phút</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatVnd(s.priceFrom)}</div>
                    <div className="text-xs text-stone-500">giá từ</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.certifications.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Chứng chỉ hành nghề đã duyệt</h2>
            <ul className="mt-3 space-y-2">
              {profile.certifications.map((c) => (
                <li key={c.id} className="rounded-md border border-stone-200 bg-white px-4 py-3">
                  <div className="font-medium">{c.name}</div>
                  {c.issuingOrg && <div className="text-sm text-stone-500">{c.issuingOrg}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.coverageAreas.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Khu vực nhận khách</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {profile.coverageAreas.map((a) => (
                <li key={a.id}>
                  <Link
                    href={
                      a.provinceSlug ? areaPath(a.provinceSlug, a.slug) : areaPath(a.slug)
                    }
                    className="inline-block rounded-full border border-stone-300 px-3 py-1 text-sm text-stone-700 hover:border-brand-500 hover:text-brand-600"
                  >
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Đánh giá của khách</h2>
          {reviews.items.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {reviews.items.map((r) => (
                <li key={r.id} className="rounded-md border border-stone-200 bg-white px-4 py-3">
                  <div className="text-sm font-medium">
                    {'★'.repeat(r.rating)}
                    <span className="text-stone-300">{'★'.repeat(5 - r.rating)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-stone-700">{r.comment}</p>}
                  <time className="mt-1 block text-xs text-stone-400" dateTime={r.createdAt}>
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-stone-500">Chưa có đánh giá nào.</p>
          )}
        </section>
      </article>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ProfessionalService',
          '@id': absolute(path),
          name: profile.fullName,
          url: absolute(path),
          description: profile.bio ?? undefined,
          areaServed: profile.coverageAreas.map((a) => ({ '@type': 'Place', name: a.name })),
          makesOffer: profile.services.map((s) => ({
            '@type': 'Offer',
            itemOffered: { '@type': 'Service', name: s.name },
            price: s.priceFrom,
            priceCurrency: 'VND',
          })),
          // AggregateRating chỉ xuất hiện khi có đánh giá thật. Gắn rating cho hồ sơ
          // chưa ai đánh giá là vi phạm chính sách structured data của Google và
          // hậu quả là mất rich result của toàn bộ tên miền, không riêng trang này.
          ...(profile.ratingCount > 0
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: profile.ratingAvg,
                  reviewCount: profile.ratingCount,
                  bestRating: 5,
                  worstRating: 1,
                },
              }
            : {}),
          ...(reviews.items.length > 0
            ? {
                review: reviews.items.slice(0, 10).map((r) => ({
                  '@type': 'Review',
                  reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
                  datePublished: r.createdAt,
                  reviewBody: r.comment ?? undefined,
                })),
              }
            : {}),
        }}
      />
    </>
  );
}
