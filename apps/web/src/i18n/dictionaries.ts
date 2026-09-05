import { type Locale } from './config';
import { vi } from './vi';
import { en } from './en';

/**
 * Nới literal type của `vi.ts` (`'Trang chủ'`) thành `string` để `en.ts` gán được
 * chuỗi khác, nhưng **giữ nguyên cấu trúc key** — thiếu key vẫn là build đỏ.
 *
 * Nhánh `{one, other}` được giữ nguyên hình dạng object, nên một key khai số nhiều
 * ở bản tiếng Việt bắt buộc cũng phải khai số nhiều ở bản tiếng Anh.
 */
type Loose<T> = {
  [K in keyof T]: T[K] extends string ? string : Loose<T[K]>;
};

export type Dictionary = Loose<typeof vi>;

const DICTS: Record<Locale, Dictionary> = { vi, en };

/**
 * Đồng bộ và import tĩnh, cố ý không dùng `await import()`.
 *
 * Pattern `dictionaries[locale]()` trong docs của Next tồn tại để không gửi bản
 * dịch thừa xuống client bundle. Ở đây phần lớn dictionary được đọc trong server
 * component nên nó vốn không vào bundle, còn client component thì nhận **slice**
 * đã dịch qua props chứ không tự tra. Đồng bộ thì không có `await` nào nằm trong
 * nhánh render.
 */
export const getDictionary = (locale: Locale): Dictionary => DICTS[locale];
