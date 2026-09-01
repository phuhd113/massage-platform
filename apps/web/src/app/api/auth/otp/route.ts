import { NextResponse } from 'next/server';
import { API_BASE } from '@/lib/session';

/**
 * Xin mã OTP.
 *
 * Đi vòng qua server thay vì gọi thẳng backend từ trình duyệt để địa chỉ API nội
 * bộ không phải công khai ra client — trang public đã gọi thẳng cho lead vì cần
 * backend thấy đúng IP khách, còn ở đây thì không cần.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { phone?: string };

  if (!body.phone) {
    return NextResponse.json({ message: 'Thiếu số điện thoại' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: body.phone }),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => null)) as
    | { debugCode?: string; title?: string }
    | null;

  if (!res.ok) {
    return NextResponse.json(
      { message: data?.title ?? 'Không gửi được mã OTP' },
      { status: res.status },
    );
  }

  // debugCode chỉ tồn tại khi OTP đang ở chế độ stub. Chuyển tiếp nguyên trạng để
  // môi trường dev khỏi phải mở log server; production tắt stub thì trường này
  // không có và màn hình đăng nhập tự bỏ phần hiển thị.
  return NextResponse.json({ ok: true, debugCode: data?.debugCode });
}
