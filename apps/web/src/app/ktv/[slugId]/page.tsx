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

      {/* pb-24 chừa chỗ cho thanh hành động dính đáy trên mobile — thiếu nó,
          nội dung cuối trang (đánh giá) bị thanh che mất. */}
      <article className="pb-24 lg:pb-0">
        <header className="rounded-xl border border-ink-200 bg-white p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              {/* Avatar chữ cái đầu trên nền gradient jade. Cố ý KHÔNG dùng ảnh
                  stock khi KTV chưa upload: ảnh model vừa tạo kỳ vọng sai về
                  người sẽ đến nhà, vừa kéo trang về phía cảm giác nhạy cảm mà
                  cả định vị thương hiệu đang tránh. */}
              <span
                aria-hidden
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-300 to-brand-600 font-display text-2xl font-semibold text-white sm:h-20 sm:w-20"
              >
                {profile.fullName.trim().charAt(0).toUpperCase()}
              </span>

              <div className="min-w-0">
                <h1 className="text-h1 text-ink-900 sm:text-display">{profile.fullName}</h1>
                <p className="mt-1.5 text-body text-ink-600">
                  {profile.yearsExperience} năm kinh nghiệm · nhận đi trong bán kính{' '}
                  {profile.serviceRadiusKm}km
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.certifications.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-success-bd bg-success-bg px-2.5 py-1 text-caption font-medium text-success-fg">
                      <svg
                        aria-hidden
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 12 2 2 4-4" />
                        <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
                      </svg>
                      Chứng chỉ đã duyệt
                    </span>
                  )}

                  {profile.isOnline && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-2.5 py-1 text-caption font-medium text-brand-700">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success-fg" />
                      Đang nhận khách
                    </span>
                  )}
                </div>
              </div>
            </div>

            {profile.ratingCount > 0 && (
              <div className="shrink-0 text-right">
                <div className="tabular font-display text-h1 text-ink-900">
                  ★ {profile.ratingAvg.toFixed(1)}
                </div>
                <div className="text-body-s text-ink-500">{profile.ratingCount} đánh giá</div>
              </div>
            )}
          </div>

          {/* TrustStrip: bốn con số trả lời "người này có đáng tin không" ngay
              trong khung nhìn đầu, trước khi khách phải cuộn. */}
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ink-200 bg-ink-200 sm:grid-cols-4">
            {[
              { k: 'Chứng chỉ đã duyệt', v: String(profile.certifications.length) },
              { k: 'Năm kinh nghiệm', v: String(profile.yearsExperience) },
              { k: 'Khu vực nhận khách', v: String(profile.coverageAreas.length) },
              {
                k: 'Thành viên từ',
                v: new Date(profile.createdAt).getFullYear().toString(),
              },
            ].map((s) => (
              <div key={s.k} className="bg-white px-3 py-2.5">
                <dt className="text-caption text-ink-500">{s.k}</dt>
                <dd className="tabular mt-0.5 font-display text-h4 text-ink-900">{s.v}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="mt-6">
          <ContactButtons ktvId={profile.id} ktvName={profile.fullName} />
        </div>

        {profile.bio && (
          <section className="mt-8">
            <h2 className="text-h2 text-ink-900">Giới thiệu</h2>
            <p className="mt-2 max-w-prose whitespace-pre-line text-body-l text-ink-700">{profile.bio}</p>
          </section>
        )}

        {profile.services.length > 0 && (
          <section className="mt-8">
            <h2 className="text-h2 text-ink-900">Dịch vụ và bảng giá</h2>
            <ul className="mt-3 divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white shadow-card">
              {profile.services.map((s) => (
                <li key={s.serviceId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <Link href={`/dich-vu/${s.slug}`} className="font-medium hover:text-brand-600">
                      {s.name}
                    </Link>
                    <div className="text-body-s text-ink-500">{s.durationMin} phút</div>
                  </div>
                  <div className="text-right">
                    <div className="tabular font-display font-semibold text-ink-900">{formatVnd(s.priceFrom)}</div>
                    <div className="text-caption text-ink-500">giá từ</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.certifications.length > 0 && (
          <section className="mt-8">
            <h2 className="text-h2 text-ink-900">Chứng chỉ hành nghề đã duyệt</h2>
            <ul className="mt-3 space-y-2">
              {profile.certifications.map((c) => (
                <li key={c.id} className="rounded-md border border-ink-200 bg-white px-4 py-3 shadow-card">
                  <div className="font-display text-h4 text-ink-900">{c.name}</div>
                  {c.issuingOrg && <div className="mt-0.5 text-body-s text-ink-500">{c.issuingOrg}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {profile.coverageAreas.length > 0 && (
          <section className="mt-8">
            <h2 className="text-h2 text-ink-900">Khu vực nhận khách</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {profile.coverageAreas.map((a) => (
                <li key={a.id}>
                  <Link
                    href={
                      a.provinceSlug ? areaPath(a.provinceSlug, a.slug) : areaPath(a.slug)
                    }
                    className="inline-block rounded-full border border-ink-200 bg-white px-3 py-1.5 text-body-s text-ink-700 shadow-card transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {a.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-h2 text-ink-900">Đánh giá của khách</h2>
          {reviews.items.length > 0 ? (
            <ul className="mt-3 space-y-3">
              {reviews.items.map((r) => (
                <li key={r.id} className="rounded-md border border-ink-200 bg-white px-4 py-3 shadow-card">
                  <div className="text-sm font-medium">
                    {'★'.repeat(r.rating)}
                    <span className="text-ink-300">{'★'.repeat(5 - r.rating)}</span>
                  </div>
                  {r.comment && <p className="mt-1.5 max-w-prose text-body text-ink-700">{r.comment}</p>}
                  <time className="mt-1.5 block text-caption text-ink-400" dateTime={r.createdAt}>
                    {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-body text-ink-500">Chưa có đánh giá nào.</p>
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
