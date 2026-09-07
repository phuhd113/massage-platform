import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALES } from '@/i18n/config';

/**
 * Gắn locale vào request để cây route `app/[locale]/*` khớp được, **mà không đổi
 * URL tiếng Việt**.
 *
 * Cơ chế là `rewrite`, không phải `redirect`: `/massage-tan-noi/quan-7` được xử lý
 * nội bộ như `/vi/massage-tan-noi/quan-7`, còn thanh địa chỉ, canonical và mọi thứ
 * Googlebot thấy đều giữ nguyên. Đây là ràng buộc cứng — ~760 URL tiếng Việt đã
 * được index, và thêm một hop redirect vào chúng là đánh đổi kênh acquisition
 * chính lấy sự gọn gàng của đường dẫn.
 *
 * **Cố ý KHÔNG** negotiate `Accept-Language` và không đặt cookie ngôn ngữ. Khách
 * vào `/massage-tan-noi/quan-7` từ Google **luôn** nhận tiếng Việt tại đúng URL đó,
 * kể cả khi trình duyệt khai `en-US`. Tự động chuyển theo `Accept-Language` là cách
 * kinh điển khiến Google index nhầm nội dung tiếng Anh dưới URL tiếng Việt — và
 * Googlebot thường không gửi header đó, nên lỗi sẽ chỉ xuất hiện ở phía Google chứ
 * không bao giờ tái hiện được trên trình duyệt. Đổi ngôn ngữ chỉ qua link tường minh.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const prefixed = LOCALES.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );

  const locale = prefixed ?? DEFAULT_LOCALE;

  // `not-found.tsx` không nhận `params`, nên nó đọc locale từ header này.
  const headers = new Headers(req.headers);
  headers.set('x-locale', locale);

  // Đã có prefix thì cây route tự khớp; chỉ cần chuyển tiếp kèm header.
  if (prefixed) return NextResponse.next({ request: { headers } });

  return NextResponse.rewrite(new URL(`/${DEFAULT_LOCALE}${pathname}${search}`, req.url), {
    request: { headers },
  });
}

export const config = {
  /**
   * Loại trừ ngay ở matcher thay vì lọc trong hàm — mỗi mục dưới đây là một lỗi
   * thật nếu thiếu:
   *
   * - `api`: 8 route handler ở `app/api/*` **không** nằm dưới `[locale]`. Rewrite
   *   chúng thành `/vi/api/...` là 404 toàn bộ — gửi lead chết, đăng nhập chết, và
   *   ô gợi ý khu vực hỏng **im lặng** vì route đó bắt lỗi rồi trả mảng rỗng.
   * - `_next/static`, `_next/image`: asset và trình tối ưu ảnh.
   * - `.*\..*`: mọi đường dẫn có phần mở rộng — `robots.txt`, `sitemap.xml`,
   *   `favicon.ico` và file trong `public/`. Rewrite chúng làm hỏng đúng hai file
   *   mà SEO phụ thuộc vào.
   * - `dashboard`, `admin`: hai cây route này **cố ý** chỉ có tiếng Việt nên nằm
   *   ngoài `[locale]` — cả hai nhóm người dùng đều là người Việt, dịch ~420 chuỗi
   *   ở đó là công lớn mà gần như không ai đọc. Rewrite chúng thành `/vi/dashboard`
   *   là trỏ tới nhánh không tồn tại, nên **mọi** trang dashboard và admin trả 404
   *   ngay sau khi đăng nhập — trong khi build vẫn xanh và `routes-manifest.json`
   *   vẫn khai đủ route, nên không có gì báo lỗi ngoài chính trang 404.
   */
  matcher: ['/((?!api|dashboard|admin|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
