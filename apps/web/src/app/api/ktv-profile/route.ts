import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { LOCALES } from '@/i18n/config';
import { API_BASE, getSessionToken } from '@/lib/session';
import { ktvPath } from '@/lib/site';

/**
 * Hai thao tác KTV làm với hồ sơ của **chính mình** mà kết quả hiện ngay trên trang
 * công khai: đổi bảng giá dịch vụ, và bật/tắt "đang nhận khách".
 *
 * **Vì sao không dùng thẳng `/api/proxy`:** đây là lần thứ tư của cùng cái bẫy mà
 * `/api/reviews`, `/api/ktv-media` và `/api/admin-verify` đã ghi lại. Trang hồ sơ là
 * ISR 600 giây, nên KTV sửa giá xong rồi mở trang công khai của mình vẫn thấy giá cũ.
 * Ở đây nó dẫn thẳng tới thiệt hại bằng tiền theo hai chiều: KTV hạ giá để cạnh tranh
 * mà khách vẫn thấy giá cũ, hoặc KTV tăng giá mà khách gọi tới theo giá đã hết hiệu
 * lực rồi tranh cãi ngay ở cửa nhà. Với "đang nhận khách" thì khách gọi vào lúc KTV
 * vừa tắt — đúng cái mà công tắc đó sinh ra để tránh.
 *
 * **Vì sao không nhận `path` từ client như `/api/ktv-media`:** mẫu đó để phía gọi tự
 * dựng đường dẫn, và đó chính là chỗ `ProfileMediaSection` ghim `'vi'` rồi bỏ quên bản
 * `/en`. Ở đây route tự hỏi backend hồ sơ của token này là ai, nên không có tham số nào
 * để quên và không có gì cho client dựng sai. Đổi lại là một lượt gọi `GET` thêm — chỉ
 * xảy ra ở đường ghi, vốn hiếm hơn đường đọc rất nhiều.
 */

/**
 * Đường được phép, khai tường minh: chuỗi này đi thẳng vào URL của backend kèm token
 * thật, nên không nhận đường dẫn tự do từ client.
 */
const TARGETS: Record<string, { path: string; method: string }> = {
  services: { path: 'ktv/profile/services', method: 'PUT' },
  online: { path: 'ktv/profile/online', method: 'PUT' },
};

export async function PUT(request: Request) {
  const token = getSessionToken();
  if (!token) {
    return NextResponse.json({ message: 'Phiên đăng nhập đã hết hạn' }, { status: 401 });
  }

  const target = TARGETS[new URL(request.url).searchParams.get('target') ?? ''];
  if (!target) {
    return NextResponse.json({ message: 'Thao tác không hợp lệ' }, { status: 400 });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${API_BASE}/${target.path}`, {
    method: target.method,
    headers,
    body: await request.text(),
    cache: 'no-store',
  });

  const text = await res.text();

  // Chỉ xoá cache khi backend đã nhận thật — xoá sau một lượt hỏng là bỏ đi bản dựng
  // sẵn của một trang SEO mà không đổi lại được gì.
  //
  // Xoá cho **mọi ngôn ngữ** trong `LOCALES`: bản `/en` là đường dẫn riêng với cache
  // riêng, nên chỉ xoá bản tiếng Việt là để một nửa số trang giữ nội dung cũ, và là
  // nửa ít người mở nên lâu mới lộ.
  if (res.ok) {
    const me = await fetch(`${API_BASE}/ktv/profile/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });

    if (me.ok) {
      const profile = (await me.json()) as { id?: string; slug?: string };

      if (profile.id && profile.slug) {
        for (const locale of LOCALES) {
          revalidatePath(ktvPath(locale, profile.slug, profile.id));
        }
      }
    }
  }

  return new NextResponse(text || null, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
