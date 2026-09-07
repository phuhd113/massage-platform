'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LockIcon } from '@/components/icons';

/**
 * Điều hướng của bảng điều khiển.
 *
 * Client component chỉ vì cần `usePathname` để tô mục đang mở. Mọi dữ liệu (số dư,
 * số chiến dịch) do layout ở server truyền xuống dưới dạng chuỗi đã định dạng sẵn —
 * component này không tự gọi API, nên nó không kéo theo một lượt fetch nào ở client.
 */
export function DashboardNav({
  balanceLabel,
  runningCount,
  hasProfile = true,
}: {
  balanceLabel: string;
  runningCount: number;
  /**
   * Chưa tạo hồ sơ thì mọi mục ngoài "Hồ sơ" đều bị chặn ở server
   * (`requireKtvProfile`). Làm mờ chúng ở đây để KTV thấy trước là chưa vào được,
   * thay vì bấm rồi bị đá ngược lại mà không hiểu vì sao — cùng một luật, chỉ khác
   * là nói ra trước khi bấm. Guard thật vẫn nằm ở server, không phải ở lớp này.
   */
  hasProfile?: boolean;
}) {
  const pathname = usePathname();

  const items = [
    { href: '/dashboard', label: 'Tổng quan' },
    { href: '/dashboard/ho-so', label: 'Hồ sơ' },
    { href: '/dashboard/vi', label: 'Ví', badge: balanceLabel, tone: 'muted' as const },
    { href: '/dashboard/goi', label: 'Mua gói đẩy tin' },
    {
      href: '/dashboard/chien-dich',
      label: 'Chiến dịch',
      badge: runningCount > 0 ? String(runningCount) : undefined,
      tone: 'success' as const,
    },
  ];

  return (
    <nav className="grid gap-0.5">
      {items.map((item) => {
        // So khớp chính xác, không dùng startsWith: "/dashboard" là tiền tố của mọi
        // đường dẫn còn lại nên startsWith sẽ tô sáng "Tổng quan" ở khắp mọi trang.
        const active = pathname === item.href;

        // Trang hồ sơ luôn vào được — nó là nơi gỡ chính điều kiện này.
        const locked = !hasProfile && item.href !== '/dashboard/ho-so';

        if (locked) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              title="Tạo hồ sơ trước để mở phần này"
              className="flex items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-body-l text-ink-400"
            >
              <span>{item.label}</span>
              <LockIcon size={14} className="h-3.5 w-3.5 shrink-0" />
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-between gap-2.5 rounded-md px-3 py-2.5 text-body-l transition ${
              active
                ? 'bg-brand-100 font-semibold text-brand-600'
                : 'text-ink-700 hover:bg-brand-50'
            }`}
          >
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={
                  item.tone === 'success'
                    ? 'tabular rounded-full bg-success-bg px-2 py-px text-caption font-semibold text-success-fg'
                    : 'tabular font-mono text-caption text-ink-500'
                }
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
