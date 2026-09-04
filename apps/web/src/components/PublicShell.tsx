import Link from 'next/link';
import { LogoMark } from '@/components/icons';
import { SITE_NAME } from '@/lib/site';

/**
 * Khung trang công khai: header + footer.
 *
 * Tách khỏi root layout để **bảng điều khiển không dùng nó**. Dashboard trong thiết
 * kế là một màn riêng có sidebar của chính nó; đặt thêm header/footer của trang bán
 * hàng lên trên là hai bộ điều hướng chồng nhau, và KTV đang làm việc không cần lời
 * mời "Tìm KTV".
 *
 * not-found.tsx nằm ở root nên cũng dùng component này — trang 404 vẫn phải có đường
 * quay lại site.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header dính: trên trang kết quả dài, khách cuộn giữa chừng vẫn quay
          lại đổi khu vực được mà không phải cuộn ngược lên đầu.
          backdrop-blur giữ chữ đọc được khi nội dung trôi phía dưới. */}
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3.5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap font-display text-h4 text-brand-600 transition hover:text-brand-700"
          >
            <LogoMark className="h-6 w-6 shrink-0" />
            {SITE_NAME}
          </Link>

          <nav className="flex items-center gap-1 text-body-s">
            {/* Ẩn ở màn hẹp: 390px không đủ chỗ cho logo lẫn nav, và mọi trang
                công khai đều đã có đường vào tìm kiếm ngay trong nội dung. */}
            <Link
              href="/tim-kiem"
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
            >
              Tìm KTV
            </Link>
            <Link
              href="/massage-tai-nha/tp-ho-chi-minh"
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
            >
              TP.HCM
            </Link>
            <Link
              href="/massage-tai-nha/ha-noi"
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 sm:block"
            >
              Hà Nội
            </Link>
            {/* Trỏ vào khối ba bước ở trang chủ chứ không mở trang riêng: nội dung
                đó chỉ dài ba đoạn, tách ra thành một trang là tự tạo thin content. */}
            <Link
              href="/#cach-duyet-ho-so"
              className="hidden rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700 lg:block"
            >
              Cách chúng tôi duyệt hồ sơ
            </Link>
            <Link
              href="/dashboard"
              className="ml-1 shrink-0 whitespace-nowrap rounded-md border border-brand-200 px-3 py-1.5 font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Dành cho KTV
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-shell flex-1 px-4 py-8 sm:py-10">{children}</main>

      <footer className="mt-auto border-t border-ink-200 bg-white">
        <div className="mx-auto max-w-shell px-4 py-8 text-body-s text-ink-500">
          <p className="max-w-prose">
            {SITE_NAME} — nền tảng kết nối khách với kỹ thuật viên massage trị liệu tại nhà. Mọi
            hồ sơ hiển thị đều đã qua duyệt chứng chỉ hành nghề.
          </p>
        </div>
      </footer>
    </div>
  );
}
