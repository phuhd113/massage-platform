'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { DEFAULT_LOCALE, type Locale, localePath, stripLocale } from '@/i18n/config';

/**
 * Chuyển ngôn ngữ **tại đúng trang đang xem**, không đá về trang chủ.
 *
 * Đây là lối duy nhất đổi ngôn ngữ. Middleware cố ý không đoán theo
 * `Accept-Language`: tự động chuyển là cách kinh điển khiến Google index nội dung
 * tiếng Anh dưới URL tiếng Việt, và vì Googlebot thường không gửi header đó, lỗi
 * chỉ xuất hiện ở phía Google chứ không tái hiện được trên trình duyệt.
 *
 * Là một `<Link>` thật chứ không phải nút gọi `router.push`: khách cần thấy được
 * URL đích, mở tab mới được, và Google lần theo được để tìm ra bản dịch — cùng lý
 * do với thẻ hreflang, chỉ khác là dành cho người đọc.
 */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();

  // `usePathname` trả về đường dẫn **sau** rewrite của middleware, nên bản tiếng
  // Việt đã mang sẵn tiền tố `/vi`. Cắt nó ra để dựng lại cho ngôn ngữ kia.
  const { path } = stripLocale(pathname);
  const target: Locale = locale === 'vi' ? 'en' : 'vi';

  const query = searchParams?.toString();
  const href = localePath(target, path) + (query ? `?${query}` : '');

  return (
    <Link
      href={href}
      // Nói cho trình duyệt và bot biết đích đến ở ngôn ngữ nào — thẻ này là lý do
      // một link chuyển ngôn ngữ đọc được bằng máy, không chỉ bằng mắt.
      hrefLang={target}
      lang={target}
      aria-label={label}
      className="hidden shrink-0 rounded-md px-2.5 py-1.5 text-body-s text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
    >
      {target === 'en' ? 'EN' : 'VI'}
    </Link>
  );
}
