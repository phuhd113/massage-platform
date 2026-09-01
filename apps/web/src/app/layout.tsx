import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_NAME, SITE_URL } from '@/lib/site';
import './globals.css';

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
    <html lang="vi">
      <body className="flex min-h-screen flex-col">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-lg font-semibold text-brand-600">
              {SITE_NAME}
            </Link>
            <nav className="flex gap-5 text-sm text-stone-600">
              <Link href="/tim-kiem" className="hover:text-brand-600">
                Tìm KTV
              </Link>
              <Link href="/massage-tai-nha/tp-ho-chi-minh" className="hover:text-brand-600">
                TP.HCM
              </Link>
              <Link href="/massage-tai-nha/ha-noi" className="hover:text-brand-600">
                Hà Nội
              </Link>
              <Link href="/dashboard" className="font-medium text-brand-600 hover:text-brand-700">
                Dành cho KTV
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

        <footer className="border-t border-stone-200 bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-stone-500">
            {SITE_NAME} — nền tảng kết nối khách với kỹ thuật viên massage trị liệu tại nhà. Mọi hồ
            sơ hiển thị đều đã qua duyệt chứng chỉ hành nghề.
          </div>
        </footer>
      </body>
    </html>
  );
}
