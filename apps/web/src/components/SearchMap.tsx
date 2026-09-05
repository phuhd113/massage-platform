'use client';

import L from 'leaflet';
import { useEffect, useRef, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import {
  TILE_ATTRIBUTION,
  TILE_MAX_ZOOM,
  TILE_URL,
  clusterByPixel,
  haversineKm,
  pinLabel,
  spreadCoincident,
  viewportToScope,
  type Cluster,
  type LatLon,
  type PinnedItem,
  type Scope,
} from '@/lib/map';
import { showsVipFrame, tierBadgeLabel, tierFromBoost } from '@/lib/promotion-tier';
import { type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';
import { createTranslator, type Translator } from '@/i18n/t';
import { formatDistance, formatRating, ktvPath } from '@/lib/site';
import type { SearchItem } from '@/lib/types';

/**
 * `brand-500` dạng hex. Leaflet vẽ SVG bằng option JS nên không nhận lớp Tailwind
 * — đây là chỗ duy nhất trong ứng dụng buộc phải lặp lại giá trị màu, nên giữ nó
 * thành một hằng có tên thay vì rải hex khắp các lời gọi. Đổi bảng màu thương hiệu
 * thì sửa cả ở đây.
 */
const BRAND_500 = '#0e5aa7';

interface Props {
  items: SearchItem[];
  /** Vị trí khách. Null ở chế độ tìm theo khu vực — không có toạ độ để làm gốc. */
  origin: LatLon | null;
  radiusKm: number | null;
  /**
   * Gọi sau **mọi** lần khung nhìn đổi, kèm cờ cho biết có phải do khách tự kéo
   * hay không — dịch chuyển do code (fitBounds, bấm vào cụm) vẫn báo, để phần
   * mô tả khung nhìn không bị đứng lại ở trạng thái cũ.
   */
  onUserMove: (scope: Scope, userInitiated: boolean) => void;
  /** Id KTV đang được trỏ ở danh sách bên cạnh — ghim tương ứng được nâng lên. */
  activeId: string | null;
  /** Báo ngược cho panel biết khách đang trỏ vào ghim nào. */
  onHoverItem: (id: string | null) => void;
  locale: Locale;
}

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

/**
 * Ghim dạng "pill" mang tên KTV, giống bản đồ tin đăng của các sàn rao vặt.
 *
 * Vì sao pill chứ không phải chấm tròn đánh số: chấm số buộc khách phải đối chiếu
 * qua lại với danh sách mới biết đó là ai. Pill trả lời ngay trên bản đồ, và đó
 * mới là lý do khách mở bản đồ.
 *
 * Hạng trả phí đổi cả **màu nền** pill chứ không chỉ thêm chip: trên nền bản đồ
 * nhiều chi tiết, một chip nhỏ chìm mất. Đây là thứ KTV trả tiền để mua, nên nó
 * phải nhìn ra được ở khoảng cách liếc mắt.
 */
function pinIcon(item: PinnedItem, active: boolean) {
  const tier = tierFromBoost(item.boostPoints);
  const vip = showsVipFrame(tier);

  const tone = vip
    ? 'bg-champagne-600 text-white ring-champagne-200'
    : tier
      ? 'bg-brand-600 text-white ring-brand-100'
      : 'bg-white text-ink-900 ring-ink-200';

  const label = escapeHtml(pinLabel(item.fullName));
  const badge = tier
    ? `<span class="ml-1 rounded-sm bg-white/25 px-1 text-[10px] font-bold leading-4">${vip ? 'VIP' : 'HOT'}</span>`
    : '';

  return L.divIcon({
    className: '',
    html:
      `<span class="pin-pill ${tone}${active ? ' pin-pill--active' : ''}">` +
      `<span class="max-w-[8.5rem] truncate">${label}</span>${badge}</span>`,
    // iconSize bỏ trống để Leaflet không ép khung cứng — pill co giãn theo độ dài
    // tên, ép cố định sẽ cắt mất chữ hoặc chừa khoảng trắng chắn ghim bên dưới.
    iconSize: undefined,
    iconAnchor: [0, 0],
    popupAnchor: [0, -18],
  });
}

/** Bong bóng "N tin" cho cụm nhiều ghim — bấm vào thì phóng to chứ không mở popup. */
function clusterIcon(count: number, boosted: boolean, label: string) {
  const tone = boosted ? 'bg-champagne-600 ring-champagne-200' : 'bg-brand-600 ring-brand-100';
  return L.divIcon({
    className: '',
    html:
      `<span class="flex h-11 w-11 items-center justify-center rounded-full ${tone} ` +
      `text-xs font-bold text-white shadow-lg ring-4">${label}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/**
 * Nội dung popup của Leaflet — chuỗi HTML, **không phải JSX**.
 *
 * Vì vậy mọi chữ ở đây phải đi qua `t` một cách thủ công: không có công cụ kiểm
 * chuỗi nào dò được text nằm trong template literal đem gán vào innerHTML, nên đây
 * là chỗ dễ sót nhất khi thêm ngôn ngữ.
 */
function popupHtml(item: PinnedItem, locale: Locale, t: Translator) {
  const distance = formatDistance(item.distanceM);
  const rating =
    item.ratingCount > 0
      ? t('map.popupRating', {
          rating: formatRating(item.ratingAvg, locale),
          count: item.ratingCount,
        })
      : t('map.popupNoReviews');
  const tier = tierFromBoost(item.boostPoints);

  return (
    `<a class="block text-sm font-semibold text-ink-900 underline" href="${ktvPath(locale, item.slug, item.id)}">` +
    `${escapeHtml(item.fullName)}</a>` +
    `<p class="mt-1 text-xs text-ink-600">${escapeHtml(t('ktvProfile.experience', { count: item.yearsExperience }))}` +
    // Khoảng cách luôn lấy từ server (tính trên toạ độ thật), không tính lại từ
    // toạ độ ghim đã làm tròn và đã bị rải.
    `${distance ? ` · ${escapeHtml(t('map.distanceAway', { distance }))}` : ''}</p>` +
    `<p class="mt-0.5 text-xs text-ink-600">${escapeHtml(rating)}</p>` +
    (tier
      ? `<p class="mt-1 text-xs font-medium text-champagne-600">${escapeHtml(tierBadgeLabel(tier, t))}</p>`
      : '')
  );
}

export default function SearchMap({
  items,
  origin,
  radiusKm,
  onUserMove,
  activeId,
  onHoverItem,
  locale,
}: Props) {
  // useMemo chứ không gọi thẳng: `t` nằm trong dependency của effect vẽ ghim, và
  // một hàm mới mỗi render sẽ vẽ lại cả tầng bản đồ liên tục — đóng mất popup
  // khách đang mở và làm nháy toàn bộ ghim.
  const t = useMemo(() => createTranslator(getDictionary(locale), locale), [locale]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  /** Ghim đơn lẻ theo id, để đổi icon khi hover mà không vẽ lại cả tầng. */
  const markersRef = useRef(new Map<string, { marker: L.Marker; item: PinnedItem }>());
  const onUserMoveRef = useRef(onUserMove);
  onUserMoveRef.current = onUserMove;
  const onHoverItemRef = useRef(onHoverItem);
  onHoverItemRef.current = onHoverItem;
  /** Hàm vẽ lại, giữ trong ref để handler zoomend gọi được mà không cần re-bind. */
  const drawRef = useRef<() => void>(() => {});
  /** activeId mới nhất, đọc trong `draw` mà không phải đưa nó vào deps. */
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

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
      // Nút zoom mặc định nằm góc trên trái, đúng chỗ thanh công cụ nổi của bản đồ.
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
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

    /**
     * Phân biệt "khách tự kéo" với "code tự dịch" bằng chính thao tác đầu vào,
     * không bằng một cờ đặt trước mỗi lần gọi fitBounds.
     *
     * Cách cũ dùng một biến boolean bật lên trước mỗi lần dịch chuyển do code:
     * nó sai vì có tới bốn chỗ bật cờ, mà không phải lần nào Leaflet cũng bắn ra
     * đúng một `moveend` để tiêu thụ nó (fitBounds tới đúng khung nhìn hiện tại
     * thì không bắn gì cả). Một cờ treo lại sẽ nuốt mất cú kéo thật kế tiếp của
     * khách — đúng triệu chứng nút "Tìm ở khu vực này" không bao giờ hiện.
     *
     * `dragstart`/`zoomstart` do người dùng gây ra luôn đi trước `moveend` tương
     * ứng, nên đánh dấu ở đó rồi xoá khi tiêu thụ là quan hệ một-một thật sự.
     */
    let interacted = false;
    const markInteraction = () => {
      interacted = true;
    };
    map.on('dragstart', markInteraction);
    // `zoomstart` bắn cả khi code gọi setView/fitBounds, nên chỉ nhận zoom bằng
    // con lăn, bằng nút +/- và bằng thao tác chạm — tức là zoom do người dùng.
    map.on('wheel', markInteraction);
    const zoomBar = containerRef.current.querySelector('.leaflet-control-zoom');
    zoomBar?.addEventListener('click', markInteraction);

    map.on('moveend', () => {
      const center = map.getCenter();
      const ne = map.getBounds().getNorthEast();
      const scope = viewportToScope(
        { lat: center.lat, lon: center.lng },
        { lat: ne.lat, lon: ne.lng },
      );

      // Dịch chuyển do code vẫn phải báo ra ngoài (kèm cờ false) chứ không nuốt:
      // nuốt hẳn thì dòng mô tả khung nhìn đứng lại ở trạng thái cũ, ví dụ cảnh
      // báo "rộng hơn bán kính tối đa" còn nguyên sau khi đã phóng sát vào hẻm.
      const userInitiated = interacted;
      interacted = false;
      onUserMoveRef.current(scope, userInitiated);
    });

    // Cụm được tính theo pixel ở mức zoom hiện tại, nên phải vẽ lại mỗi lần zoom
    // đổi — nếu không, phóng to mãi vẫn thấy "25 tin" mà không bao giờ tách ra.
    map.on('zoomend', () => drawRef.current());

    // Leaflet nhớ kích thước container lúc khởi tạo và không tự phát hiện khi nó
    // đổi. Vào/ra chế độ toàn màn hình là đúng trường hợp đó: khung phình ra
    // nhưng bản đồ vẫn vẽ theo kích thước cũ, để lại mảng xám ở phần dôi ra.
    // Đổi kích thước khung (vào/ra toàn màn hình, xoay máy) không đi kèm dragstart
    // hay wheel nào, nên moveend sinh ra từ đây tự khắc mang userInitiated = false.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(el);

    mapRef.current = map;
    // Giữ chính Map object lại cho cleanup thay vì đọc `markersRef.current` lúc
    // unmount: ref có thể đã trỏ sang Map khác vào thời điểm đó.
    const markers = markersRef.current;

    return () => {
      resize.disconnect();
      zoomBar?.removeEventListener('click', markInteraction);
      el.removeEventListener('click', enableZoom);
      el.removeEventListener('mouseleave', disableZoom);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markers.clear();
    };
  }, []);

  // Vẽ lại ghim mỗi khi tập kết quả đổi.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pinned = spreadCoincident(items);

    const draw = () => {
      layer.clearLayers();
      markersRef.current.clear();

      const clusters: Cluster[] = clusterByPixel(pinned, map.getZoom());

      for (const cluster of clusters) {
        if (cluster.items.length > 1) {
          const boosted = cluster.items.some((i) => i.boostPoints > 0);
          L.marker([cluster.lat, cluster.lon], {
            icon: clusterIcon(
              cluster.items.length,
              boosted,
              escapeHtml(t('map.clusterCount', { count: cluster.items.length })),
            ),
            title: `${cluster.items.length} kỹ thuật viên ở khu vực này`,
            alt: `${cluster.items.length} kỹ thuật viên`,
            // Cụm nằm TRÊN pill đơn lẻ khi chồng nhau. Ban đầu làm ngược lại với
            // lý do "pill mới là thứ bấm để tới hồ sơ", nhưng thực tế một pill che
            // mất bong bóng đại diện cho cả chục KTV: khách không còn đường nào để
            // mở nhóm đó ra, trong khi pill bị che vẫn luôn lấy lại được bằng cách
            // phóng to. Che nhiều bằng ít là mất mát lớn hơn.
            zIndexOffset: 1000,
          })
            .on('click', () => {
              // Phóng vào chính cụm thay vì tăng một mức zoom cố định: cụm dày đặc
              // cần nhiều mức mới tách ra, tăng từng nấc bắt khách bấm nhiều lần.
              const bounds = L.latLngBounds(
                cluster.items.map((i) => [i.pinLat, i.pinLon] as [number, number]),
              );
              // Cả cụm nằm gần như trùng điểm (toạ độ công khai làm tròn ~100m) thì
              // bounds gần bằng 0 và fitBounds nhảy thẳng lên zoom tối đa mà cụm vẫn
              // không tách. Trường hợp đó phóng từng bước quanh tâm và để chính khách
              // dừng lại ở mức họ thấy đủ, thay vì ném họ tới đáy thang zoom.
              const tiny =
                haversineKm(
                  { lat: bounds.getSouth(), lon: bounds.getWest() },
                  { lat: bounds.getNorth(), lon: bounds.getEast() },
                ) < 0.05;

              if (tiny) {
                map.setView([cluster.lat, cluster.lon], Math.min(map.getZoom() + 3, TILE_MAX_ZOOM), {
                  animate,
                });
              } else {
                map.fitBounds(bounds, { padding: [60, 60], maxZoom: TILE_MAX_ZOOM, animate });
              }
            })
            .addTo(layer);
          continue;
        }

        const item = cluster.items[0];
        const marker = L.marker([item.pinLat, item.pinLon], {
          icon: pinIcon(item, item.id === activeIdRef.current),
          title: item.fullName,
          alt: item.fullName,
          // KTV trả phí nổi lên trên khi pill chồng nhau — cùng thứ tự ưu tiên với
          // danh sách. Dùng thẳng điểm boost làm offset nên thứ tự chồng lớp luôn
          // khớp thứ hạng, không cần bảng ánh xạ thứ hai để lệch nhau.
          zIndexOffset: item.boostPoints,
        })
          .bindPopup(popupHtml(item, locale, t))
          .on('mouseover', () => onHoverItemRef.current(item.id))
          .on('mouseout', () => onHoverItemRef.current(null))
          .addTo(layer);

        markersRef.current.set(item.id, { marker, item });
      }

      if (origin) {
        L.circleMarker([origin.lat, origin.lon], {
          radius: 6,
          color: BRAND_500,
          fillColor: BRAND_500,
          fillOpacity: 1,
          weight: 2,
        })
          .bindPopup(
            `<p class="text-xs font-medium text-ink-900">${escapeHtml(t('map.yourLocation'))}</p>`,
          )
          .addTo(layer);

        if (radiusKm) {
          L.circle([origin.lat, origin.lon], {
            radius: radiusKm * 1000,
            color: BRAND_500,
            weight: 1,
            fillOpacity: 0.06,
          }).addTo(layer);
        }
      }
    };

    drawRef.current = draw;
    draw();

    // Khung nhìn chỉ chỉnh khi tập kết quả đổi, cố ý không nằm trong `draw`:
    // `draw` còn chạy ở mỗi zoomend, tự fit lại ở đó thì khách không zoom được.
    if (origin && radiusKm) {
      // Khung nhìn bám vòng bán kính chứ không bám tập ghim: khách cần thấy mình
      // đã quét tới đâu, kể cả khi cả vùng chỉ có một KTV ở sát bên.
      //
      // Bounds tính bằng toLatLngBounds chứ KHÔNG bằng `L.circle(...).getBounds()`:
      // getBounds của circle cần vòng tròn đã được gắn vào map để chiếu toạ độ,
      // gọi trên một vòng rời sẽ ném "Cannot read properties of undefined
      // (reading 'layerPointToLatLng')" và làm hỏng cả bản đồ.
      map.fitBounds(L.latLng(origin.lat, origin.lon).toBounds(radiusKm * 2000), {
        padding: [24, 24],
        animate,
      });
    } else if (pinned.length > 0) {
      map.fitBounds(L.latLngBounds(pinned.map((i) => [i.pinLat, i.pinLon] as [number, number])), {
        padding: [40, 40],
        maxZoom: 15,
        animate,
      });
    }
  }, [items, origin, radiusKm, locale, t]);

  // Đồng bộ hover từ danh sách sang bản đồ: chỉ đổi icon của ghim liên quan, vẽ
  // lại cả tầng sẽ đóng mất popup khách đang mở.
  useEffect(() => {
    for (const [id, { marker, item }] of markersRef.current) {
      marker.setIcon(pinIcon(item, id === activeId));
    }
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={t('map.mapLabel')}
      className="h-full w-full"
    />
  );
}
