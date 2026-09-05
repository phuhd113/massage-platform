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
    | { debugCode?: string; expiresAt?: string; title?: string }
    | null;

  if (!res.ok) {
    // Chuyển tiếp **mã trạng thái**, không chuyển tiếp câu chữ của backend. Message
    // của API vẫn chỉ có tiếng Việt (quyết định của bản i18n: frontend map lỗi theo
    // HTTP status ở mọi flow khách), nên đẩy nó ra đây là để một câu tiếng Việt hiện
    // giữa giao diện tiếng Anh — và với 503 thì câu đó còn nêu đích danh khoá cấu
    // hình còn thiếu. LoginForm dịch status thành chuỗi đúng ngôn ngữ.
    return NextResponse.json({ status: res.status }, { status: res.status });
  }

  // debugCode chỉ tồn tại khi OTP đang ở chế độ stub. Chuyển tiếp nguyên trạng để
  // môi trường dev khỏi phải mở log server; production tắt stub thì trường này
  // không có và màn hình đăng nhập tự bỏ phần hiển thị.
  // expiresAt để màn hình đếm ngược theo **hạn thật của server**, không phải một
  // con số đếm lùi tự đặt ở client: đếm sai thì hoặc mời khách gửi lại khi backend
  // còn từ chối, hoặc bắt họ chờ thêm khi mã đã hết hạn từ lâu.
  return NextResponse.json({
    ok: true,
    debugCode: data?.debugCode,
    expiresAt: data?.expiresAt,
  });
}
