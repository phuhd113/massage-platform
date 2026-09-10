'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { LockIcon } from '@/components/icons';
import { LogoutButton } from '@/components/LogoutButton';

/**
 * Điều hướng của bảng điều khiển.
 *
 * Client component vì cần `usePathname` (tô mục đang mở, và đặt tên cho nút menu ở
 * mobile) cùng trạng thái đóng/mở của danh sách. Mọi dữ liệu (số dư, số chiến dịch)
 * do layout ở server truyền xuống dưới dạng chuỗi đã định dạng sẵn — component này
 * không tự gọi API, nên nó không kéo theo một lượt fetch nào ở client.
 *
 * **Hai hình dạng, một danh sách.** Dưới `lg` nó là thanh gập: chỉ hiện mục đang mở
 * cùng nút bật/tắt, còn danh sách nở ra khi bấm. Từ `lg` trở lên nó là sidebar cố
 * định như artboard và **luôn mở** — không có nút nào. Trước đây danh sách hiện
 * nguyên trên điện thoại và chiếm gần trọn màn hình đầu tiên, nên nội dung KTV vào
 * để xem bị đẩy hẳn xuống dưới.
 *
 * Cố ý **không** dựng hai cây điều hướng rồi ẩn hiện theo breakpoint: hai bản sao
 * phải tự giữ cho khớp nhau mãi mãi, và thêm một mục vào đúng một bản là lỗi im lặng
 * — mục đó vẫn tồn tại ở nửa còn lại nên không có gì báo đỏ. Ở đây chỉ có một `<ul>`,
 * phần đổi theo breakpoint là class hiển thị.
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
  const panelId = useId();

  const [open, setOpen] = useState(false);

  /**
   * Đóng danh sách mỗi khi sang trang.
   *
   * Điều hướng bằng `<Link>` không tải lại trang nên state ở đây sống sót qua lượt
   * chuyển — thiếu effect này thì bấm một mục ở mobile sẽ sang đúng trang nhưng menu
   * vẫn còn mở, che mất chính nội dung vừa mở ra.
   */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items = [
    { href: '/dashboard', label: 'Tổng quan' },
    { href: '/dashboard/ho-so', label: 'Hồ sơ' },
    // Ngay sau Hồ sơ, trước Ví: đây là hai trang mô tả "tôi là ai / tôi bán gì", còn
    // ba mục sau đều là chi tiền. Dịch vụ và giá cũng bị khoá khi chưa có hồ sơ như
    // mọi mục khác — bảng giá treo vào hồ sơ, chưa có hồ sơ thì không có gì để treo.
    { href: '/dashboard/dich-vu', label: 'Dịch vụ và giá' },
    { href: '/dashboard/vi', label: 'Ví', badge: balanceLabel, tone: 'muted' as const },
    { href: '/dashboard/goi', label: 'Mua gói đẩy tin' },
    {
      href: '/dashboard/chien-dich',
      label: 'Chiến dịch',
      badge: runningCount > 0 ? String(runningCount) : undefined,
      tone: 'success' as const,
    },
  ];

  // Tên trang đang mở, hiện trên nút menu ở mobile. Danh sách đang gập lại thì đây
  // là thứ duy nhất nói cho KTV biết mình đang đứng ở đâu.
  const current = items.find((i) => i.href === pathname)?.label ?? 'Menu';

  return (
    <>
      {/*
        Nút chỉ tồn tại ở mobile. `lg:hidden` chứ không phải render có điều kiện theo
        chiều rộng: đọc `window.innerWidth` lúc render đầu cho server và client hai
        kết quả khác nhau → hydration mismatch, đúng cái bẫy đã ghi ở `saved-area.ts`.
        Ẩn bằng CSS thì cả hai phía dựng ra cùng một cây.
      */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-body-l text-ink-700 transition hover:bg-brand-50 lg:hidden"
      >
        <span className="min-w-0 truncate font-semibold text-ink-900">{current}</span>

        <span className="flex shrink-0 items-center gap-2 text-body-s text-ink-500">
          {open ? 'Đóng' : 'Menu'}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>

      {/*
        `hidden` khi đóng ở mobile, nhưng `lg:grid` luôn thắng ở desktop — sidebar
        không bao giờ gập. Nhờ vậy trạng thái `open` chỉ có nghĩa dưới `lg` và không
        cần đồng bộ gì khi đổi kích thước cửa sổ.
      */}
      <nav
        id={panelId}
        className={`gap-0.5 lg:grid ${open ? 'mt-1 grid' : 'hidden'}`}
      >
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

        {/*
          Hai lối ra, chỉ ở mobile — bản desktop nằm ở `layout.tsx` dưới chân sidebar.
          Chúng phải nằm **trong** nhóm gập: ở mobile menu đóng lại là cả khối biến
          mất, mà "Về trang chủ" và "Đăng xuất" đứng lơ lửng trên đầu nội dung thì
          vừa chiếm chỗ vừa mời bấm nhầm đúng nút thoát.
        */}
        <div className="mt-2 border-t border-ink-100 px-3 pt-3 lg:hidden">
          <Link href="/" className="block text-body text-ink-600 transition hover:text-brand-600">
            Về trang chủ
          </Link>
          <div className="mt-2.5">
            <LogoutButton labels={{ logout: 'Đăng xuất', loggingOut: 'Đang thoát…' }} />
          </div>
        </div>
      </nav>
    </>
  );
}
