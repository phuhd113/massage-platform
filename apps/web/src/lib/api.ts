import type {
  AreaDetail,
  AreaNode,
  KtvCommitments,
  PublicKtvProfile,
  ReviewList,
  SearchResponse,
  ServiceItem,
  SiteStats,
  Sitemap,
} from './types';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:5080/api/v1';

/** Trang khu vực: đủ mới để KTV mới duyệt xuất hiện sớm, đủ lâu để không tra DB mỗi request. */
export const AREA_REVALIDATE = 300;
/** Hồ sơ đổi ít hơn danh sách khu vực. */
export const PROFILE_REVALIDATE = 600;

class NotFoundError extends Error {}

async function get<T>(path: string, revalidate: number): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate },
    headers: { Accept: 'application/json' },
  });

  if (res.status === 404) throw new NotFoundError(path);
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);

  return (await res.json()) as T;
}

/**
 * Trả null khi API báo 404 để trang gọi `notFound()`, và **ném lỗi** với mọi mã
 * lỗi khác.
 *
 * Phân biệt hai trường hợp này là bắt buộc: nuốt cả lỗi 500 thành 404 sẽ khiến
 * Google nhận "trang không tồn tại" trong một sự cố tạm thời và gỡ trang khỏi
 * index — mất hạng đã tích luỹ, và phải chờ crawl lại mới lấy lại được.
 */
async function getOrNull<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    return await get<T>(path, revalidate);
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export const api = {
  areaTree: () => get<AreaNode[]>('/areas', AREA_REVALIDATE),

  province: (slug: string) =>
    getOrNull<AreaDetail>(`/areas/${encodeURIComponent(slug)}`, AREA_REVALIDATE),

  district: (province: string, district: string) =>
    getOrNull<AreaDetail>(
      `/areas/${encodeURIComponent(province)}/${encodeURIComponent(district)}`,
      AREA_REVALIDATE,
    ),

  services: () => get<ServiceItem[]>('/services', AREA_REVALIDATE),

  siteStats: () => get<SiteStats>('/public/stats', AREA_REVALIDATE),

  service: (slug: string) =>
    getOrNull<ServiceItem>(`/services/${encodeURIComponent(slug)}`, AREA_REVALIDATE),

  ktvBySlug: (slug: string) =>
    getOrNull<PublicKtvProfile>(`/ktv/by-slug/${encodeURIComponent(slug)}`, PROFILE_REVALIDATE),

  reviews: (ktvId: string) =>
    get<ReviewList>(`/ktv/${ktvId}/reviews?page=1&size=20`, PROFILE_REVALIDATE),

  search: (params: Record<string, string | number | undefined>, revalidate = AREA_REVALIDATE) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    return get<SearchResponse>(`/search?${qs.toString()}`, revalidate);
  },

  sitemap: () => get<Sitemap>('/public/sitemap', AREA_REVALIDATE),

  /**
   * Bản cam kết KTV đang có hiệu lực.
   *
   * Cache lâu vì nó gần như không đổi — nhưng **không** cache vĩnh viễn: khi nội dung
   * được cập nhật, một trang còn hiển thị bản cũ sẽ gửi lên số phiên bản cũ và bị
   * backend từ chối, tức KTV không cam kết được cho tới khi cache hết hạn.
   */
  ktvCommitments: () => get<KtvCommitments>('/ktv/commitments', AREA_REVALIDATE),
};
