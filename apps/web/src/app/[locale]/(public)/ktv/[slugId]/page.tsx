import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ContactButtons } from '@/components/ContactButtons';
import { JsonLd } from '@/components/JsonLd';
import { CertifiedIcon } from '@/components/icons';
import { ProfileViewBeacon } from '@/components/ProfileViewBeacon';
import { ReportProfileButton } from '@/components/ReportProfileButton';
import { ReviewForm } from '@/components/ReviewForm';
import { PROFILE_REVALIDATE, api } from '@/lib/api';
import { initialOf, isOptimizable, mediaUrl, photoAlt } from '@/lib/media';
import { VietnameseNote } from '@/components/VietnameseNote';
import { translateAreaName } from '@/i18n/area-name';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { alternatesFor } from '@/lib/seo';
import {
  absolute,
  areaPath,
  formatDate,
  formatRating,
  formatVnd,
  ktvPath,
  parseKtvSlugId,
} from '@/lib/site';
import type { PublicKtvProfile, ReviewList } from '@/lib/types';

export const revalidate = PROFILE_REVALIDATE;

interface Props {
  params: { slugId: string; locale: string };
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

  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  const khuVực = profile.coverageAreas
    .map((a) => translateAreaName(a.name, locale))
    .slice(0, 2)
    .join(', ');

  return {
    title: t('ktvProfile.metaTitle', { name: profile.fullName }),
    description: t('ktvProfile.metaDescription', {
      name: profile.fullName,
      years: profile.yearsExperience,
      area: khuVực ? t('ktvProfile.metaAreaPrefix', { area: khuVực }) : '',
    }),
    alternates: alternatesFor(locale, ktvPath('vi', profile.slug, profile.id)),
    openGraph: {
      title: profile.fullName,
      url: absolute(ktvPath(locale, profile.slug, profile.id)),
      type: 'profile',
    },
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

  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);
  const viNote = t('ktvProfile.writtenInVietnamese');

  const quận = profile.coverageAreas.find((a) => a.level === 'DISTRICT');
  const path = ktvPath(locale, profile.slug, profile.id);

  // Dịch vụ rẻ nhất làm mức "giá từ" cho khối liên hệ. Lấy min chứ không lấy phần
  // tử đầu: thứ tự mảng do backend quyết định và không hứa hẹn gì về giá.
  const cheapest =
    profile.services.length > 0
      ? profile.services.reduce((a, b) => (b.priceFrom < a.priceFrom ? b : a))
      : null;

  const avatar = mediaUrl(profile.avatarUrl);

  // Ảnh cho structured data: chỉ URL tuyệt đối. Khi chạy đĩa local (dev) `mediaUrl`
  // trả về origin của API, vẫn tuyệt đối; nhưng nếu vì lý do nào đó còn đường tương
  // đối thì lọc bỏ — Google bỏ qua nó trong im lặng, và một mảng có phần tử hỏng
  // khó phát hiện hơn hẳn một mảng ngắn.
  // Cùng cách dựng với generateMetadata: hai khu vực đầu, đã dịch.
  const khuVựcSchema = profile.coverageAreas
    .map((a) => translateAreaName(a.name, locale))
    .slice(0, 2)
    .join(', ');

  const schemaImages = [avatar, ...profile.photos.map((p) => mediaUrl(p.url))].filter(
    (url): url is string => url !== null && /^https?:\/\//.test(url),
  );

  return (
    <>
      {/* Đếm lượt xem từ trình duyệt — trang này được cache nên đếm ở server sẽ
          chỉ ghi được một lượt mỗi 10 phút. Xem ghi chú trong component. */}
      <ProfileViewBeacon ktvId={profile.id} />

      <Breadcrumbs
        label={t('breadcrumbs.label')}
        items={[
          { name: t('common.home'), href: localePath(locale, '/') },
          ...(quận?.provinceSlug
            ? [
                {
                  name: translateAreaName(quận.name, locale),
                  href: areaPath(locale, quận.provinceSlug, quận.slug),
                },
              ]
            : []),
          { name: profile.fullName, href: path },
        ]}
      />

      {/* pb-32 chừa chỗ cho thanh hành động dính đáy trên mobile (nút + dòng giá) —
          thiếu nó, nội dung cuối trang (đánh giá) bị thanh che mất. */}
      <article className="pb-32 lg:pb-0">
        <header className="flex flex-wrap items-start gap-5">
          {/* Ô ảnh chân dung. KTV chưa đặt ảnh thì hiện chữ cái đầu tên — cùng kiểu
              với thẻ listing, và cố ý KHÔNG dùng ảnh stock: ảnh model vừa tạo kỳ
              vọng sai về người sẽ đến nhà, vừa kéo trang về phía cảm giác nhạy cảm
              mà định vị thương hiệu đang tránh. */}
          {avatar ? (
            <Image
              src={avatar}
              // Ảnh này là ứng viên LCP của trang, nên `priority` để trình duyệt
              // không phải chờ đọc xong CSS mới biết cần tải nó.
              priority
              alt={t('ktvProfile.avatarAlt', { name: profile.fullName })}
              width={112}
              height={112}
              sizes="112px"
              className="h-24 w-24 shrink-0 rounded-xl border border-ink-200 object-cover sm:h-28 sm:w-28"
              unoptimized={!isOptimizable(avatar)}
            />
          ) : (
            <span
              aria-hidden
              className="flex h-24 w-24 shrink-0 select-none items-center justify-center rounded-xl border border-ink-200 bg-brand-50 text-4xl font-bold text-brand-400 sm:h-28 sm:w-28"
            >
              {initialOf(profile.fullName)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-display text-ink-900">{profile.fullName}</h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {profile.certifications.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success-bd bg-success-bg px-2.5 py-1 text-caption font-medium text-success-fg">
                  <ShieldCheckIcon />
                  {t('ktvProfile.certCount', { count: profile.certifications.length })}
                </span>
              )}

              {profile.isOnline && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-success-bd bg-success-bg px-2.5 py-1 text-caption font-medium text-success-fg">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success-fg" />
                  {t('ktvProfile.online')}
                </span>
              )}

              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-2.5 py-1 text-caption font-medium text-ink-600">
                {t('ktvProfile.radius')} <span className="tabular">{profile.serviceRadiusKm}km</span>
              </span>
            </div>

            <p className="mt-3 text-body-l text-ink-600">
              {profile.ratingCount > 0 ? (
                <>
                  <span aria-hidden>★</span>{' '}
                  <span className="tabular font-semibold text-ink-900">
                    {formatRating(profile.ratingAvg, locale)}
                  </span>{' '}
                  {t('ktvProfile.reviewCountInline', { count: profile.ratingCount })}{' '}
                </>
              ) : (
                <>{t('ktvProfile.newProfileInline')} </>
              )}
              {t('ktvProfile.experience', { count: profile.yearsExperience })}
              {/* Nối vào cùng dòng thay vì thêm một dòng riêng: hồ sơ chưa khai (hồ sơ
                  cũ) sẽ không để lại khoảng trống nào, và một dòng chỉ có mỗi chữ "Nữ"
                  không đáng chiếm một tầng trong khối đầu trang. */}
              {profile.gender && <> · {t(`gender.${profile.gender}`)}</>}
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
                <h2 className="text-h2 text-ink-900">
                  {t('ktvProfile.certsTitle')}
                  <VietnameseNote label={viNote} />
                </h2>
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
                        {t('ktvProfile.certChecked')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

                        {/*
              Ảnh đứng sau phần chứng chỉ và trước bảng giá: nó là bằng chứng cho
              những gì vừa đọc, và khách nhìn nó trước khi quyết định giá có đáng
              không. Chỉ ảnh đã duyệt tới được đây — backend lọc, frontend không tự
              lọc lại để hai nơi không thể lệch nhau.
            */}
            {profile.photos.length > 0 && (
              <section className="mt-8">
                <h2 className="text-h2 text-ink-900">{t('ktvProfile.photosTitle')}</h2>
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {profile.photos.map((p) => {
                    const src = mediaUrl(p.url);
                    if (!src) return null;

                    return (
                      <li
                        key={p.id}
                        className="overflow-hidden rounded-xl border border-ink-200 bg-ink-50"
                      >
                        <Image
                          src={src}
                          alt={photoAlt(profile.fullName, p.caption)}
                          width={400}
                          height={300}
                          // Hai cột ở mobile, ba từ sm. Khai sizes để Next không tải
                          // bản rộng bằng cả viewport cho một ô chiếm một phần ba.
                          sizes="(min-width: 640px) 33vw, 50vw"
                          // Khung 4:3 cố định: ảnh KTV chụp bằng điện thoại có đủ
                          // mọi tỉ lệ, để nguyên thì lưới nhảy lởm chởm và mỗi tấm
                          // tải xong lại đẩy nội dung bên dưới (CLS).
                          className="aspect-[4/3] w-full object-cover"
                          unoptimized={!isOptimizable(src)}
                        />
                        {p.caption && (
                          <p lang="vi" className="px-3 py-2 text-body-s text-ink-600">
                            {p.caption}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
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
                          <span className="tabular">{s.durationMin}</span> {t('ktvProfile.minutes')}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="tabular text-h4 text-ink-900">
                          {formatVnd(s.priceFrom, locale)}
                        </div>
                        <div className="text-caption text-ink-500">{t('ktvProfile.priceFrom')}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {profile.coverageAreas.length > 0 && (
              <section className="mt-8">
                <h2 className="text-h2 text-ink-900">{t('ktvProfile.areasTitle')}</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {profile.coverageAreas.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={
                          a.provinceSlug
                            ? areaPath(locale, a.provinceSlug, a.slug)
                            : areaPath(locale, a.slug)
                        }
                        className="inline-block rounded-full border border-ink-200 bg-white px-3.5 py-2 text-body-s text-ink-700 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-600"
                      >
                        {translateAreaName(a.name, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-h2 text-ink-900">
                  {t('ktvProfile.reviewsTitle')}
                  <VietnameseNote label={viNote} />
                </h2>
                {profile.ratingCount > 0 && (
                  <p className="text-body-s text-ink-500">
                    <span aria-hidden>★</span>{' '}
                    <span className="tabular font-semibold text-ink-700">
                      {formatRating(profile.ratingAvg, locale)}
                    </span>{' '}
                    {t('ktvProfile.ratingFrom', { count: profile.ratingCount })}
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
                        <span className="sr-only">
                          {t('ktvProfile.starsSr', { rating: r.rating })}
                        </span>
                      </div>
                      {r.comment && (
                        <p lang="vi" className="mt-1.5 max-w-prose text-body text-ink-700">
                          {r.comment}
                        </p>
                      )}
                      <time className="mt-1.5 block text-caption text-ink-400" dateTime={r.createdAt}>
                        {formatDate(r.createdAt, locale)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-body text-ink-500">{t('ktvProfile.noReviews')}</p>
              )}

              {/* Ngay dưới danh sách, trong cùng section: người vừa đọc đánh giá của
                  người khác là người sẵn sàng viết nhất. Client component vì trang
                  này là ISR 600 giây — xem ghi chú trong ReviewForm. */}
              <ReviewForm ktvId={profile.id} ktvName={profile.fullName} locale={locale} />
            </section>

            {/* Cuối cột nội dung, sau đánh giá: lối thoát hiểm cho thiểu số, đặt ở
                nơi không cạnh tranh với hành động chính của trang là liên hệ. */}
            <ReportProfileButton ktvId={profile.id} locale={locale} />
          </div>

          <aside className="lg:sticky lg:top-24">
            <ContactButtons
              ktvId={profile.id}
              ktvName={profile.fullName}
              cheapestService={cheapest}
              locale={locale}
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
          // Mô tả dựng từ dữ liệu có cấu trúc (tên + số năm + khu vực), dùng đúng
          // chuỗi của <meta description> ở generateMetadata. Trước đây trường này
          // lấy từ bio do KTV tự nhập — nguồn đó đã gỡ, và một mô tả dựng bằng luật
          // thì không bao giờ lệch khỏi thẻ meta của cùng trang.
          description: t('ktvProfile.metaDescription', {
            name: profile.fullName,
            years: profile.yearsExperience,
            area: khuVựcSchema
              ? t('ktvProfile.metaAreaPrefix', { area: khuVựcSchema })
              : '',
          }),
          // Ảnh trong structured data là điều kiện để Google hiện rich result có
          // hình. Chỉ khai URL tuyệt đối — đường tương đối bị bỏ qua trong im lặng,
          // và mất luôn phần hiển thị nổi bật nhất trên trang kết quả.
          image: schemaImages.length > 0 ? schemaImages : undefined,
          areaServed: profile.coverageAreas.map((a) => ({
            '@type': 'Place',
            name: translateAreaName(a.name, locale),
          })),
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
