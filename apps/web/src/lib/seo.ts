import { DEFAULT_LOCALE, LOCALES, type Locale, localePath } from '@/i18n/config';
import { absolute } from '@/lib/site';

/**
 * canonical + hreflang cho một trang, dựng từ đường dẫn **không có prefix locale**.
 *
 * Phải gọi trong `generateMetadata` của **từng trang**, không đặt ở layout: metadata
 * của layout merge **nông** với metadata của page, nên một page khai
 * `alternates: { canonical }` sẽ ghi đè trọn `alternates` của layout — kể cả phần
 * `languages`. Kết quả là hreflang biến mất khỏi đúng những trang cần nó nhất, mà
 * build vẫn xanh và chỉ HTML thiếu thẻ.
 *
 * `x-default` trỏ bản tiếng Việt: đó là bản đầy đủ nhất (nội dung do người dùng
 * nhập vốn là tiếng Việt), là thị trường chính, và là URL Google đã index sẵn.
 *
 * Google bỏ qua **cả cụm** hreflang nếu nó không đối xứng — mỗi URL phải trỏ ngược
 * lại mọi URL còn lại và phải tự khai chính mình. Dựng tập trung ở đây thay vì gõ
 * tay ở sáu trang là cách rẻ nhất để giữ tính đối xứng đó.
 */
export function alternatesFor(locale: Locale, basePath: string) {
  const languages = Object.fromEntries([
    ...LOCALES.map((l) => [l, absolute(localePath(l, basePath))]),
    ['x-default', absolute(localePath(DEFAULT_LOCALE, basePath))],
  ]);

  return {
    canonical: absolute(localePath(locale, basePath)),
    languages,
  };
}
