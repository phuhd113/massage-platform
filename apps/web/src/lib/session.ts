import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'massage_session';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:5080/api/v1';

/**
 * Token nằm trong cookie httpOnly, không phải localStorage.
 *
 * Đây là khu vực chạm tiền: một lỗ XSS ở bất kỳ đâu trong site cũng đọc được
 * localStorage, và token đọc được nghĩa là nạp tiền, mua gói, huỷ campaign thay
 * người khác. Cookie httpOnly thì JavaScript của trang không chạm tới được, nên
 * trình duyệt giữ token mà không có đoạn mã nào của ta cầm nó.
 *
 * Đổi lại, mọi lời gọi API có xác thực phải đi qua server: server component đọc
 * cookie trực tiếp, còn thao tác từ client đi qua route handler proxy.
 */
export function getSessionToken(): string | null {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}

export class UnauthenticatedError extends Error {}

/**
 * Gọi API backend kèm token của phiên hiện tại. Chỉ dùng được ở phía server.
 *
 * `no-store` cho mọi thứ ở đây: số dư ví và danh sách campaign là dữ liệu riêng
 * của từng người và đổi ngay sau mỗi thao tác — cache dù chỉ vài giây cũng khiến
 * KTV mua gói xong vẫn thấy số dư cũ và tưởng giao dịch hỏng.
 */
export async function authFetch<T>(path: string): Promise<T> {
  const token = getSessionToken();
  if (!token) throw new UnauthenticatedError();

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  });

  if (res.status === 401 || res.status === 403) throw new UnauthenticatedError();
  if (!res.ok) throw new Error(`API ${path} trả về ${res.status}`);

  return (await res.json()) as T;
}

/** Như <c>authFetch</c> nhưng trả null khi backend báo 404 thay vì ném lỗi. */
export async function authFetchOrNull<T>(path: string): Promise<T | null> {
  try {
    return await authFetch<T>(path);
  } catch (err) {
    if (err instanceof UnauthenticatedError) throw err;
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  }
}

export const API_BASE = BASE;
