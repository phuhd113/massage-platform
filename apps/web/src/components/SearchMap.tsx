'use client';

import L from 'leaflet';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  TILE_ATTRIBUTION,
  TILE_MAX_ZOOM,
  TILE_URL,
  spreadCoincident,
  viewportToScope,
  type LatLon,
  type PinnedItem,
  type Scope,
} from '@/lib/map';
import { formatDistance, ktvPath } from '@/lib/site';
import type { SearchItem } from '@/lib/types';

interface Props {
  items: SearchItem[];
  /** Vị trí khách. Null ở chế độ tìm theo khu vực — không có toạ độ để làm gốc. */
  origin: LatLon | null;
  radiusKm: number | null;
  /** Gọi sau mỗi lần khách tự kéo/zoom, không gọi khi map tự dịch chuyển. */
  onUserMove: (scope: Scope) => void;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

/**
 * Ghim mang số thứ tự của kết quả trong danh sách.
 *
 * Thứ tự đó chính là thứ hạng — thứ KTV trả tiền để mua — nên nó là thông tin,
 * không phải trang trí: khách nhìn bản đồ vẫn đọc được cùng một thứ tự với danh
 * sách bên cạnh. KTV đang chạy gói được tô màu thương hiệu.
 */
function pinIcon(rank: number, boosted: boolean) {
  const tone = boosted
    ? 'bg-brand-600 ring-brand-200'
    : 'bg-stone-700 ring-stone-200';
  return L.divIcon({
    className: '',
    html:
      `<span class="flex h-7 w-7 items-center justify-center rounded-full ${tone} ` +
      `text-xs font-semibold text-white shadow ring-4">${rank}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function popupHtml(item: PinnedItem) {
  const distance = formatDistance(item.distanceM);
  const rating =
    item.ratingCount > 0
      ? `★ ${item.ratingAvg.toFixed(1)} · ${item.ratingCount} đánh giá`
      : 'Chưa có đánh giá';

  return (
    `<a class="block text-sm font-semibold text-stone-900 underline" href="${ktvPath(item.slug, item.id)}">` +
    `${escapeHtml(item.fullName)}</a>` +
    `<p class="mt-1 text-xs text-stone-600">${item.yearsExperience} năm kinh nghiệm` +
    // Khoảng cách luôn lấy từ server (tính trên toạ độ thật), không tính lại từ
    // toạ độ ghim đã làm tròn và đã bị rải.
    `${distance ? ` · cách bạn ${distance}` : ''}</p>` +
    `<p class="mt-0.5 text-xs text-stone-600">${rating}</p>` +
    (item.boostPoints > 0
      ? '<p class="mt-1 text-xs font-medium text-brand-700">Tin được đẩy</p>'
      : '')
  );
}

export default function SearchMap({ items, origin, radiusKm, onUserMove }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  /**
   * Chặn moveend do chính code sinh ra khỏi bị hiểu là khách kéo bản đồ.
   *
   * Khởi tạo false chứ không true: khi không có ghim nào và không có toạ độ gốc
   * thì effect vẽ không gọi fitBounds, nên cờ true sẽ không ai tiêu thụ và nuốt
   * mất đúng cú kéo đầu tiên của khách — cũng là lúc họ cần nút "Tìm ở khu vực
   * này" nhất, vì màn hình đang trống.
   */
  const programmaticRef = useRef(false);
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;

  // Khởi tạo đúng một lần. Dựng lại map mỗi khi kết quả đổi sẽ nhấp nháy và mất
  // luôn khung nhìn khách vừa kéo tới.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [10.7769, 106.7009],
      zoom: 12,
      // Cuộn trang mà con trỏ vô tình nằm trên bản đồ sẽ zoom bản đồ thay vì cuộn
      // trang. Bật lại sau cú bấm đầu tiên, tức là khi khách thật sự muốn dùng map.
      scrollWheelZoom: false,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: TILE_MAX_ZOOM }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);

    // Bật/tắt bằng sự kiện DOM của chính container: Leaflet cũng bắn "mouseout"
    // khi con trỏ đi từ nền bản đồ sang một ghim, còn "mouseleave" thì không —
    // dùng nhầm sẽ tắt scroll zoom ngay giữa lúc khách đang dùng.
    const enableZoom = () => map.scrollWheelZoom.enable();
    const disableZoom = () => map.scrollWheelZoom.disable();
    const el = containerRef.current;
    el.addEventListener('click', enableZoom);
    el.addEventListener('mouseleave', disableZoom);

    map.on('moveend', () => {
      if (programmaticRef.current) {
        programmaticRef.current = false;
        return;
      }
      const center = map.getCenter();
      const ne = map.getBounds().getNorthEast();
      onUserMoveRef.current(
        viewportToScope({ lat: center.lat, lon: center.lng }, { lat: ne.lat, lon: ne.lng }),
      );
    });

    mapRef.current = map;

    return () => {
      el.removeEventListener('click', enableZoom);
      el.removeEventListener('mouseleave', disableZoom);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Vẽ lại ghim mỗi khi tập kết quả đổi.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pinned = spreadCoincident(items);
    const points: L.LatLngExpression[] = [];

    pinned.forEach((item, i) => {
      L.marker([item.pinLat, item.pinLon], {
        icon: pinIcon(i + 1, item.boostPoints > 0),
        title: item.fullName,
        alt: item.fullName,
      })
        .bindPopup(popupHtml(item))
        .addTo(layer);
      points.push([item.pinLat, item.pinLon]);
    });

    if (origin) {
      L.circleMarker([origin.lat, origin.lon], {
        radius: 6,
        color: '#0f6b5f',
        fillColor: '#0f6b5f',
        fillOpacity: 1,
        weight: 2,
      })
        .bindPopup('<p class="text-xs font-medium text-stone-900">Vị trí của bạn</p>')
        .addTo(layer);

      if (radiusKm) {
        const circle = L.circle([origin.lat, origin.lon], {
          radius: radiusKm * 1000,
          color: '#0f6b5f',
          weight: 1,
          fillOpacity: 0.06,
        }).addTo(layer);
        // Khung nhìn bám vòng bán kính chứ không bám tập ghim: khách cần thấy mình
        // đã quét tới đâu, kể cả khi cả vùng chỉ có một KTV ở sát bên.
        programmaticRef.current = true;
        map.fitBounds(circle.getBounds(), { padding: [24, 24], animate });
        return;
      }
    }

    if (points.length > 0) {
      programmaticRef.current = true;
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15, animate });
    }
  }, [items, origin, radiusKm]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Bản đồ vị trí kỹ thuật viên"
      className="h-full w-full rounded-lg"
    />
  );
}
