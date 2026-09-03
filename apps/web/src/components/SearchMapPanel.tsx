'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { clearAreaScope } from '@/lib/area-search';
import { MAX_RADIUS_KM, haversineKm, type LatLon, type Scope } from '@/lib/map';
import { MapKtvCard } from '@/components/MapKtvCard';
import type { SearchItem } from '@/lib/types';

/** Chiều cao cố định ở cả khung chờ lẫn bản đồ thật, để không sinh layout shift. */
const HEIGHT = 'h-[420px] lg:h-[560px]';

// Leaflet đụng `window` ngay lúc import nên không chạy được ở server. Bọc dynamic
// phải nằm trong client component: Next 14 không cho ssr:false trong Server Component.
const SearchMap = dynamic(() => import('@/components/SearchMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-skeleton bg-ink-100" />
  ),
});

interface Props {
  items: SearchItem[];
  origin: LatLon | null;
  radiusKm: number | null;
}

/**
 * Ngưỡng coi là "khách đã kéo đi chỗ khác".
 *
 * Không có ngưỡng thì một cú chạm lệch vài pixel cũng làm nút hiện ra rồi biến mất.
 *
 * `baseline` là khung nhìn mà bản đồ **tự dừng lại** sau lần fit đầu tiên, không
 * phải bán kính trong URL. Hai con số đó cố ý khác nhau: `viewportToScope` đo tới
 * góc khung nhìn để vùng tìm bao trọn màn hình, nên fit một vòng 10km luôn cho ra
 * scope ~14km. So với 10km thì lệch hơn 20% và nút "Tìm ở khu vực này" bật lên
 * ngay khi trang vừa tải, lúc khách còn chưa chạm vào bản đồ.
 */
function movedEnough(scope: Scope, baseline: Scope | null) {
  // Chưa có mốc nào nghĩa là bản đồ còn chưa kịp dừng lại lần đầu — chưa thể nói
  // khách đã đi đâu cả. Trả false chứ không phải true: mặc định "đã đi xa" làm nút
  // hiện ngay lúc trang vừa tải, khi khách còn chưa chạm vào bản đồ.
  if (!baseline) return false;
  const shifted = haversineKm(scope, baseline) > baseline.radiusKm * 0.15;
  const zoomed = Math.abs(scope.radiusKm - baseline.radiusKm) / baseline.radiusKm > 0.2;
  return shifted || zoomed;
}

export function SearchMapPanel({ items, origin, radiusKm }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  /** Khung nhìn hiện tại, cập nhật theo mọi thay đổi — dùng để mô tả trạng thái. */
  const [scope, setScope] = useState<Scope | null>(null);
  /**
   * Khung nhìn do **khách tự kéo** tới, tách riêng khỏi `scope`.
   *
   * Chỉ trạng thái này mới được bật nút "Tìm ở khu vực này": bản đồ tự phóng vào
   * một cụm không phải là khách yêu cầu tìm chỗ khác, mời họ tìm lại ở đó là mời
   * nhầm — và mỗi lần bấm là một lần tải lại toàn bộ kết quả.
   */
  const [userScope, setUserScope] = useState<Scope | null>(null);
  /**
   * Khung nhìn "gốc" để so xem khách đã đi đủ xa chưa.
   *
   * Đặt lại mỗi khi bản đồ tự dịch chuyển (fit lần đầu, bấm vào cụm): sau một cú
   * tự phóng, chỗ khách đang đứng mới là mốc, chứ không phải chỗ họ đứng trước đó.
   */
  const baselineRef = useRef<Scope | null>(null);

  const handleMove = useCallback((next: Scope, userInitiated: boolean) => {
    setScope(next);
    if (userInitiated) {
      setUserScope(next);
    } else {
      baselineRef.current = next;
      // Bản đồ vừa tự đi chỗ khác thì lời mời "tìm ở khu vực này" của khung nhìn
      // cũ không còn nghĩa gì nữa.
      setUserScope(null);
    }
  }, []);
  const [activeId, setActiveId] = useState<string | null>(null);
  /**
   * Toàn màn hình là **trạng thái client**, không phải một route riêng.
   *
   * Nếu làm bằng route thì HTML đầu tiên của trang đó không còn danh sách KTV
   * render ở server — mà đó chính là thứ Google đọc. Ở đây danh sách vẫn nằm
   * nguyên trong DOM, chỉ được CSS phủ lên trên.
   */
  const [fullscreen, setFullscreen] = useState(false);

  // Khoá cuộn nền khi bản đồ phủ toàn màn hình, và trả lại đúng giá trị cũ khi
  // đóng — gán cứng 'auto' sẽ ghi đè mất `overflow` do layout khác đặt.
  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  const searchHere = useCallback(
    (target: Scope | null) => {
      if (!target) return;
      // Toạ độ và khu vực là hai chế độ khác nhau — cùng quy tắc với "Tìm quanh tôi".
      // Dùng clearAreaScope thay vì tự `delete('areaSlug')`: phải xoá cả `provinceSlug`,
      // vì vế tỉnh còn lại một mình làm backend từ chối nguyên request bằng 400
      // ("provinceSlug phải đi kèm areaSlug") — bản đồ khi đó không trả về gì cả.
      const next = clearAreaScope(params);
      next.set('lat', target.lat.toFixed(6));
      next.set('lon', target.lon.toFixed(6));
      next.set('radiusKm', String(target.radiusKm));
      next.set('view', 'map');
      setUserScope(null);
      startTransition(() => router.push(`/tim-kiem?${next.toString()}`));
    },
    [params, router],
  );

  const showSearchHere = userScope !== null && movedEnough(userScope, baselineRef.current);
  // Bản đồ đang rộng hơn bán kính tối đa: khách thấy một vùng lớn hơn thứ sẽ được
  // quét, nên nói trước thay vì để họ tưởng vùng trống là không có KTV.
  const clamped = scope?.clamped ?? false;

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[1100] bg-white'
          : 'relative'
      }
    >
      <div
        className={
          fullscreen
            ? // Mobile: bản đồ chiếm phần trên, danh sách cuộn ở dưới. Từ lg: hai
              // cột. `grid-rows-1` phải đi kèm `grid-cols-*` ở lg, nếu không hàng
              // thứ hai của bố cục mobile còn nguyên và bản đồ chỉ cao một nửa.
              'grid h-full grid-rows-[minmax(0,1fr)_minmax(0,18rem)] lg:grid-cols-[minmax(0,1fr)_23rem] lg:grid-rows-[minmax(0,1fr)]'
            : ''
        }
      >
        <div
          className={
            fullscreen
              ? 'relative min-h-0'
              : `relative ${HEIGHT} overflow-hidden rounded-lg border border-ink-200`
          }
        >
          <SearchMap
            items={items}
            origin={origin}
            radiusKm={radiusKm}
            onUserMove={handleMove}
            activeId={activeId}
            onHoverItem={setActiveId}
          />

          {/* Thanh công cụ nổi. pointer-events-none ở lớp bọc để phần trống của
              thanh không nuốt mất thao tác kéo bản đồ bên dưới. */}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex items-start justify-between gap-2 px-3">
            {/* Ô đệm trái chỉ tồn tại từ sm: trên điện thoại nó ăn mất chiều rộng
                khiến hai nút bị bóp thành hình tròn và chồng lên nhau. */}
            <div className="hidden flex-1 sm:block" />

            {showSearchHere && (
              <button
                type="button"
                onClick={() => searchHere(userScope)}
                disabled={pending}
                className="pointer-events-auto inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-body-s font-semibold text-ink-900 shadow-card-hover ring-1 ring-ink-200 transition hover:bg-ink-50 disabled:opacity-60"
              >
                <MapIcon />
                {pending ? 'Đang tìm…' : 'Tìm KTV trên toàn bản đồ'}
              </button>
            )}

            <div className="flex flex-1 justify-end">
              <button
                type="button"
                onClick={() => setFullscreen((v) => !v)}
                aria-pressed={fullscreen}
                className={
                  fullscreen
                    ? 'pointer-events-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-500 px-4 py-2.5 text-body-s font-semibold text-white shadow-card-hover transition hover:bg-brand-600'
                    : 'pointer-events-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-body-s font-semibold text-ink-900 shadow-card-hover ring-1 ring-ink-200 transition hover:bg-ink-50'
                }
              >
                {fullscreen ? <CloseIcon /> : <ExpandIcon />}
                {fullscreen ? 'Đóng bản đồ' : 'Mở rộng'}
              </button>
            </div>
          </div>

          {/* Gợi ý ở đáy: bản đồ chỉ vẽ được trang kết quả hiện tại, nói rõ ra thì
              khách hiểu vì sao đếm ghim không khớp tổng số kết quả. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[1000] flex justify-center px-3">
            <p className="rounded-full bg-ink-900/80 px-4 py-2 text-caption text-white shadow-card">
              {clamped
                ? `Bản đồ rộng hơn bán kính tìm tối đa — chỉ quét trong ${MAX_RADIUS_KM}km quanh tâm.`
                : 'Phóng to bản đồ để xem thêm kỹ thuật viên khác'}
            </p>
          </div>
        </div>

        {/* Danh sách đi kèm chỉ tồn tại ở chế độ toàn màn hình; ở chế độ thường,
            trang đã render danh sách của chính nó bên cạnh (ở server). */}
        {fullscreen && (
          <aside className="min-h-0 overflow-y-auto border-t border-ink-200 bg-ink-25 p-3 lg:border-l lg:border-t-0">
            <p className="px-1 pb-2 text-body-s text-ink-500">{items.length} kỹ thuật viên</p>
            <ul className="grid gap-2">
              {items.map((ktv) => (
                <MapKtvCard
                  key={ktv.id}
                  ktv={ktv}
                  active={ktv.id === activeId}
                  onHover={setActiveId}
                />
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

function MapIcon() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
