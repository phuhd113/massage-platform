'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { AreaNode, ServiceItem } from '@/lib/types';

/**
 * Bộ lọc là phần tương tác duy nhất của trang tìm kiếm, tách riêng thành client
 * component nhỏ. Danh sách kết quả vẫn render ở server để có mặt trong HTML đầu.
 */
export function SearchFilters({
  areas,
  services,
}: {
  areas: AreaNode[];
  services: ServiceItem[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

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
        const next = new URLSearchParams(params.toString());
        next.set('lat', pos.coords.latitude.toFixed(6));
        next.set('lon', pos.coords.longitude.toFixed(6));
        // Toạ độ và khu vực là hai chế độ khác nhau, giữ cả hai sẽ lọc chồng lên
        // nhau và ra kết quả rỗng khó hiểu.
        next.delete('areaSlug');
        next.delete('page');
        setLocating(false);
        apply(next);
      },
      () => {
        setLocating(false);
        setGeoError('Chưa lấy được vị trí. Bạn có thể chọn quận/huyện bên dưới.');
      },
      { timeout: 10_000 },
    );
  }

  const districts = areas.flatMap((p) =>
    p.children.map((d) => ({ ...d, provinceName: p.name })),
  );

  const isMap = params.get('view') === 'map';
  const onlineOnly = params.get('isOnline') === 'true';

  // Ô chọn dùng chung một kiểu: viền mảnh, bo 999px, nền trắng. Gom vào hằng thay
  // vì lặp bốn lần — bốn bản sao sẽ trôi khỏi nhau ngay lần chỉnh đầu tiên.
  const selectClass =
    'mt-1 rounded-full border border-ink-300 bg-white px-3.5 py-2 text-ink-700 transition ' +
    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating || pending}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-button transition hover:bg-brand-600 disabled:opacity-60"
          >
            {locating ? 'Đang định vị…' : 'Tìm quanh tôi'}
          </button>
        </div>

        <label className="text-sm">
          <span className="block text-ink-600">Khu vực</span>
          <select
            className={selectClass}
            value={params.get('areaSlug') ?? ''}
            onChange={(e) => setParam('areaSlug', e.target.value)}
          >
            <option value="">Tất cả</option>
            {districts.map((d) => (
              <option key={d.id} value={d.slug}>
                {d.name} — {d.provinceName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
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

        {params.get('lat') && (
          <label className="text-sm">
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
          Bật/tắt được, khác với ba ô chọn phía trên. Trạng thái bật dùng nền
          success nhạt — cùng ngôn ngữ với chip "Đang nhận khách" trên thẻ, để
          khách nối được bộ lọc với thứ nó lọc ra.
        */}
        <button
          type="button"
          aria-pressed={onlineOnly}
          onClick={() => setParam('isOnline', onlineOnly ? '' : 'true')}
          className={`self-end rounded-full border px-3.5 py-2 text-sm font-medium transition ${
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
        <span className="inline-flex items-center gap-1.5 self-end rounded-full border border-success-bd bg-success-bg px-3.5 py-2 text-sm font-medium text-success-fg">
          <svg
            aria-hidden
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 12 2 2 4-4" />
            <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
          </svg>
          Chỉ hồ sơ đã duyệt
        </span>

        <div
          role="group"
          aria-label="Cách hiển thị kết quả"
          className="ml-auto flex self-end rounded-full border border-ink-300 bg-white p-[3px] text-sm"
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

      {geoError && (
        <p role="alert" className="mt-3 text-sm text-warning-fg">
          {geoError}
        </p>
      )}
    </div>
  );
}
