import type { AreaSuggestion } from './types';

/**
 * Tra ngược toạ độ GPS ra quận/huyện gần nhất, để "Tìm quanh tôi" nói được khách đang
 * ở đâu thay vì để ô khu vực trống.
 *
 * Trả `null` khi không dò ra (ngoài lãnh thổ, GPS trôi, mạng hỏng) — đó là trạng thái
 * bình thường, không phải lỗi cần báo. Kết quả tìm kiếm **không** phụ thuộc vào giá
 * trị này: nó vẫn lọc theo toạ độ thật, còn đây chỉ là cái nhãn.
 *
 * Vì vậy nơi gọi phải hiển thị kết quả ngay khi có toạ độ, đừng chờ hàm này xong.
 */
export async function resolveArea(coords: {
  latitude: number;
  longitude: number;
}): Promise<AreaSuggestion | null> {
  try {
    const res = await fetch(
      `/api/areas/resolve?lat=${coords.latitude.toFixed(6)}&lon=${coords.longitude.toFixed(6)}`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    return (await res.json()) as AreaSuggestion | null;
  } catch {
    return null;
  }
}

/**
 * Chuyển một gợi ý khu vực thành cặp tham số mà `/search` hiểu.
 *
 * Backend quy định: `areaSlug` đứng một mình là slug **tỉnh**; là slug **quận** chỉ khi
 * đi kèm `provinceSlug`. Ô select cũ gửi thẳng slug quận mà không có vế tỉnh, nên chọn
 * một trong mười "Huyện Châu Thành" cho ra kết quả của tỉnh nào không ai biết trước.
 *
 * Phường quy về quận cha: phường không có trang riêng và không nằm trong
 * `coverage_areas`, nên tìm theo phường sẽ luôn ra rỗng. Gọi kèm {@link areaScopeLabel}
 * để nói cho khách biết kết quả đang hiển thị theo quận nào.
 */
export function areaScopeParams(s: AreaSuggestion): { areaSlug: string; provinceSlug?: string } {
  if (s.level === 'PROVINCE') return { areaSlug: s.slug };

  if (s.level === 'WARD') {
    // districtSlug/provinceSlug của phường do backend trả sẵn. Thiếu một trong hai là
    // dữ liệu hỏng chứ không phải trạng thái hợp lệ — rơi về tỉnh còn hơn dựng URL sai.
    if (s.districtSlug && s.provinceSlug) {
      return { areaSlug: s.districtSlug, provinceSlug: s.provinceSlug };
    }
    return s.provinceSlug ? { areaSlug: s.provinceSlug } : { areaSlug: s.slug };
  }

  return s.provinceSlug
    ? { areaSlug: s.slug, provinceSlug: s.provinceSlug }
    : { areaSlug: s.slug };
}

/** Nhãn hiển thị cho khu vực đang chọn, kèm vế cha để phân biệt các quận trùng tên. */
export function areaScopeLabel(s: AreaSuggestion): string {
  return s.parentPath ? `${s.name}, ${s.parentPath}` : s.name;
}

/**
 * Ghi phạm vi khu vực vào query, xoá sạch phần toạ độ.
 *
 * Toạ độ và khu vực là hai chế độ loại trừ nhau trong toàn app — giữ cả hai sẽ lọc
 * chồng lên nhau và ra kết quả rỗng khó hiểu.
 */
export function applyAreaScope(params: URLSearchParams, s: AreaSuggestion): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const { areaSlug, provinceSlug } = areaScopeParams(s);

  next.set('areaSlug', areaSlug);
  if (provinceSlug) next.set('provinceSlug', provinceSlug);
  else next.delete('provinceSlug');

  next.delete('lat');
  next.delete('lon');
  next.delete('radiusKm');
  next.delete('page');
  return next;
}

/**
 * Xoá phạm vi khu vực. `provinceSlug` phải đi cùng `areaSlug`: để lại nó một mình là
 * tham số mồ côi khiến backend từ chối cả request ("provinceSlug phải đi kèm areaSlug").
 */
export function clearAreaScope(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  next.delete('areaSlug');
  next.delete('provinceSlug');
  next.delete('page');
  return next;
}

/**
 * Ghi toạ độ vào query và xoá phạm vi khu vực (xem {@link applyAreaScope}).
 */
export function applyCoords(
  params: URLSearchParams,
  coords: { latitude: number; longitude: number },
): URLSearchParams {
  const next = clearAreaScope(params);
  next.set('lat', coords.latitude.toFixed(6));
  next.set('lon', coords.longitude.toFixed(6));
  return next;
}
