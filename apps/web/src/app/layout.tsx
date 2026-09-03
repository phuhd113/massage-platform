import type { Metadata } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Source_Sans_3 } from 'next/font/google';
import Link from 'next/link';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

/**
 * `subsets` phải có 'vietnamese' — thiếu nó, font chỉ tải glyph latin và mọi chữ
 * có dấu rơi về font hệ thống, khiến "Trần Thị Hường" render bằng hai typeface
 * trong cùng một dòng. Rất khó thấy khi review nhanh, nhưng khách Việt thấy ngay.
 *
 * Tiêu đề cần cả 800: thang chữ của thiết kế dùng weight đó cho hero và h1 trang
 * hồ sơ. Thiếu weight thật thì trình duyệt tự làm đậm giả, nét bị bè và lệch hẳn
 * so với bản thiết kế.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'vietnamese'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

// Chỉ dùng cho số (tiền, id giao dịch) nên không cần subset tiếng Việt.
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — KTV trị liệu có chứng chỉ`,
    // Mỗi trang tự đặt title theo địa danh/dịch vụ; template chỉ gắn thêm tên site.
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Tìm kỹ thuật viên massage trị liệu tại nhà theo khu vực, xem chứng chỉ hành nghề và đánh giá thật trước khi liên hệ.',
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: SITE_NAME,
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      className={`${jakarta.variable} ${sourceSans.variable} ${plexMono.variable}`}
    >
      <body className="flex min-h-screen flex-col">
        {/* Header dính: trên trang kết quả dài, khách cuộn giữa chừng vẫn quay
            lại đổi khu vực được mà không phải cuộn ngược lên đầu.
            backdrop-blur giữ chữ đọc được khi nội dung trôi phía dưới. */}
        <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-shell items-center justify-between gap-4 px-4 py-3.5">
            <Link
              href="/"
              className="flex items-center gap-2 font-display text-h4 text-brand-600 transition hover:text-brand-700"
            >
              <svg
                aria-hidden
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22c4.5-3 8-6.5 8-11a8 8 0 0 0-16 0c0 4.5 3.5 8 8 11z" />
                <path d="M12 13V7M9.5 9.5h5" />
              </svg>
              {SITE_NAME}
            </Link>

            <nav className="flex items-center gap-1 text-body-s">
              <Link
                href="/tim-kiem"
                className="rounded-md px-2.5 py-1.5 text-ink-600 transition hover:bg-brand-50 hover:text-brand-700"
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
              <Link
                href="/dashboard"
                className="ml-1 rounded-md border border-brand-200 px-3 py-1.5 font-medium text-brand-700 transition hover:bg-brand-50"
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
      </body>
    </html>
  );
}
