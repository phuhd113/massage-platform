import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';
import { getSessionToken } from '@/lib/session';

export const metadata: Metadata = {
  title: { default: 'Bảng điều khiển', template: '%s | Bảng điều khiển' },
  // Ngoài robots.txt còn đặt thẻ ở đây: robots.txt chỉ ngăn crawl, không ngăn
  // index nếu có trang khác trỏ tới. Thẻ noindex mới thật sự giữ dashboard ra
  // ngoài kết quả tìm kiếm.
  robots: { index: false, follow: false },
};

// Số dư và campaign là dữ liệu riêng của từng người, không được cache dùng chung.
export const dynamic = 'force-dynamic';

const nav = [
  { href: '/dashboard', label: 'Tổng quan' },
  { href: '/dashboard/ho-so', label: 'Hồ sơ' },
  { href: '/dashboard/vi', label: 'Ví' },
  { href: '/dashboard/goi', label: 'Mua gói' },
  { href: '/dashboard/chien-dich', label: 'Chiến dịch' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Chặn ngay ở layout thay vì ở từng trang: thiếu một chỗ là lộ dữ liệu ở chỗ đó.
  if (!getSessionToken()) redirect('/dang-nhap');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-4">
        <nav className="flex flex-wrap gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 hover:text-brand-600"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </div>

      <div className="pt-6">{children}</div>
    </div>
  );
}
