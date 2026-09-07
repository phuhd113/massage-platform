import { NextResponse } from 'next/server';
import { API_BASE, SESSION_COOKIE } from '@/lib/session';

/**
 * Đăng nhập hoặc đăng ký bằng số điện thoại + mật khẩu.
 *
 * Song song với `../session/route.ts` (đổi OTP lấy phiên) và đặt cookie y hệt: token
 * do backend cấp không bao giờ đi tiếp về trình duyệt dưới dạng đọc được — nó chỉ
 * nằm trong cookie httpOnly do chính route này đặt.
 *
 * `role` chỉ có tác dụng ở chế độ đăng ký, và chỉ cho tài khoản mới. Đăng nhập thì
 * vai trò đã nằm sẵn trên tài khoản, nên đây không phải đường đổi vai trò.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    mode?: string;
    phone?: string;
    password?: string;
    role?: string;
  };

  if (!body.phone || !body.password) {
    return NextResponse.json({ message: 'Thiếu số điện thoại hoặc mật khẩu' }, { status: 400 });
  }

  // Danh sách trắng cho cả hai trường đến từ trình duyệt. `mode` quyết định gọi
  // endpoint nào, `role` quyết định quyền của một tài khoản mới — backend cũng chặn
  // ADMIN, nhưng một giá trị lạ đi được tới đó là đã thừa một lớp.
  const isRegister = body.mode === 'register';
  const role = body.role === 'KTV' ? 'KTV' : 'CUSTOMER';

  const res = await fetch(`${API_BASE}/auth/${isRegister ? 'register' : 'login'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      isRegister
        ? { phone: body.phone, password: body.password, role }
        : { phone: body.phone, password: body.password },
    ),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as
    | { accessToken?: string; user?: { role?: string } }
    | null;

  if (!res.ok || !data?.accessToken) {
    // Chỉ chuyển tiếp **status**, không chuyển tiếp câu chữ: message của backend chỉ
    // có tiếng Việt, và form map lỗi theo status để hiện đúng ngôn ngữ của trang.
    return NextResponse.json({ status: res.status }, { status: res.status === 200 ? 502 : res.status });
  }

  // Trả về vai trò **thật** của tài khoản, không phải vai trò vừa xin: người đã có
  // tài khoản KTV mà đăng nhập từ trang khách vẫn phải được đưa về dashboard. Đây
  // chỉ là gợi ý điều hướng cho màn hình đăng nhập — quyền vẫn nằm trong token.
  const response = NextResponse.json({ ok: true, role: data.user?.role ?? role });
  response.cookies.set(SESSION_COOKIE, data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    // Bật secure ở production; để bật cứng thì cookie không đặt được khi chạy local
    // trên http và màn hình đăng nhập sẽ hỏng mà không rõ vì sao.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
