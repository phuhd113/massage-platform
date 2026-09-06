import { INTL_LOCALE, type Locale, localePath } from '@/i18n/config';

/**
 * Tên thương hiệu, **giống nhau ở cả hai ngôn ngữ** và khớp với domain masgo.vn.
 *
 * Trước đây tên sàn chính là cụm từ khoá dịch vụ ("Massage tại nhà" / "Home Massage
 * Vietnam"), nên meta title đọc thành "Massage tận nơi Quận 7 | Massage tận nơi" —
 * lặp từ khoá mà không thêm thông tin, và không để lại cái tên nào cho khách nhớ khi
 * quay lại. Từ khoá đã nằm sẵn ở vế trái của title; vế phải giờ là thứ phân biệt sàn
 * này với sàn khác trong cùng một trang kết quả.
 */
export const SITE_NAME: Record<Locale, string> = {
  vi: 'MasGo',
  en: 'MasGo',
};

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://masgo.vn').replace(
  /\/$/,
  '',
);

export const absolute = (path: string) => `${SITE_URL}${path}`;

/**
 * Tiền tố của mọi URL trang khu vực, khai **đúng một lần** ở đây.
 *
 * Nó phải khớp đồng thời ở bốn nơi: đường dựng link của frontend, sitemap do backend
 * sinh, luật redirect 301 từ tiền tố cũ, và canonical/hreflang. Lệch một chỗ nghĩa là
 * canonical trỏ tới một URL đang redirect — Google bỏ qua cả cụm hreflang khi đó.
 */
export const AREA_PATH_PREFIX = '/massage-tan-noi';

/**
 * Slug trong URL **giữ nguyên tiếng Việt ở cả hai ngôn ngữ**
 * (/en/massage-tan-noi/tp-ho-chi-minh).
 *
 * Slug tiếng Anh riêng sẽ đòi một cột slug thứ hai cho 696 quận/huyện — tức một
 * nguồn lệch mới phải giữ khớp mãi mãi, đổi lấy vài từ khoá trong đường dẫn.
 */
export const areaPath = (locale: Locale, province: string, district?: string | null) =>
  localePath(
    locale,
    district ? `${AREA_PATH_PREFIX}/${province}/${district}` : `${AREA_PATH_PREFIX}/${province}`,
  );

export const ktvPath = (locale: Locale, slug: string, id: string) => localePath(locale, `/ktv/${slug}-${id}`);

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

/**
 * Tiền vẫn là VND ở cả hai ngôn ngữ — khách nước ngoài ở Việt Nam trả bằng VND.
 * Chỉ cách nhóm chữ số và vị trí ký hiệu đổi theo ngôn ngữ.
 */
export const formatVnd = (value: number, locale: Locale) =>
  new Intl.NumberFormat(INTL_LOCALE[locale], { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })
    .format(value);

/**
 * Tiền viết gọn cho chỗ hẹp (nhãn trong sidebar): 1.250.000 → "1.250k".
 *
 * Chỉ dùng khi cạnh nó đã có con số đầy đủ ở nơi khác — bản rút gọn làm mất phần
 * lẻ, nên không bao giờ được là con số duy nhất KTV nhìn thấy về số dư của mình.
 */
export const formatVndShort = (value: number, locale: Locale) => {
  if (value < 1000) return `${value}₫`;
  return `${new Intl.NumberFormat(INTL_LOCALE[locale]).format(Math.floor(value / 1000))}k`;
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
export const formatDate = (value: string | Date, locale: Locale) =>
  new Date(value).toLocaleDateString(INTL_LOCALE[locale], { timeZone: TZ });

/** Ngày và giờ theo giờ Việt Nam. */
export const formatDateTime = (value: string | Date, locale: Locale) =>
  new Date(value).toLocaleString(INTL_LOCALE[locale], { timeZone: TZ });

/**
 * Điểm đánh giá: `4,8` ở bản tiếng Việt, `4.8` ở bản tiếng Anh.
 *
 * Gom về đây thay cho `.toFixed(1).replace('.', ',')` vốn nằm rải rác bốn chỗ. Dấu
 * thập phân là quy ước của ngôn ngữ, và với bốn bản sao thì chỉ cần sót một chỗ là
 * trang tiếng Anh hiện một con số kiểu Việt ngay cạnh những con số kiểu Anh.
 */
export const formatRating = (value: number, locale: Locale) =>
  locale === 'vi' ? value.toFixed(1).replace('.', ',') : value.toFixed(1);

export const formatDistance = (meters: number | null) => {
  if (meters === null) return null;
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
};
