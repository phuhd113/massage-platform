'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Nút đăng xuất, dùng ở hai chỗ có hình dạng rất khác nhau: link nhỏ trong sidebar
 * dashboard, và nút chính trên màn hình "bạn đang đăng nhập bằng tài khoản khách".
 *
 * `className` và `nextHref` vì vậy là prop chứ không ghim cứng — một bản sao thứ hai
 * chỉ để đổi màu nút và đích đến là hai đường gọi `DELETE /api/auth/session` phải tự
 * giữ cho khớp nhau, và bản quên `router.refresh()` sẽ để lại header của phiên cũ.
 */
export function LogoutButton({
  labels,
  className = 'text-sm text-ink-600 hover:text-brand-600 disabled:opacity-60',
  nextHref = '/',
}: {
  labels: { logout: string; loggingOut: string };
  className?: string;
  nextHref?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch('/api/auth/session', { method: 'DELETE' });
    // `refresh()` trước `push()`: server component đọc cookie ở lần render sau, nên
    // thiếu nó thì trang đích vẫn dựng bằng phiên vừa bị xoá.
    router.refresh();
    router.push(nextHref);
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className={className}
    >
      {pending ? labels.loggingOut : labels.logout}
    </button>
  );
}
