'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { AreaSearchBox } from '@/components/AreaSearchBox';
import { CertifiedIcon } from '@/components/icons';
import {
  applyAreaScope,
  applyCoords,
  areaScopeLabel,
  clearAreaScope,
  resolveArea,
} from '@/lib/area-search';
import type { ServiceItem } from '@/lib/types';

/**
 * Bộ lọc là phần tương tác duy nhất của trang tìm kiếm, tách riêng thành client
 * component nhỏ. Danh sách kết quả vẫn render ở server để có mặt trong HTML đầu.
 */
export function SearchFilters({
  services,
  areaLabel = '',
}: {
  services: ServiceItem[];
  /**
   * Nhãn khu vực đang lọc, do server tra từ cặp (provinceSlug, areaSlug). Truyền
   * xuống thay vì để client tự tra: client chỉ có slug, mà slug quận trùng nhau
   * giữa các tỉnh nên tra ngược sẽ hiện nhầm tên tỉnh.
   */
  areaLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  /**
   * Tên quận dò được từ GPS, cho chế độ tìm theo toạ độ.
   *
   * Tách khỏi `areaLabel` (do server tra từ slug) vì hai thứ này thuộc hai chế độ loại
   * trừ nhau: lúc tìm theo toạ độ thì không có `areaSlug` để server tra, còn lúc tìm
   * theo khu vực thì nhãn của server mới là nguồn đúng.
   */
  const [nearbyLabel, setNearbyLabel] = useState('');

  const lat = params.get('lat');
  const lon = params.get('lon');
  const hasCoords = Boolean(lat);

  /**
   * Dò tên quận mỗi khi trang đang ở chế độ toạ độ.
   *
   * Theo dõi toạ độ **trong URL** chứ không gọi ngay trong `useMyLocation`, vì trang
   * này có ba lối vào cùng mang lat/lon: bấm nút ở đây, bấm nút ở trang chủ (điều
   * hướng sang với toạ độ sẵn trong URL), và mở lại một link đã lưu. Chỉ lối đầu đi
   * qua hàm đó, nên đặt ở đấy sẽ để hai lối kia có ô khu vực trống.
   *
   * Không chặn gì cả: kết quả tìm kiếm đã hiển thị xong từ server theo toạ độ thật,
   * đây chỉ điền thêm cái nhãn khi nó về.
   */
  useEffect(() => {
    if (!lat || !lon) {
      // Rời chế độ toạ độ thì bỏ nhãn cũ ngay, đừng đợi lần dò sau: giữ lại nghĩa là
      // ô hiện tên quận khách đang đứng trong khi kết quả là của quận họ vừa chọn.
      setNearbyLabel('');
      return;
    }

    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    // Cờ huỷ, không phải AbortController: cái cần chặn là setState của một lượt dò đã
    // cũ ghi đè lượt mới hơn, chứ không phải bản thân request — nó rẻ và đã được cache.
    let cancelled = false;
    void resolveArea({ latitude, longitude }).then((area) => {
      if (!cancelled && area) setNearbyLabel(areaScopeLabel(area));
    });
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  /**
   * Nhãn cho ô khu vực. Chế độ toạ độ ưu tiên tên vừa dò được; ngoài ra luôn là nhãn
   * của server.
   *
   * Điều kiện `hasCoords` không thừa: khách bấm "Tìm quanh tôi" rồi chọn tay một quận
   * khác sẽ rời chế độ toạ độ, và nếu nhãn dò được vẫn còn thì ô hiện tên quận họ đang
   * đứng trong khi kết quả là của quận họ vừa chọn — sai một cách rất khó nhận ra, vì
   * cả hai đều là tên quận thật.
   */
  const areaBoxLabel = hasCoords && nearbyLabel ? nearbyLabel : areaLabel;

  function apply(next: URLSearchParams) {
    startTransition(() => router.push(`/tim-kiem?${next.toString()}`));
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);

    // Đổi bộ lọc thì quay về trang 1: giữ nguyên page cũ sẽ cho ra trang trống khi
    // bộ lọc mới có ít kết quả hơn.
    next.delete('page');
    apply(next);
  }

  /**
   * Đổi cách nhìn, không đổi tập kết quả — nên cố ý không dùng `setParam`: hàm đó
   * xoá `page`, mà chuyển từ danh sách sang bản đồ thì phải thấy đúng những KTV
   * vừa nãy còn ở trên màn hình.
   */
  function setView(view: 'list' | 'map') {
    const next = new URLSearchParams(params.toString());
    if (view === 'map') next.set('view', 'map');
    else next.delete('view');
    apply(next);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ định vị.');
      return;
    }

    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Toạ độ và khu vực là hai chế độ khác nhau, giữ cả hai sẽ lọc chồng lên
        // nhau và ra kết quả rỗng khó hiểu — applyCoords lo việc xoá cặp
        // areaSlug/provinceSlug, kể cả vế tỉnh mà bản cũ để sót lại.
        //
        // Chỉ ghi toạ độ vào URL rồi thôi: tên khu vực do effect ở trên dò, theo dõi
        // chính toạ độ trong URL. Gọi thẳng ở đây cũng chạy, nhưng chỉ đúng cho một
        // trong ba lối vào — hai lối kia (đến từ trang chủ, mở lại link đã lưu) không
        // đi qua hàm này và sẽ có ô khu vực trống.
        setLocating(false);
        apply(applyCoords(params, pos.coords));
      },
      () => {
        setLocating(false);
        setGeoError('Chưa lấy được vị trí. Bạn có thể chọn quận/huyện bên dưới.');
      },
      { timeout: 10_000 },
    );
  }

  const isMap = params.get('view') === 'map';
  const onlineOnly = params.get('isOnline') === 'true';

  // Ô chọn dùng chung một kiểu: viền mảnh, bo 999px, nền trắng. Gom vào hằng thay
  // vì lặp bốn lần — bốn bản sao sẽ trôi khỏi nhau ngay lần chỉnh đầu tiên.
  const selectClass =
    'mt-1 rounded-full border border-ink-300 bg-white px-3.5 py-2 text-ink-700 transition ' +
    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3 shadow-card sm:p-4">
      {/*
        Mobile xếp dọc và cuộn ngang hàng chip; desktop vẫn là một hàng wrap như cũ.
        Ở 390px, để nguyên bố cục wrap thì khối lọc chiếm trọn màn hình đầu tiên và
        đẩy hết kết quả xuống dưới — tức là giấu mất chính thứ khách vào để xem.
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="order-2 sm:order-none">
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating || pending}
            className="w-full whitespace-nowrap rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-button transition hover:bg-brand-600 disabled:opacity-60 sm:w-auto"
          >
            {locating ? 'Đang định vị…' : 'Tìm quanh tôi'}
          </button>
        </div>

        <label className="order-1 text-sm sm:order-none">
          <span className="block text-ink-600">Khu vực</span>
          <div className="mt-1 w-full sm:w-64">
            <AreaSearchBox
              initialLabel={areaBoxLabel}
              placeholder="Nhập quận, huyện hoặc phường…"
              onSelect={(s) => apply(applyAreaScope(params, s))}
              onClear={() => apply(clearAreaScope(params))}
              inputClassName={
                'w-full rounded-full border border-ink-300 bg-white px-3.5 py-2 pr-9 text-ink-700 ' +
                'transition placeholder:text-ink-400 focus:border-brand-500 focus:outline-none ' +
                'focus:ring-2 focus:ring-brand-500/20'
              }
            />
          </div>
        </label>

        <label className="order-3 text-sm sm:order-none">
          <span className="block text-ink-600">Dịch vụ</span>
          <select
            className={selectClass}
            value={params.get('service') ?? ''}
            onChange={(e) => setParam('service', e.target.value)}
          >
            <option value="">Tất cả</option>
            {services.map((s) => (
              <option key={s.id} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        {hasCoords && (
          <label className="order-4 text-sm sm:order-none">
            <span className="block text-ink-600">Bán kính</span>
            <select
              className={selectClass}
              value={params.get('radiusKm') ?? '10'}
              onChange={(e) => setParam('radiusKm', e.target.value)}
            >
              {[3, 5, 10, 20, 30].map((km) => (
                <option key={km} value={km}>
                  {km}km
                </option>
              ))}
            </select>
          </label>
        )}

        {/*
          Ba chip gộp một hàng cuộn ngang ở mobile — đúng hình dạng artboard. Cuộn
          ngang thay vì wrap: wrap ba chip ở 390px thành hai dòng và đẩy kết quả
          xuống thêm một tầng nữa.
        */}
        <div className="order-5 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:order-none sm:mx-0 sm:contents sm:overflow-visible sm:px-0">
        {/*
          Bật/tắt được, khác với ba ô chọn phía trên. Trạng thái bật dùng nền
          success nhạt — cùng ngôn ngữ với chip "Đang nhận khách" trên thẻ, để
          khách nối được bộ lọc với thứ nó lọc ra.
        */}
        <button
          type="button"
          aria-pressed={onlineOnly}
          onClick={() => setParam('isOnline', onlineOnly ? '' : 'true')}
          className={`shrink-0 self-end rounded-full border px-3.5 py-2 text-sm font-medium transition ${
            onlineOnly
              ? 'border-success-bd bg-success-bg text-success-fg'
              : 'border-ink-300 bg-white text-ink-700 hover:bg-ink-50'
          }`}
        >
          <span aria-hidden className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
          Đang nhận khách
        </button>

        {/*
          Nhãn tĩnh, KHÔNG phải nút bật/tắt: `/search` luôn lọc
          `verification_status = 'VERIFIED'`, nên đây là điều luôn đúng chứ không
          phải lựa chọn. Làm thành nút tắt được sẽ hứa một hành vi backend không
          có, và tắt đi cũng chẳng đổi gì — kiểu nút tệ nhất.
        */}
        <span className="inline-flex shrink-0 items-center gap-1.5 self-end whitespace-nowrap rounded-full border border-success-bd bg-success-bg px-3.5 py-2 text-sm font-medium text-success-fg">
          <CertifiedIcon size={16} className="h-3.5 w-3.5 shrink-0" />
          Chỉ hồ sơ đã duyệt
        </span>

        <div
          role="group"
          aria-label="Cách hiển thị kết quả"
          className="flex shrink-0 self-end rounded-full border border-ink-300 bg-white p-[3px] text-sm sm:ml-auto"
        >
          {/*
            Trạng thái chọn dùng nền brand đặc, không phải viền hay chữ đậm: hai
            nút này đổi cả cách đọc trang, nên trạng thái hiện tại phải thấy được
            từ xa mà không cần so sánh hai nút với nhau.
          */}
          <button
            type="button"
            aria-pressed={!isMap}
            onClick={() => setView('list')}
            className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
              isMap ? 'text-ink-600 hover:bg-ink-100' : 'bg-brand-500 text-white'
            }`}
          >
            Danh sách
          </button>
          <button
            type="button"
            aria-pressed={isMap}
            onClick={() => setView('map')}
            className={`rounded-full px-3.5 py-1.5 font-semibold transition ${
              isMap ? 'bg-brand-500 text-white' : 'text-ink-600 hover:bg-ink-100'
            }`}
          >
            Bản đồ
          </button>
        </div>
        </div>
      </div>

      {geoError && (
        <p role="alert" className="mt-3 text-sm text-warning-fg">
          {geoError}
        </p>
      )}
    </div>
  );
}
