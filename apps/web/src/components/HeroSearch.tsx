'use client';

import { useRouter } from 'next/navigation';
import { type Locale, localePath } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator } from '@/i18n/t';
import { useFormValidation } from '@/lib/use-form-validation';
import { messagesFor } from '@/lib/validation-messages';
import { useState, useTransition } from 'react';
import { AreaSearchBox } from '@/components/AreaSearchBox';
import { NearMeIcon, SearchIcon } from '@/components/icons';
import { areaScopeParams } from '@/lib/area-search';
import { geoErrorMessage, getPosition } from '@/lib/geolocate';
import type { AreaSuggestion, ServiceItem } from '@/lib/types';

/**
 * Ô tìm kiếm trên trang chủ.
 *
 * Client component nhưng cố ý rất nhỏ. Toàn bộ nội dung Google cần (H1, mô tả,
 * danh sách khu vực dạng link tĩnh, danh sách dịch vụ) vẫn nằm ở server component
 * bọc ngoài, nên vẫn có mặt trong HTML đầu tiên — ô này không thay thế chúng.
 *
 * Không tự động định vị khi tải trang: xin quyền GPS ngay khi khách vừa vào là
 * cách nhanh nhất để bị từ chối vĩnh viễn ở cấp trình duyệt. Khách bấm thì mới
 * hỏi, lúc đó họ đã hiểu vì sao cần.
 */
export function HeroSearch({ services, locale }: { services: ServiceItem[]; locale: Locale }) {
  const t = createTranslator(getDictionary(locale), locale);
  const formRef = useFormValidation(messagesFor(locale));
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [service, setService] = useState('');
  const [geoError, setGeoError] = useState<string | null>(null);

  // Khu vực đã chọn, không phải chữ đang gõ dở: chỉ gợi ý được chọn mới mang đủ vế
  // tỉnh để dựng URL đúng.
  const [area, setArea] = useState<AreaSuggestion | null>(null);

  function submit() {
    const q = new URLSearchParams();

    if (area) {
      const { areaSlug, provinceSlug } = areaScopeParams(area);
      q.set('areaSlug', areaSlug);
      // Slug quận chỉ duy nhất trong phạm vi tỉnh — thiếu vế này thì backend hiểu
      // nó là slug tỉnh, và mười "Huyện Châu Thành" trở thành một kết quả tuỳ ý.
      if (provinceSlug) q.set('provinceSlug', provinceSlug);
    }

    if (service) q.set('service', service);
    startTransition(() => router.push(localePath(locale, `/tim-kiem?${q.toString()}`)));
  }

  async function nearMe() {
    setLocating(true);
    setGeoError(null);

    const result = await getPosition();
    setLocating(false);

    if (!result.ok) {
      // Ba loại lỗi, ba câu khác nhau: bị chặn quyền thì bấm lại vô ích, còn mất tín
      // hiệu thì thử lại là được. Bản cũ hiện chung một câu cho cả ba.
      setGeoError(
        geoErrorMessage(result.kind, {
          unsupported: t('home.heroGeoUnsupported'),
          denied: t('filters.geoDenied'),
          unavailable: t('filters.geoFailed'),
        }),
      );
      return;
    }

    const q = new URLSearchParams();
    q.set('lat', result.coords.latitude.toFixed(6));
    q.set('lon', result.coords.longitude.toFixed(6));
    if (service) q.set('service', service);
    startTransition(() => router.push(localePath(locale, `/tim-kiem?${q.toString()}`)));
  }

  const busy = pending || locating;

  // Hai ô nằm trong **một** khung viền chung, mỗi ô không có viền riêng: khung ngoài
  // là ô tìm kiếm, hai ô trong là hai phần của nó. Vẽ viền cho từng ô sẽ đọc thành
  // ba điều khiển rời rạc đặt cạnh nhau.
  const fieldClass =
    'flex flex-col gap-0.5 rounded-lg px-3.5 py-2.5 transition hover:bg-brand-50 focus-within:bg-brand-50';
  const labelClass = 'text-label uppercase text-ink-500';
  const controlClass =
    'w-full border-0 bg-transparent p-0 pr-7 text-body-l font-medium text-ink-900 placeholder:font-normal placeholder:text-ink-500 focus:outline-none focus:ring-0';

  return (
    <div>
      {/*
        Form thật với method GET, không phải div: khi JS chưa hydrate (hoặc hỏng), Enter
        vẫn gửi được sang /tim-kiem. Không có gợi ý thì khách mất khả năng chọn quận
        chính xác, nhưng vẫn còn danh sách khu vực dạng link tĩnh ở dưới trang.
      */}
      <form
        ref={formRef}
        action={localePath(locale, '/tim-kiem')}
        method="GET"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-2xl border border-ink-200 bg-white p-2 shadow-card"
      >
        {/* Ô khu vực rộng hơn ô dịch vụ: tên dịch vụ ngắn và nằm trong tập đóng,
            còn ô khu vực phải chứa được "Phường Bến Nghé, Quận 1" mà không cắt chữ. */}
        <div className="grid items-stretch gap-1.5 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_auto]">
          <label className={fieldClass}>
            <span className={labelClass}>{t('home.heroAreaLabel')}</span>
            <AreaSearchBox
              onSelect={setArea}
              onClear={() => setArea(null)}
              placeholder={t('home.heroAreaPlaceholder')}
              labels={{
                clear: t('filters.areaClear'),
                suggestions: t('filters.areaSuggestions'),
                ktvCount: (n) =>
                  n > 0 ? t('filters.areaKtvCount', { count: n }) : t('filters.areaNoKtv'),
              }}
              inputClassName={controlClass}
            />
          </label>

          {/* Vạch ngăn mảnh thay cho viền: chỉ để mắt biết đây là hai ô, không đóng
              khung cho từng ô. Ẩn ở mobile vì lúc đó hai ô xếp chồng. */}
          <label className={`${fieldClass} sm:border-l sm:border-ink-100`}>
            <span className={labelClass}>{t('home.heroServiceLabel')}</span>
            <select
              name="service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className={`${controlClass} cursor-pointer`}
            >
              <option value="">{t('home.heroServiceAll')}</option>
              {services.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-500 px-6 py-3 text-body-l font-semibold text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
          >
            <SearchIcon size={16} className="h-4 w-4 shrink-0" />
            {t('home.heroSubmit')}
          </button>
        </div>
      </form>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <button
          type="button"
          onClick={nearMe}
          disabled={busy}
          className="inline-flex items-center gap-[7px] rounded-full border border-ink-200 bg-white px-3.5 py-2 text-body-s font-semibold text-brand-500 transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60"
        >
          <NearMeIcon size={16} className="h-4 w-4 shrink-0" />
          {locating ? t('filters.locating') : t('filters.nearMe')}
        </button>

        {/*
          Cố ý KHÔNG có lời mời KTV ở đây. Hàng này là công cụ của **khách** đang đi
          tìm dịch vụ; một nút đổi vai trò đặt xen vào giữa nút GPS và lời hứa quyền
          riêng tư là mời người ta rời đúng việc họ vừa mở trang để làm. Lối vào phễu
          KTV nằm ở header (`shell.navForKtv`) trên mọi trang công khai, nên không
          mất đường nào.
        */}
        {/*
          Câu này là một cam kết, không phải chú thích: nó trả lời đúng câu hỏi khách
          đang nghĩ khi nhìn thấy nút xin vị trí, ngay tại chỗ họ nghĩ ra nó.
        */}
        {geoError ? (
          <span role="alert" className="text-body-s text-danger-fg">
            {geoError}
          </span>
        ) : (
          <span className="text-body-s text-ink-500">{t('home.heroGeoPromise')}</span>
        )}
      </div>
    </div>
  );
}
