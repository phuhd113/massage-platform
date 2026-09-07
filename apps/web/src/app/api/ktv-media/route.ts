import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { API_BASE, getSessionToken } from '@/lib/session';

/**
 * Tải lên / gỡ ảnh hồ sơ KTV, rồi làm mất hiệu lực cache của trang hồ sơ công khai.
 *
 * **Vì sao không dùng thẳng `/api/proxy`:** cùng một cái bẫy mà `/api/reviews` đã
 * ghi lại. Trang hồ sơ là ISR 600 giây, nên sau khi đổi ảnh đại diện, KTV mở trang
 * công khai của chính mình và vẫn thấy ảnh cũ — hoặc thấy ô chữ cái đầu như thể
 * lượt tải lên vừa rồi không có tác dụng gì. Họ tải lại lần nữa, và lần này hết hạn
 * mức ảnh. `revalidatePath` chỉ gọi được từ server nên nó phải là một route handler.
 *
 * Ảnh gallery thì ngược lại **không** cần xoá cache ngay: nó vào hàng chờ duyệt và
 * chưa ra trang công khai, nên xoá bản dựng sẵn của một trang SEO ở đó là trả giá
 * mà không đổi được gì. Vì vậy `path` là tuỳ chọn và do phía gọi quyết định.
 */

/** Chỉ ba đường ảnh, khai tường minh. Đây là chuỗi đi thẳng vào URL của backend. */
const TARGETS: Record<string, { path: string; methods: string[] }> = {
  avatar: { path: 'ktv/profile/avatar', methods: ['PUT', 'DELETE'] },
  photos: { path: 'ktv/profile/photos', methods: ['POST'] },
};

async function handle(request: Request) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = TARGETS[url.searchParams.get('target') ?? ''];

  if (!target || !target.methods.includes(request.method)) {
    return NextResponse.json({ message: 'Thao tác không hợp lệ' }, { status: 400 });
  }

  // Ảnh cần xoá thì đi kèm id ở query. Chỉ nhận GUID: giá trị này nối vào đường dẫn
  // API, và một chuỗi tự do ở đó là đường ra khỏi tiền tố đã khai ở trên.
  const photoId = url.searchParams.get('photoId');
  if (photoId && !/^[0-9a-fA-F-]{36}$/.test(photoId)) {
    return NextResponse.json({ message: 'Mã ảnh không hợp lệ' }, { status: 400 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  // Giữ nguyên Content-Type của request gốc: boundary của multipart nằm trong chính
  // header đó, viết đè là backend không tách được file khỏi các trường văn bản.
  const body = request.method === 'DELETE' ? undefined : await request.arrayBuffer();
  const contentType = request.headers.get('Content-Type');
  if (body && body.byteLength > 0 && contentType) headers['Content-Type'] = contentType;

  const res = await fetch(`${API_BASE}/${target.path}${photoId ? `/${photoId}` : ''}`, {
    method: request.method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    cache: 'no-store',
  });

  const text = await res.text();

  // Chỉ xoá cache khi backend đã nhận thật. Xoá sau một lần gửi hỏng là bỏ đi bản
  // dựng sẵn của một trang SEO mà không đổi lại được gì.
  const path = url.searchParams.get('path');
  if (res.ok && path?.startsWith('/') && !path.startsWith('//')) {
    revalidatePath(path);
  }

  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}

export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
