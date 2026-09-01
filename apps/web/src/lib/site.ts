export const SITE_NAME = 'Massage tại nhà';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export const absolute = (path: string) => `${SITE_URL}${path}`;

export const areaPath = (province: string, district?: string | null) =>
  district ? `/massage-tai-nha/${province}/${district}` : `/massage-tai-nha/${province}`;

export const ktvPath = (slug: string, id: string) => `/ktv/${slug}-${id}`;

/**
 * Tách id ra khỏi đoạn cuối URL <c>/ktv/{slug}-{id}</c>.
 *
 * Slug chứa dấu gạch ngang nên phải cắt từ phải sang theo đúng độ dài UUID; tách
 * theo dấu gạch đầu tiên sẽ hỏng với mọi KTV có tên nhiều hơn một chữ.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseKtvSlugId(param: string): { slug: string; id: string } | null {
  if (param.length < 37) return null;
  const id = param.slice(-36);
  const slug = param.slice(0, -37);
  return UUID.test(id) && slug.length > 0 ? { slug, id } : null;
}

export const formatVnd = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    .format(value);

export const formatDistance = (meters: number | null) => {
  if (meters === null) return null;
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
};
