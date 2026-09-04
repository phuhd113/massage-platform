import { NextResponse } from 'next/server';
import { API_BASE, getSessionToken } from '@/lib/session';

/**
 * Ghi lead **cho khách đã đăng nhập**, để lead mang theo `customer_user_id`.
 *
 * Vì sao cần đường riêng: `ContactButtons` gọi thẳng `POST /leads` sang origin của
 * backend, và token nằm trong cookie httpOnly của origin Next — cookie không đi kèm
 * request cross-origin, JS cũng không đọc được nó để gắn `Authorization`. Kết quả
 * là **mọi** lead đều ẩn danh, kể cả của khách vừa đăng nhập xong. Đó chính là lý
 * do không review nào khớp được với một lead, và là thứ chặn quy tắc "chỉ ai từng
 * liên hệ mới được đánh giá" ở Phase 4.
 *
 * Vì sao khách ẩn danh **vẫn** gọi thẳng chứ không dùng route này: backend cần đúng
 * IP của khách để gộp lead trùng trong 5 phút, và qua proxy thì mọi khách mang chung
 * IP của server. Với khách đã đăng nhập thì điều đó không còn quan trọng —
 * `ComputeDeviceHash` đã lấy `userId` làm thành phần đầu của khoá gộp, nên hai người
 * khác nhau không bao giờ đụng nhau dù chung IP.
 *
 * IP thật vẫn được chuyển tiếp qua `X-Forwarded-For` để dữ liệu chống gian lận ở
 * Phase 4 không bị mất; backend chỉ nên tin header đó khi đã cấu hình proxy tin cậy.
 */
export async function POST(request: Request) {
  const token = getSessionToken();
  if (!token) {
    // Không tự gọi hộ khi chưa đăng nhập: làm vậy sẽ ghi một lead mang IP của
    // server và phá luôn cơ chế gộp. Client nhận 401 rồi tự gọi thẳng backend.
    return NextResponse.json({ message: 'Chưa đăng nhập' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { ktvId?: string; channel?: string; sourceUrl?: string }
    | null;

  if (!body?.ktvId || !/^[0-9a-fA-F-]{36}$/.test(body.ktvId)) {
    return NextResponse.json({ message: 'Thiếu hoặc sai mã kỹ thuật viên' }, { status: 400 });
  }

  const forwarded = request.headers.get('x-forwarded-for');
  const userAgent = request.headers.get('user-agent');

  const res = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}),
      ...(userAgent ? { 'User-Agent': userAgent } : {}),
    },
    body: JSON.stringify({
      ktvId: body.ktvId,
      channel: body.channel,
      sourceUrl: body.sourceUrl ?? null,
    }),
    cache: 'no-store',
  });

  const text = await res.text();

  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
