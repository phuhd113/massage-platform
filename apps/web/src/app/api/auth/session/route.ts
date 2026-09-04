import { NextResponse } from 'next/server';
import { API_BASE, SESSION_COOKIE } from '@/lib/session';

/**
 * Đổi mã OTP lấy phiên đăng nhập.
 *
 * Token do backend cấp không bao giờ đi tiếp về trình duyệt dưới dạng đọc được —
 * nó chỉ nằm trong cookie httpOnly do chính route này đặt.
 *
 * `role` chỉ có tác dụng khi số điện thoại này **chưa có tài khoản**: backend lấy
 * nó làm vai trò cho tài khoản vừa tạo, còn tài khoản đã tồn tại thì giữ nguyên
 * vai trò cũ. Nên đây không phải đường để đổi vai trò, và một khách bấm nhầm vào
 * trang đăng ký KTV cũng không mất quyền gì.
 *
 * Trước đây chỗ này ghi cứng `'KTV'`, nghĩa là **mọi** người đăng nhập qua giao
 * diện đều thành kỹ thuật viên — kể cả khách chỉ muốn viết một đánh giá.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { phone?: string; code?: string; role?: string };

  if (!body.phone || !body.code) {
    return NextResponse.json({ message: 'Thiếu số điện thoại hoặc mã OTP' }, { status: 400 });
  }

  // Danh sách trắng chứ không chuyển tiếp nguyên trạng: thân request này đến từ
  // trình duyệt, và `role` là thứ quyết định quyền của một tài khoản mới. Backend
  // cũng chặn ADMIN, nhưng một giá trị lạ đi được tới đó là đã thừa một lớp.
  const role = body.role === 'KTV' ? 'KTV' : 'CUSTOMER';

  const res = await fetch(`${API_BASE}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: body.phone, code: body.code, role }),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as
    | { accessToken?: string; user?: { role?: string }; title?: string }
    | null;

  if (!res.ok || !data?.accessToken) {
    return NextResponse.json(
      { message: data?.title ?? 'Mã OTP không đúng hoặc đã hết hạn' },
      { status: res.status === 200 ? 502 : res.status },
    );
  }

  // Trả về vai trò **thật** của tài khoản, không phải vai trò vừa xin: người đã có
  // tài khoản KTV mà đăng nhập từ trang khách vẫn phải được đưa về dashboard. Đây
  // chỉ là gợi ý điều hướng cho màn hình đăng nhập — quyền vẫn nằm trong token.
  const response = NextResponse.json({ ok: true, role: data.user?.role ?? role });
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
