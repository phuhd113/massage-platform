import type { SearchItem } from '@/lib/types';

/**
 * Nguồn tile bản đồ.
 *
 * OSM chuẩn: không cần khoá, không cần thẻ tín dụng, chạy được ngay. Nhưng Tile
 * Usage Policy của OSM **không dành cho ứng dụng thương mại lưu lượng cao** — đây
 * là lựa chọn để làm và đo, phải đổi sang nhà cung cấp có hợp đồng (MapTiler,
 * Carto…) trước khi có traffic thật. Giữ ở một chỗ để lúc đó chỉ sửa hai dòng.
 */
export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const TILE_MAX_ZOOM = 19;

/** Backend chỉ nhận bán kính 1–50km (SearchQueryDtoValidator). */
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 50;

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Scope extends LatLon {
  radiusKm: number;
  /** True khi khung nhìn rộng hơn 50km — vùng tìm nhỏ hơn thứ khách đang thấy. */
  clamped: boolean;
}

/**
 * Quy khung nhìn chữ nhật của bản đồ về đúng thứ API nhận: tâm + bán kính tròn.
 *
 * Lấy khoảng cách tới góc để hình tròn **bao trọn** khung nhìn — lấy tới cạnh thì
 * bốn góc bản đồ nằm ngoài vùng tìm và khách thấy một mảng trống không giải thích
 * được. Đổi lại, vùng tìm hơi rộng hơn khung nhìn, tức thừa chứ không thiếu.
 */
export function viewportToScope(center: LatLon, northEast: LatLon): Scope {
  const raw = Math.ceil(haversineKm(center, northEast));
  const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, raw));
  return {
    lat: center.lat,
    lon: center.lon,
    radiusKm,
    clamped: raw > MAX_RADIUS_KM,
  };
}

/** Bán kính vòng rải ghim trùng, tính bằng mét. Nhỏ hơn ô làm tròn 100m. */
const SPREAD_RADIUS_M = 40;
const METERS_PER_DEG_LAT = 111_320;

export type PinnedItem = SearchItem & { pinLat: number; pinLon: number };

/**
 * Rải các ghim rơi trùng nhau ra một vòng nhỏ.
 *
 * Toạ độ công khai được làm tròn 3 chữ số (~100m) ở tầng SQL để không lần ra được
 * nhà KTV — đó là quyết định của Phase 1, không nới. Hệ quả là mọi KTV trong cùng
 * một ô 100m rơi đúng một pixel và chỉ bấm được vào cái trên cùng.
 *
 * Việc rải này **thuần trình bày**: khoảng cách hiển thị vẫn là `distanceM` do
 * server tính từ toạ độ thật, không bao giờ tính lại từ toạ độ ghim.
 *
 * Góc suy ra từ thứ tự đã sắp theo id nên cùng một tập kết quả luôn cho cùng một
 * bố cục — ghim không nhảy chỗ mỗi lần React render lại.
 */
export function spreadCoincident(items: readonly SearchItem[]): PinnedItem[] {
  const groups = new Map<string, SearchItem[]>();
  for (const item of items) {
    const key = `${item.lat},${item.lon}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const placed = new Map<string, { pinLat: number; pinLon: number }>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      const only = group[0];
      placed.set(only.id, { pinLat: only.lat, pinLon: only.lon });
      continue;
    }

    const ordered = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos(rad(ordered[0].lat));
    ordered.forEach((item, i) => {
      const angle = (2 * Math.PI * i) / ordered.length;
      placed.set(item.id, {
        pinLat: item.lat + (SPREAD_RADIUS_M * Math.sin(angle)) / METERS_PER_DEG_LAT,
        // Gần hai cực cos tiến về 0 và phép chia nổ tung; ở Việt Nam không xảy ra
        // nhưng dữ liệu test dùng toạ độ ngẫu nhiên toàn cầu.
        pinLon:
          metersPerDegLon < 1
            ? item.lon
            : item.lon + (SPREAD_RADIUS_M * Math.cos(angle)) / metersPerDegLon,
      });
    });
  }

  return items.map((item) => ({ ...item, ...placed.get(item.id)! }));
}
