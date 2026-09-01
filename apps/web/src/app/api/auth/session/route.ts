import { NextResponse } from 'next/server';
import { API_BASE, SESSION_COOKIE } from '@/lib/session';

/**
 * Đổi mã OTP lấy phiên đăng nhập.
 *
 * Token do backend cấp không bao giờ đi tiếp về trình duyệt dưới dạng đọc được —
 * nó chỉ nằm trong cookie httpOnly do chính route này đặt.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { phone?: string; code?: string };

  if (!body.phone || !body.code) {
    return NextResponse.json({ message: 'Thiếu số điện thoại hoặc mã OTP' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: body.phone, code: body.code, role: 'KTV' }),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as
    | { accessToken?: string; title?: string }
    | null;

  if (!res.ok || !data?.accessToken) {
    return NextResponse.json(
      { message: data?.title ?? 'Mã OTP không đúng hoặc đã hết hạn' },
      { status: res.status === 200 ? 502 : res.status },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    // Bật secure ở production; để bật cứng thì cookie không đặt được khi chạy
    // local trên http và màn hình đăng nhập sẽ hỏng mà không rõ vì sao.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

/** Đăng xuất: xoá cookie phiên. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
