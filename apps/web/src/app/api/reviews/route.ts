import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { API_BASE, getSessionToken } from '@/lib/session';

/**
 * Gửi đánh giá, rồi làm mất hiệu lực cache của đúng trang hồ sơ đó.
 *
 * **Vì sao không dùng thẳng `/api/proxy`:** trang hồ sơ là ISR 600 giây, và lời gọi
 * lấy danh sách đánh giá bên trong nó cũng cache đúng ngần ấy. Gửi xong rồi
 * `router.refresh()` chỉ chạy lại server component — fetch bên dưới vẫn trả bản
 * cache cũ, nên **đánh giá vừa viết không hiện ra**. Người viết tưởng hỏng, viết
 * lại, và lần này nhận 409 "bạn đã đánh giá rồi": một lỗi đọc như hệ thống tự mâu
 * thuẫn với chính nó. Đã kiểm chứng đúng như vậy trước khi thêm route này.
 *
 * `revalidatePath` chỉ gọi được từ server, nên nó phải là một route handler chứ
 * không phải vài dòng trong component.
 */
export async function POST(request: Request) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { ktvId?: string; path?: string; rating?: number; comment?: string | null }
    | null;

  // GUID chứ không phải chuỗi bất kỳ: giá trị này đi thẳng vào đường dẫn API.
  if (!body?.ktvId || !/^[0-9a-fA-F-]{36}$/.test(body.ktvId)) {
    return NextResponse.json({ message: 'Thiếu hoặc sai mã kỹ thuật viên' }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/ktv/${body.ktvId}/reviews`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: body.rating, comment: body.comment ?? null }),
    cache: 'no-store',
  });

  const text = await res.text();

  // Chỉ xoá cache khi backend đã nhận thật. Xoá sau một lần gửi hỏng là bỏ đi bản
  // dựng sẵn của một trang SEO mà không đổi lại được gì.
  if (res.ok && body.path && body.path.startsWith('/') && !body.path.startsWith('//')) {
    revalidatePath(body.path);
  }

  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
