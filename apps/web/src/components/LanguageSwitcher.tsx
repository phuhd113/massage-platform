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
export function LanguageSwitcher({
  locale,
  label,
  className = 'shrink-0 font-medium underline underline-offset-4 transition hover:text-brand-700',
}: {
  locale: Locale;
  label: string;
  /**
   * Mặc định là kiểu dùng ở footer. Nhận qua prop vì component này từng ghi cứng
   * `hidden … sm:block` cho header — lớp đó đi theo xuống footer sẽ giấu mất lối
   * đổi ngôn ngữ **duy nhất** trên toàn bộ màn hình điện thoại.
   */
  className?: string;
}) {
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
      className={className}
    >
      {/* Tên ngôn ngữ đích viết bằng chính ngôn ngữ đó — "English" / "Tiếng Việt",
          không phải "EN" / "VI". Trên header hai chữ cái là đủ vì chỗ hẹp và biểu
          tượng nằm cạnh nhau; ở footer thì nó nằm giữa những link chữ, và "EN" một
          mình đọc như một từ viết tắt chứ không như một lựa chọn. */}
      {target === 'en' ? 'English' : 'Tiếng Việt'}
    </Link>
  );
}
