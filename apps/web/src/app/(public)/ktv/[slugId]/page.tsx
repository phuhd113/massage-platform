import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ContactButtons } from '@/components/ContactButtons';
import { JsonLd } from '@/components/JsonLd';
import { CertifiedIcon } from '@/components/icons';
import { ProfileViewBeacon } from '@/components/ProfileViewBeacon';
import { PROFILE_REVALIDATE, api } from '@/lib/api';
import { absolute, areaPath, formatDate, formatVnd, ktvPath, parseKtvSlugId } from '@/lib/site';
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

  // Dịch vụ rẻ nhất làm mức "giá từ" cho khối liên hệ. Lấy min chứ không lấy phần
  // tử đầu: thứ tự mảng do backend quyết định và không hứa hẹn gì về giá.
  const cheapest =
    profile.services.length > 0
      ? profile.services.reduce((a, b) => (b.priceFrom < a.priceFrom ? b : a))
      : null;

  return (
    <>
      {/* Đếm lượt xem từ trình duyệt — trang này được cache nên đếm ở server sẽ
          chỉ ghi được một lượt mỗi 10 phút. Xem ghi chú trong component. */}
      <ProfileViewBeacon ktvId={profile.id} />

      <Breadcrumbs
        items={[
          { name: 'Trang chủ', href: '/' },
          ...(quận?.provinceSlug
            ? [{ name: quận.name, href: areaPath(quận.provinceSlug, quận.slug) }]
            : []),
          { name: profile.fullName, href: path },
        ]}
      />

      {/* pb-32 chừa chỗ cho thanh hành động dính đáy trên mobile (nút + dòng giá) —
          thiếu nó, nội dung cuối trang (đánh giá) bị thanh che mất. */}
      <article className="pb-32 lg:pb-0">
        <header className="flex flex-wrap items-start gap-5">
          {/* Ô ảnh chân dung — placeholder cùng kiểu với thẻ listing. Backend chưa
              có cột avatar; khi có thì thay ruột, bố cục quanh nó không đổi.
              Cố ý KHÔNG dùng ảnh stock: ảnh model vừa tạo kỳ vọng sai về người sẽ
              đến nhà, vừa kéo trang về phía cảm giác nhạy cảm mà định vị thương
              hiệu đang tránh. */}
          <span
            aria-hidden
            className="flex h-24 w-24 shrink-0 select-none items-center justify-center rounded-xl border border-ink-200 bg-brand-50 text-4xl font-bold text-brand-400 sm:h-28 sm:w-28"
          >
            {profile.fullName.trim().split(/\s+/).at(-1)?.charAt(0).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="text-display text-ink-900">{profile.fullName}</h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {profile.certifications.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success-bd bg-success-bg px-2.5 py-1 text-caption font-medium text-success-fg">
                  <ShieldCheckIcon />
                  {profile.certifications.length} chứng chỉ đã duyệt
                </span>
              )}

              {profile.isOnline && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success-bd bg-success-bg px-2.5 py-1 text-caption font-medium text-success-fg">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success-fg" />
                  Đang nhận khách
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-caption font-medium text-ink-600">
                nhận đi trong <span className="tabular">{profile.serviceRadiusKm}km</span>
              </span>
            </div>

            <p className="mt-3 text-body-l text-ink-600">
              {profile.ratingCount > 0 ? (
                <>
                  <span aria-hidden>★</span>{' '}
                  <span className="tabular font-semibold text-ink-900">
                    {profile.ratingAvg.toFixed(1).replace('.', ',')}
                  </span>{' '}
                  · {profile.ratingCount} đánh giá ·{' '}
                </>
              ) : (
                <>Hồ sơ mới · chưa có đánh giá · </>
              )}
              {profile.yearsExperience} năm kinh nghiệm
            </p>
          </div>
        </header>

        {/*
          Hai cột từ lg: nội dung bên trái, khối liên hệ dính bên phải. Khối giá và
          nút gọi phải theo khách xuống suốt trang — đó là hành động duy nhất trang
          này tồn tại để dẫn tới, và bắt khách cuộn ngược lên tìm là mất lượt liên
          hệ có thật.
        */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="min-w-0">
            {profile.certifications.length > 0 && (
              <section>
                <h2 className="text-h2 text-ink-900">Chứng chỉ hành nghề đã duyệt</h2>
                <ul className="mt-3 space-y-2">
                  {profile.certifications.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-start justify-between gap-4 rounded-xl border border-ink-200 bg-white px-4 py-3.5 shadow-card"
                    >
                      <div className="min-w-0">
                        <div className="text-h4 text-ink-900">{c.name}</div>
                        {(c.issuingOrg || c.issuedAt) && (
                          <div className="mt-0.5 text-body-s text-ink-500">
                            {c.issuingOrg}
                            {c.issuingOrg && c.issuedAt && ' · '}
                            {c.issuedAt && `cấp ${new Date(c.issuedAt).getFullYear()}`}
                          </div>
                        )}
                      </div>

                      {/*
                        "Đã đối chiếu" chứ không phải "Đã xác minh": admin so bản
                        gốc với tổ chức cấp, và nói quá mức việc mình làm là hứa
                        với khách một sự bảo đảm sàn không đứng ra chịu.
                      */}
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success-bd bg-success-bg px-2.5 py-1 text-caption font-medium text-success-fg">
                        <ShieldCheckIcon />
                        Đã đối chiếu
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.bio && (
              <section className="mt-8">
                <h2 className="text-h2 text-ink-900">Giới thiệu</h2>
                <p className="mt-2 max-w-prose whitespace-pre-line text-body-l text-ink-700">
                  {profile.bio}
                </p>
              </section>
            )}

            {profile.services.length > 0 && (
              <section className="mt-8">
                <h2 className="text-h2 text-ink-900">Dịch vụ và bảng giá</h2>
                <ul className="mt-3 divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card">
                  {profile.services.map((s) => (
                    <li
                      key={s.serviceId}
                      className="flex items-center justify-between gap-4 px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/dich-vu/${s.slug}`}
                          className="text-h4 text-ink-900 transition hover:text-brand-600"
                        >
                          {s.name}
                        </Link>
                        <div className="mt-0.5 text-body-s text-ink-500">
                          <span className="tabular">{s.durationMin}</span> phút
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular text-h4 text-ink-900">{formatVnd(s.priceFrom)}</div>
                        <div className="text-caption text-ink-500">giá từ</div>
                      </div>
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
                        href={a.provinceSlug ? areaPath(a.provinceSlug, a.slug) : areaPath(a.slug)}
                        className="inline-block rounded-full border border-ink-200 bg-white px-3.5 py-2 text-body-s text-ink-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
                      >
                        {a.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-h2 text-ink-900">Đánh giá của khách</h2>
                {profile.ratingCount > 0 && (
                  <p className="text-body-s text-ink-500">
                    <span aria-hidden>★</span>{' '}
                    <span className="tabular font-semibold text-ink-700">
                      {profile.ratingAvg.toFixed(1).replace('.', ',')}
                    </span>{' '}
                    từ {profile.ratingCount} đánh giá
                  </p>
                )}
              </div>

              {reviews.items.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {reviews.items.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-ink-200 bg-white px-4 py-3.5 shadow-card"
                    >
                      <div className="text-body-s">
                        <span className="text-champagne-500" aria-hidden>
                          {'★'.repeat(r.rating)}
                        </span>
                        <span className="text-ink-300" aria-hidden>
                          {'★'.repeat(5 - r.rating)}
                        </span>
                        <span className="sr-only">{r.rating} trên 5 sao</span>
                      </div>
                      {r.comment && (
                        <p className="mt-1.5 max-w-prose text-body text-ink-700">{r.comment}</p>
                      )}
                      <time className="mt-1.5 block text-caption text-ink-400" dateTime={r.createdAt}>
                        {formatDate(r.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-body text-ink-500">Chưa có đánh giá nào.</p>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24">
            <ContactButtons
              ktvId={profile.id}
              ktvName={profile.fullName}
              cheapestService={cheapest}
            />
          </aside>
        </div>
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

/** Khiên có dấu tích — chứng chỉ đã được đối chiếu với tổ chức cấp. */
function ShieldCheckIcon() {
  return <CertifiedIcon size={16} className="h-3 w-3" />;
}
