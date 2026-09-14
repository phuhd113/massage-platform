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

  // Bốn hàng đợi duyệt trước, rồi hai hàng đợi kiểm duyệt nội dung, rồi hai trang
  // tra cứu. Mục sidebar là bước cuối cùng của việc thêm một hàng đợi và cũng là
  // bước hay bị quên nhất: trang tồn tại nhưng không ai tìm ra thì với người dùng
  // nó không khác gì chưa làm — xem "Ba lần cùng một lỗi" trong project-status.md.
  const items = [
    // Tra cứu đứng trước hàng đợi: câu hỏi "người này là ai" phát sinh bất cứ lúc nào
    // trong ngày (KTV gọi tới), còn duyệt hồ sơ là việc làm theo đợt.
    { href: '/admin/ktv', label: 'Quản lý KTV' },
    { href: '/admin/duyet-ktv', label: 'Duyệt hồ sơ KTV' },
    { href: '/admin/duyet-anh-dai-dien', label: 'Duyệt ảnh đại diện' },
    { href: '/admin/duyet-anh', label: 'Duyệt ảnh hồ sơ' },
    { href: '/admin/duyet-cccd', label: 'Duyệt CCCD' },
    { href: '/admin/duyet-chung-chi', label: 'Duyệt chứng chỉ' },
    { href: '/admin/bao-cao', label: 'Báo cáo vi phạm' },
    { href: '/admin/ra-soat-danh-gia', label: 'Rà soát đánh giá' },
    { href: '/admin/cong-tac-vien', label: 'Cộng tác viên' },
    // Biên tập nội dung khu vực: không phải hàng đợi duyệt mà là việc chủ động, nên
    // nằm cuối cùng cạnh các trang tra cứu. Nó là vế thứ hai của điều kiện index —
    // trước đợt này cột `editorial_note` chỉ được đọc, không có đường nhập nào ngoài
    // SQL tay, nên 0/759 khu vực có nội dung và không trang nào index được.
    { href: '/admin/noi-dung-khu-vuc', label: 'Nội dung khu vực' },
    { href: '/admin/doanh-thu', label: 'Doanh thu' },
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
