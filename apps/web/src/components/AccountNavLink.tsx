'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Session = { authenticated: boolean; role: string | null };

/**
 * Chỗ trong header đổi giữa "Đăng nhập" và "Tài khoản".
 *
 * **Phải hỏi phiên ở client, không đọc cookie trong `PublicShell`.** Shell đó bọc
 * toàn bộ nhóm `(public)`, mà `cookies()` trong một layout sẽ ép **mọi** trang dưới
 * nó thành dynamic — tức bỏ ISR trên chính những trang sống nhờ SEO, để đổi lấy một
 * chữ trên thanh điều hướng. Không đáng.
 *
 * Hệ quả chấp nhận được: một nhịp ngắn hiện "Đăng nhập" trước khi biết. Vì vậy chỗ
 * này giữ **bề rộng không đổi** giữa hai trạng thái — nhãn nhảy trong thanh điều
 * hướng dính là thứ đập vào mắt ở mọi trang.
 */
export function AccountNavLink({ className }: { className: string }) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let alive = true;

    fetch('/api/auth/session')
      .then((r) => r.json() as Promise<Session>)
      .then((s) => {
        if (alive) setSession(s);
      })
      // Hỏi hỏng thì để nguyên "Đăng nhập": trang đăng nhập nhận ra người đã có
      // phiên và vẫn đưa họ đi đúng chỗ, nên đoán sai theo hướng này là vô hại.
      .catch(() => {
        if (alive) setSession({ authenticated: false, role: null });
      });

    return () => {
      alive = false;
    };
  }, []);

  // KTV có bảng điều khiển riêng; "Dành cho KTV" bên cạnh đã dẫn tới đó rồi.
  const isCustomer = session?.authenticated === true && session.role !== 'KTV';

  return (
    <Link href={isCustomer ? '/tai-khoan' : '/dang-nhap'} className={className}>
      {isCustomer ? 'Tài khoản' : 'Đăng nhập'}
    </Link>
  );
}
