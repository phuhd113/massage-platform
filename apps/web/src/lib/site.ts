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

/**
 * Tiền viết gọn cho chỗ hẹp (nhãn trong sidebar): 1.250.000 → "1.250k".
 *
 * Chỉ dùng khi cạnh nó đã có con số đầy đủ ở nơi khác — bản rút gọn làm mất phần
 * lẻ, nên không bao giờ được là con số duy nhất KTV nhìn thấy về số dư của mình.
 */
export const formatVndShort = (value: number) => {
  if (value < 1000) return `${value}₫`;
  return `${new Intl.NumberFormat('vi-VN').format(Math.floor(value / 1000))}k`;
};

/**
 * Múi giờ của sàn. Mọi mốc thời gian hiển thị đều ghim về đây.
 *
 * **Bắt buộc khai tường minh**: trang render ở server (UTC trong container) rồi hydrate
 * lại ở trình duyệt (giờ máy khách). Để mặc định thì hai bên cho ra hai chuỗi khác nhau
 * — React báo hydration mismatch, và tệ hơn là khách ở múi giờ khác đọc sai ngày hết
 * hạn chiến dịch. Backend cũng cắt khung ngày chiến dịch theo đúng múi giờ này.
 */
const TZ = 'Asia/Ho_Chi_Minh';

/** Ngày theo giờ Việt Nam: 09/09/2026. */
export const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('vi-VN', { timeZone: TZ });

/** Ngày và giờ theo giờ Việt Nam. */
export const formatDateTime = (value: string | Date) =>
  new Date(value).toLocaleString('vi-VN', { timeZone: TZ });

export const formatDistance = (meters: number | null) => {
  if (meters === null) return null;
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
};
