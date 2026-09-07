'use client';

/*
 * HIỆN KHÔNG ROUTE NÀO RENDER COMPONENT NÀY (2026-09-07).
 *
 * Nó từng nằm trên header. Bản này cố ý chỉ để KTV thấy lối đăng nhập, nên lời mời
 * của khách đã gỡ khỏi thanh điều hướng — nhưng **tài khoản khách vẫn sống**:
 * `/dang-nhap`, `/dang-ky`, `/tai-khoan` và form đánh giá đều chạy như cũ, và khách
 * cần đăng nhập thì gần như luôn đang đứng ở một hồ sơ, nơi `ReviewForm` mời họ đúng
 * lúc kèm `?next=` quay lại đúng trang đó.
 *
 * Giữ file thay vì xoá: mở lại chỉ là đặt lại một thẻ vào `PublicShell`, còn viết lại
 * thì mất những quyết định đã ghi bên dưới — nhất là lý do không đọc cookie trong
 * layout.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { type Locale, localePath } from '@/i18n/config';

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
export function AccountNavLink({
  className,
  locale,
  labels,
}: {
  className: string;
  locale: Locale;
  /** Chuỗi đã dịch, truyền từ server: client component không tự tra dictionary. */
  labels: { login: string; myAccount: string };
}) {
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
    <Link
      href={localePath(locale, isCustomer ? '/tai-khoan' : '/dang-nhap')}
      className={className}
    >
      {isCustomer ? labels.myAccount : labels.login}
    </Link>
  );
}
