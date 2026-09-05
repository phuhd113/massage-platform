import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/site';
import './globals.css';

/**
 * Root layout **cố ý không render `<html>`/`<body>`** — `app/[locale]/layout.tsx`
 * làm việc đó.
 *
 * Lý do: `lang` phải theo ngôn ngữ của trang, mà root layout không nhận `params`.
 * Cách duy nhất để biết locale ở đây là đọc `headers()`, và điều đó biến **mọi**
 * route thành dynamic — tức giết ISR của trang khu vực và trang hồ sơ, hai loại
 * trang sống nhờ SEO. Đẩy `<html>` xuống một cấp thì `params.locale` có sẵn và
 * không trang nào mất cache.
 *
 * Next chấp nhận root layout trả `children` trần miễn là có **đúng một** `<html>`
 * ở phía dưới trong cây.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
