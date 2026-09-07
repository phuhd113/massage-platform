'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Điều hướng khu quản trị.
 *
 * Client component chỉ vì cần `usePathname` để tô mục đang mở — nó không gọi API
 * nào, nên không kéo theo một lượt fetch nào ở client.
 */
export function AdminNav() {
  const pathname = usePathname();

  const items = [
    { href: '/admin/duyet-ktv', label: 'Duyệt hồ sơ KTV' },
    { href: '/admin/duyet-anh', label: 'Duyệt ảnh hồ sơ' },
    { href: '/admin/duyet-cccd', label: 'Duyệt CCCD' },
    { href: '/admin/duyet-chung-chi', label: 'Duyệt chứng chỉ' },
    { href: '/admin/cong-tac-vien', label: 'Cộng tác viên' },
  ];

  return (
    <nav className="grid gap-0.5">
      {items.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-body-l transition ${
              active ? 'bg-brand-100 font-semibold text-brand-600' : 'text-ink-700 hover:bg-brand-50'
            }`}
          >
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
