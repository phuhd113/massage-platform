import type { Metadata } from 'next';
import { IBM_Plex_Mono, Plus_Jakarta_Sans, Source_Sans_3 } from 'next/font/google';
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
      <body>
        {children}
      </body>
    </html>
  );
}
