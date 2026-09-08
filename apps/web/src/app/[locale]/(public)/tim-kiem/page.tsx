import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KtvCard } from '@/components/KtvCard';
import { MapViewFab } from '@/components/MapViewFab';
import { SearchFilters } from '@/components/SearchFilters';
import { SearchMapPanel } from '@/components/SearchMapPanel';
import { api } from '@/lib/api';
import type { LatLon } from '@/lib/map';
import { translateAreaName } from '@/i18n/area-name';
import { localePath, normalizeLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { absolute } from '@/lib/site';
import type { SearchResponse } from '@/lib/types';

// Kết quả phụ thuộc toạ độ khách nên không ISR được — render mỗi request.
export const dynamic = 'force-dynamic';

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  return {
    title: t('search.metaTitle'),
    description: t('search.metaDescription'),
    // Mọi biến thể bộ lọc (?areaSlug=, ?service=, ?page=, ?view=) canonical về URL
    // gốc — nếu không, một trang duy nhất sinh ra hàng trăm bản gần giống nhau
    // trong index.
    //
    // Cố ý KHÔNG khai hreflang ở đây: trang noindex thì một cụm hreflang trỏ tới nó
    // chẳng nói được gì với Google, chỉ thêm một chỗ nữa phải giữ cho đối xứng.
    alternates: { canonical: absolute(localePath(locale, '/tim-kiem')) },
    // Trang này là công cụ cho khách, không phải trang nội dung để xếp hạng. Trang
    // khu vực mới là trang được tối ưu để index.
    robots: { index: false, follow: true },
  };
}

interface Props {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const numeric = (v: string | undefined) => {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export default async function SearchPage({ params, searchParams }: Props) {
  const locale = normalizeLocale(params.locale);
  const t = createTranslator(getDictionary(locale), locale);

  // Không còn tải cây khu vực: ô lọc nay gọi /areas/suggest theo từng từ khoá, nên
  // 63 tỉnh + 696 quận không phải đi kèm mọi lần mở trang tìm kiếm nữa.
  const services = await api.services();

  const lat = one(searchParams.lat);
  const lon = one(searchParams.lon);
  const areaSlug = one(searchParams.areaSlug);
  // `areaSlug` đứng một mình là slug tỉnh; đi kèm `provinceSlug` mới là slug quận.
  // Bỏ vế này đi là bug cũ của ô select: chọn "Huyện Châu Thành" gửi slug quận trần,
  // backend hiểu thành slug tỉnh và trả về kết quả của một trong mười tỉnh cùng tên.
  const provinceSlug = one(searchParams.provinceSlug);
  const service = one(searchParams.service);
  const radiusKm = one(searchParams.radiusKm) ?? '10';
  const page = Number(one(searchParams.page) ?? '1') || 1;
  const isMapView = one(searchParams.view) === 'map';
  // Chỉ chuyển tiếp khi bật: gửi `isOnline=false` sẽ tạo thêm một biến thể URL cho
  // cùng một tập kết quả.
  const isOnline = one(searchParams.isOnline) === 'true' ? 'true' : undefined;

  // Ba bộ lọc của popup. Lọc qua danh sách trắng / kiểm số ngay ở đây thay vì chuyển
  // tiếp nguyên trạng: query string do khách sửa được, và một giá trị lạ sẽ khiến
  // backend trả 400 — tức cả trang tìm kiếm hỏng vì một tham số phụ gõ sai, thay vì
  // đơn giản là bỏ qua bộ lọc đó.
  const genderParam = one(searchParams.gender);
  const gender = genderParam === 'MALE' || genderParam === 'FEMALE' ? genderParam : undefined;

  const minYearsRaw = numeric(one(searchParams.minYearsExperience));
  const minYearsExperience =
    minYearsRaw !== null && minYearsRaw >= 0 && minYearsRaw <= 60
      ? String(minYearsRaw)
      : undefined;

  const minRatingRaw = numeric(one(searchParams.minRating));
  const minRating =
    minRatingRaw !== null && minRatingRaw >= 0 && minRatingRaw <= 5
      ? String(minRatingRaw)
      : undefined;

  const hasScope = (lat && lon) || areaSlug;

  let results: SearchResponse | null = null;
  let error: string | null = null;

  if (hasScope) {
    try {
      results = await api.search(
        // Bản đồ và danh sách cố ý dùng chung một `size`: chúng phải luôn hiển thị
        // đúng cùng một tập kết quả, nếu không thì bấm đổi cách nhìn lại ra số khác.
        {
          lat, lon, areaSlug, provinceSlug, service, radiusKm, isOnline,
          gender, minYearsExperience, minRating,
          page, size: 20,
        },
        // Kết quả theo toạ độ là riêng của từng khách, không cache dùng chung.
        0,
      );
    } catch {
      error = t('search.errorLoad');
    }
  }

  const originLat = numeric(lat);
  const originLon = numeric(lon);
  const origin: LatLon | null =
    originLat !== null && originLon !== null ? { lat: originLat, lon: originLon } : null;
  // Bán kính chỉ có ý nghĩa khi có toạ độ gốc; chế độ khu vực không có vòng nào để vẽ.
  const mapRadiusKm = origin ? numeric(radiusKm) : null;

  const emptyMessage = (
    <p className="text-ink-600">
      {t('search.empty')}
    </p>
  );

  // Điều kiện phải khớp `canShowMap` bên dưới, nếu không nút nổi mời khách sang một
  // chế độ rồi ở đó không có bản đồ nào — bấm xong thấy đúng không có gì đổi.
  // Bản đồ rỗng vẫn có ích: nó cho thấy vùng đang tìm và kéo sang chỗ khác được.
  const showMap = isMapView && results !== null;

  // Tên khu vực để dựng tiêu đề ("37 kỹ thuật viên tại Quận 7").
  //
  // Tra theo đúng cặp (tỉnh, quận) chứ không `.find()` theo slug trần trên cả cây:
  // slug quận chỉ duy nhất trong phạm vi tỉnh, nên bản cũ lấy trúng khu vực đầu tiên
  // khớp và hiển thị tên tỉnh của một tỉnh khác — sai âm thầm, vì tiêu đề vẫn đọc
  // xuôi tai.
  const areaDetail = areaSlug
    ? provinceSlug
      ? await api.district(provinceSlug, areaSlug)
      : await api.province(areaSlug)
    : null;

  const areaName = areaDetail ? translateAreaName(areaDetail.name, locale) : null;
  // Nhãn đầy đủ cho ô lọc: kèm tên tỉnh để khách thấy mình đang ở quận nào, tỉnh nào.
  const areaLabel = areaDetail
    ? areaDetail.parent
      ? `${translateAreaName(areaDetail.name, locale)}, ${translateAreaName(areaDetail.parent.name, locale)}`
      : translateAreaName(areaDetail.name, locale)
    : '';

  // Tiêu đề mang luôn số lượng ("6 kỹ thuật viên tại Quận 7"): khách đọc được ngay
  // quy mô kết quả, và đây cũng là dòng chữ đầu tiên trong HTML thô nên nó mô tả
  // đúng trang cho crawler.
  //
  // Chỉ đổi <h1> chứ không đổi `metadata.title`: trang này `robots: index:false`,
  // nên title là nhãn tab cho khách, còn phần SEO theo địa danh do trang khu vực
  // đảm nhiệm. Sinh title động ở đây sẽ tạo hàng trăm biến thể cho một trang cố
  // tình không index.
  const heading = results
    ? areaName
      ? t('search.headingArea', { count: results.total, area: areaName })
      : origin
        ? t('search.headingNearby', { count: results.total })
        : t('search.headingPlain', { count: results.total })
    : t('search.headingIdle');

  // Nút nổi hiện bất cứ khi nào đã có một lượt tìm, kể cả lượt trả về 0 kết quả.
  //
  // Bản cũ đòi `items.length > 0 || origin !== null`, nên trang "0 KTV tại Quận 7"
  // (tìm theo `areaSlug`, không có toạ độ) mất nút. Đó lại đúng lúc bản đồ có ích
  // nhất: khách nhìn thấy vùng mình đang tìm và kéo sang quận bên cạnh, thay vì đọc
  // một câu báo rỗng rồi không biết đi đâu tiếp.
  //
  // Ở mobile đây là lối **duy nhất** đổi cách xem — cụm "Danh sách / Bản đồ" trong
  // khối lọc là `sm:hidden` vì ba phần tử không vừa 390px (xem `SearchFilters`).
  // Nên điều kiện ở đây không được chặt hơn cần thiết: mất nút nổi ở mobile là mất
  // hẳn bản đồ, không phải chỉ mất một lối tắt.
  const canShowMap = results !== null;

  return (
    <>
      <Suspense fallback={<div className="h-14 rounded-xl border border-ink-200 bg-white" />}>
        <SearchFilters services={services} areaLabel={areaLabel} locale={locale} />
      </Suspense>

      {canShowMap && (
        <Suspense fallback={null}>
          <MapViewFab locale={locale} />
        </Suspense>
      )}

      <div className="mt-7 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-h1 text-ink-900">{heading}</h1>

        {/*
          "Sắp xếp" hiện ở dạng nhãn tĩnh: thứ tự do FinalScore của backend quyết
          định, và đó là thứ KTV trả tiền để mua. Mở cho khách đổi sang "giá thấp
          nhất" hay "gần nhất" sẽ đẩy vị trí trả phí xuống dưới — một quyết định
          kinh doanh, không phải việc thêm một <select>.
        */}
        {results && results.items.length > 0 && (
          <p className="text-body-s text-ink-500">
            {t('search.sortLabel')}{' '}
            <span className="font-semibold text-ink-700">{t('search.sortBest')}</span>
          </p>
        )}
      </div>

      {/* pb-24 ở mobile chừa chỗ cho nút nổi: thiếu nó thì nút che mất thẻ KTV cuối
          cùng, và thẻ cuối là thứ khách cuộn hết trang mới tới được. */}
      <section className={`mt-4 ${canShowMap ? 'pb-24 sm:pb-0' : ''}`}>
        {!hasScope && (
          <p className="text-ink-600">
            {t('search.promptPre')}
            <strong>{t('search.promptAction')}</strong>
            {t('search.promptPost')}
          </p>
        )}

        {error && (
          <p role="alert" className="text-danger-fg">
            {error}
          </p>
        )}

        {results && (
          <>
            {showMap ? (
              // Danh sách vẫn render ở server và vẫn nằm trong HTML đầu tiên — bản
              // đồ là lớp phủ thêm bên cạnh, không thay thế nó.
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Suspense
                  fallback={<div className="h-[420px] rounded-lg bg-ink-100 lg:h-[560px]" />}
                >
                  <SearchMapPanel
                    items={results.items}
                    origin={origin}
                    radiusKm={mapRadiusKm}
                    locale={locale}
                  />
                </Suspense>

                <div className="lg:max-h-[560px] lg:overflow-y-auto lg:pr-1">
                  {results.items.length > 0 ? (
                    <ul className="grid gap-3">
                      {results.items.map((ktv) => (
                        <KtvCard key={ktv.id} ktv={ktv} locale={locale} />
                      ))}
                    </ul>
                  ) : (
                    emptyMessage
                  )}
                </div>
              </div>
            ) : results.items.length > 0 ? (
              // Một cột: thẻ mang ảnh, chip và hàng giá — chia đôi bề ngang
              // sẽ ép mọi thứ xuống dòng và hàng nút hành động vỡ trước tiên.
              <ul className="grid gap-3">
                {results.items.map((ktv) => (
                  <KtvCard key={ktv.id} ktv={ktv} locale={locale} />
                ))}
              </ul>
            ) : (
              <div className="mt-4">{emptyMessage}</div>
            )}
          </>
        )}
      </section>
    </>
  );
}

