import { type Locale } from './config';

/**
 * Bộ dịch tối giản: tra key, nội suy biến, và số nhiều tiếng Anh.
 *
 * Cố ý không dùng thư viện i18n. Phạm vi là ~300 chuỗi và 2 ngôn ngữ, còn thứ thật
 * sự cần thì gói gọn trong file này; `Intl.PluralRules` đã có sẵn trong runtime.
 * Quan trọng hơn: thư viện phổ biến đi kèm logic negotiate `Accept-Language` và
 * **redirect** — mà ràng buộc cứng ở đây là URL tiếng Việt không được đổi và không
 * được có thêm một hop nào cho Googlebot.
 *
 * **Quy ước bắt buộc**: chuỗi có số nhiều phải nhận biến tên đúng là `count`.
 */

type Vars = Record<string, string | number>;

/** Một chuỗi, hoặc các dạng số nhiều của nó. */
export type Msg = string | { one: string; other: string; zero?: string };

/**
 * Thay `{ten}` bằng giá trị.
 *
 * Dùng `{ten}` chứ không `${ten}`: cú pháp sau đọc như một template literal viết
 * thiếu backtick và mời người sau "sửa" nó thành backtick thật — lúc đó chuỗi được
 * nội suy ngay khi định nghĩa dictionary, tức trước khi có dữ liệu.
 *
 * Thiếu biến thì **giữ nguyên placeholder**, không ném lỗi: một `{ten}` lộ ra trang
 * là xấu, còn ném lỗi trong `generateMetadata` làm cả trang trả 500 và rơi khỏi index.
 */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in vars ? String(vars[key]) : whole,
  );
}

/**
 * Tiếng Việt không phân biệt số nhiều nên không cần luật; tiếng Anh thì có.
 *
 * Dùng `Intl.PluralRules` chứ không `n === 1 ? … : …`. Với `en` hai cách cho cùng
 * kết quả, nhưng luật đúng thì không phải sửa lại khi thêm ngôn ngữ thứ ba.
 */
const PLURAL_RULES: Record<Locale, Intl.PluralRules | null> = {
  vi: null,
  en: new Intl.PluralRules('en-US'),
};

export function selectPlural(msg: Msg, locale: Locale, vars?: Vars): string {
  if (typeof msg === 'string') return msg;

  const count = Number(vars?.count ?? 0);

  // `zero` là nhánh riêng của ta, không phải category CLDR của tiếng Anh:
  // `Intl.PluralRules('en').select(0)` trả 'other' → "0 therapists", đúng ngữ pháp
  // nhưng UI thường muốn "No therapists yet".
  if (count === 0 && msg.zero !== undefined) return msg.zero;

  const rules = PLURAL_RULES[locale];
  if (!rules) return msg.other;
  return rules.select(count) === 'one' ? msg.one : msg.other;
}

function lookup(dict: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
    dict,
  );
}

export type Translator = (path: string, vars?: Vars) => string;

/**
 * Key sai trả về chính key thay vì ném lỗi — cùng lý do với biến thiếu ở trên.
 * Một key lạ hiện trên trang thì nhìn thấy ngay khi review; một trang 500 thì mất
 * cả lượt khách lẫn thứ hạng.
 */
export function createTranslator(dict: unknown, locale: Locale): Translator {
  return (path, vars) => {
    const msg = lookup(dict, path);
    if (msg === undefined || (typeof msg !== 'string' && typeof msg !== 'object')) return path;
    return interpolate(selectPlural(msg as Msg, locale, vars), vars);
  };
}
